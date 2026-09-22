import { describe, expect, it } from "vitest";
import {
  POINTS_PER_ASSIST,
  POINTS_PER_GOAL,
  POINTS_PER_MVP,
  POINTS_PER_WIN,
  PEER_RATING_NEUTRAL,
  PEER_RATING_FORCE_DEFAULT,
  playerPointsFromStats,
  playerMatchRating,
  fantasyRatingFactors,
  meanPeerScore,
  collectedPeerScores,
  mvpPlayerIds,
  validateGoalTotal,
  managerMatchPoints,
  scoreManagerLineup,
} from "@shared/domain/scoring";
import { statsSubmissionState } from "@shared/domain/stats";

describe("playerPointsFromStats", () => {
  it("scores goals × 2 and assists × 1 with no win bonus", () => {
    expect(POINTS_PER_GOAL).toBe(2);
    expect(POINTS_PER_ASSIST).toBe(1);
    expect(playerPointsFromStats({ goals: 2, assists: 1 })).toBe(5);
    expect(playerPointsFromStats({ goals: 0, assists: 0 })).toBe(0);
  });
});

describe("playerMatchRating", () => {
  it("adds peer average, goals, assists, POTM and win before factors", () => {
    expect(POINTS_PER_MVP).toBe(3);
    expect(POINTS_PER_WIN).toBe(1);
    expect(meanPeerScore([])).toBe(PEER_RATING_NEUTRAL);
    expect(meanPeerScore([8, 7])).toBe(7.5);
    expect(
      playerMatchRating({ peerAverage: 7.5, goals: 2, assists: 1, isMvp: true, won: true }),
    ).toBe(7.5 + 5 + 3 + 1);
    expect(
      playerMatchRating({ peerAverage: 5, goals: 0, assists: 0, isMvp: false }),
    ).toBe(5);
    expect(mvpPlayerIds([{ mvpPlayerId: 1 }, { mvpPlayerId: 1 }, { mvpPlayerId: 2 }]).has(1)).toBe(true);
    expect(mvpPlayerIds([{ mvpPlayerId: 1 }, { mvpPlayerId: 1 }, { mvpPlayerId: 2 }]).has(2)).toBe(false);
  });

  it("fills missing assignment votes at 6.5 and can ignore extras", () => {
    expect(PEER_RATING_FORCE_DEFAULT).toBe(6.5);
    const scores = collectedPeerScores({
      assignments: [
        { raterPlayerId: 1, rateePlayerId: 2 },
        { raterPlayerId: 2, rateePlayerId: 1 },
      ],
      ratings: [{ raterPlayerId: 1, rateePlayerId: 2, score: 8 }],
      missingScore: PEER_RATING_FORCE_DEFAULT,
    });
    expect(scores.get(2)).toEqual([8]);
    expect(scores.get(1)).toEqual([6.5]);
    expect(meanPeerScore([], PEER_RATING_FORCE_DEFAULT)).toBe(6.5);
    expect(
      playerMatchRating({ peerAverage: 6.5, goals: 2, assists: 1, isMvp: true }),
    ).toBe(6.5 + 5 + 3);
    expect(
      playerMatchRating({ peerAverage: 6.5, goals: 0, assists: 0, isMvp: false }),
    ).toBe(6.5);
  });

  it("applies a blowout penalty vs a weaker side", () => {
    const factors = fantasyRatingFactors({
      won: true,
      ownGoals: 4,
      oppGoals: 0,
      ownAvgVm: 20,
      oppAvgVm: 10,
      playerVm: 18,
      participantVms: [10, 12, 18, 20],
      goals: 2,
      assists: 0,
    });
    expect(factors.difficulty).toBe(0.85);
    expect(factors.expectancy).toBe(0.9);
    expect(factors.quality).toBe(0.85);
    expect(factors.goals).toBe(1.075);
    expect(
      playerMatchRating({
        peerAverage: 7,
        goals: 2,
        assists: 0,
        isMvp: true,
        won: true,
        factors,
      }),
    ).toBe(10.5);
  });

  it("does not apply the blowout penalty vs a stronger side", () => {
    const factors = fantasyRatingFactors({
      won: true,
      ownGoals: 4,
      oppGoals: 0,
      ownAvgVm: 10,
      oppAvgVm: 20,
      playerVm: 12,
      participantVms: [10, 12, 18, 20],
      goals: 1,
      assists: 0,
    });
    expect(factors.difficulty).toBe(1);
    expect(factors.expectancy).toBe(1.15);
    expect(factors.quality).toBe(1.15);
  });

  it("cuts expensive players and boosts cheap ones continuously", () => {
    const expensive = fantasyRatingFactors({
      won: false,
      ownGoals: 1,
      oppGoals: 1,
      ownAvgVm: 18,
      oppAvgVm: 18,
      playerVm: 28,
      participantVms: [10, 12, 18, 28],
      goals: 0,
      assists: 0,
    });
    expect(expensive.quality).toBe(0.85);
    expect(
      playerMatchRating({
        peerAverage: 8,
        goals: 0,
        assists: 0,
        isMvp: false,
        won: false,
        factors: expensive,
      }),
    ).toBe(6.8);

    const cheap = fantasyRatingFactors({
      won: false,
      ownGoals: 1,
      oppGoals: 1,
      ownAvgVm: 18,
      oppAvgVm: 18,
      playerVm: 10,
      participantVms: [10, 12, 18, 28],
      goals: 0,
      assists: 0,
    });
    expect(cheap.quality).toBe(1.15);
    expect(
      playerMatchRating({
        peerAverage: 8,
        goals: 0,
        assists: 0,
        isMvp: false,
        won: false,
        factors: cheap,
      }),
    ).toBe(9.2);
  });

  it("rewards the lone scorer in a 1–0", () => {
    const factors = fantasyRatingFactors({
      won: true,
      ownGoals: 1,
      oppGoals: 0,
      ownAvgVm: 16,
      oppAvgVm: 16,
      playerVm: 14,
      participantVms: [12, 14, 16, 18],
      goals: 1,
      assists: 0,
    });
    expect(factors.difficulty).toBe(1);
    expect(factors.expectancy).toBe(1);
    expect(factors.quality).toBeCloseTo(15 / 14);
    expect(factors.goals).toBe(1.15);
    expect(
      playerMatchRating({
        peerAverage: 6,
        goals: 1,
        assists: 0,
        isMvp: false,
        won: true,
        factors,
      }),
    ).toBe(11.1);
  });

  it("is about 1 when the player sits at the match average VM", () => {
    const factors = fantasyRatingFactors({
      won: false,
      ownGoals: 1,
      oppGoals: 1,
      ownAvgVm: 16,
      oppAvgVm: 16,
      playerVm: 16,
      participantVms: [12, 14, 16, 18, 20],
      goals: 0,
      assists: 0,
    });
    expect(factors.quality).toBeCloseTo(1);
  });
});

describe("validateGoalTotal", () => {
  it("compares reported goals to the persisted match total", () => {
    expect(validateGoalTotal([2, 1], 3)).toEqual({
      isValid: true,
      reportedTotal: 3,
      difference: 0,
    });
    expect(validateGoalTotal([2, 2], 3).isValid).toBe(false);
    const sevenVsSix = validateGoalTotal([3, 2, 1], 7);
    expect(sevenVsSix.isValid).toBe(false);
    expect(sevenVsSix.reportedTotal).toBe(6);
    expect(sevenVsSix.difference).toBe(-1);
  });
});

describe("statsSubmissionState", () => {
  const players = [1, 2, 3];
  const sides = [
    { key: "a", playerIds: [1, 2], teamGoals: 2 },
    { key: "b", playerIds: [3], teamGoals: 1 },
  ];

  it("is pending until every participant has submitted", () => {
    const status = statsSubmissionState({
      participantPlayerIds: players,
      reports: [{ playerId: 1, goals: 2 }],
      sides,
    });
    expect(status.state).toBe("pending");
    expect(status.complete).toBe(false);
    expect(status.canScore).toBe(false);
    expect(status.pendingPlayerIds).toEqual([2, 3]);
  });

  it("is validated when each side is within its score cap", () => {
    const status = statsSubmissionState({
      participantPlayerIds: players,
      reports: [
        { playerId: 1, goals: 2, assists: 0 },
        { playerId: 2, goals: 0, assists: 1 },
        { playerId: 3, goals: 1, assists: 0 },
      ],
      sides,
    });
    expect(status.state).toBe("validated");
    expect(status.consistent).toBe(true);
    expect(status.canScore).toBe(true);
    expect(status.reportedTotal).toBe(3);
  });

  it("allows under-reporting on a side", () => {
    const status = statsSubmissionState({
      participantPlayerIds: players,
      reports: [
        { playerId: 1, goals: 1, assists: 0 },
        { playerId: 2, goals: 0, assists: 0 },
        { playerId: 3, goals: 0, assists: 0 },
      ],
      sides,
    });
    expect(status.state).toBe("validated");
    expect(status.canScore).toBe(true);
  });

  it("rejects assists that exceed that side's score", () => {
    const status = statsSubmissionState({
      participantPlayerIds: players,
      reports: [
        { playerId: 1, goals: 1, assists: 3 },
        { playerId: 2, goals: 0, assists: 0 },
        { playerId: 3, goals: 1, assists: 0 },
      ],
      sides,
    });
    expect(status.state).toBe("inconsistent");
    expect(status.assistsOk).toBe(false);
    expect(status.canScore).toBe(false);
  });

  it("rejects three goals on a two-goal side and does not unlock via acknowledgement", () => {
    const mismatch = statsSubmissionState({
      participantPlayerIds: players,
      reports: [
        { playerId: 1, goals: 2 },
        { playerId: 2, goals: 1 },
        { playerId: 3, goals: 1 },
      ],
      sides,
      acknowledged: true,
    });
    expect(mismatch.state).toBe("inconsistent");
    expect(mismatch.canScore).toBe(false);
    expect(mismatch.sides.find((side) => side.key === "a")?.goalsOk).toBe(false);
  });
});

describe("manager scoring", () => {
  it("adds the captain's player points a second time", () => {
    expect(
      managerMatchPoints({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        playerPointsById: { 1: 8, 2: 3, 3: 0, 4: 2, 5: 6 },
      }),
    ).toBe(27);
  });

  it("gives the manager 10 from a captained 5-point player and leaves player points at 5", () => {
    expect(playerPointsFromStats({ goals: 2, assists: 1 })).toBe(5);
    expect(
      managerMatchPoints({
        playerIds: [1],
        captainId: 1,
        playerPointsById: { 1: 5 },
      }),
    ).toBe(10);
    expect(
      managerMatchPoints({
        playerIds: [1],
        captainId: 99,
        playerPointsById: { 1: 5 },
      }),
    ).toBe(5);
  });

  it("scores a missing lineup as zero without inventing one", () => {
    expect(
      scoreManagerLineup({
        lineup: null,
        participantIds: [1, 2, 3, 4, 5],
        playerPointsById: { 1: 8, 2: 3, 3: 0, 4: 2, 5: 6 },
      }),
    ).toEqual({ points: 0, status: "missing", violations: [] });
  });

  it("scores an invalid stored lineup as zero and reports the broken rule", () => {
    const result = scoreManagerLineup({
      lineup: { playerIds: [1, 2, 3, 4], captainId: 1 },
      participantIds: [1, 2, 3, 4, 5],
      playerPointsById: { 1: 8, 2: 3, 3: 0, 4: 2, 5: 6 },
    });
    expect(result.points).toBe(0);
    expect(result.status).toBe("invalid");
    expect(result.violations[0].code).toBe("LINEUP_SIZE");
  });
});
