import { describe, expect, it } from "vitest";
import {
  POINTS_PER_ASSIST,
  POINTS_PER_GOAL,
  playerPointsFromStats,
  validateGoalTotal,
  managerMatchPoints,
  scoreManagerLineup,
} from "@shared/domain/scoring";
import { statsSubmissionState } from "@shared/domain/stats";

describe("playerPointsFromStats", () => {
  it("scores goals × 3 and assists × 2 with no win bonus", () => {
    expect(POINTS_PER_GOAL).toBe(3);
    expect(POINTS_PER_ASSIST).toBe(2);
    expect(playerPointsFromStats({ goals: 2, assists: 1 })).toBe(8);
    expect(playerPointsFromStats({ goals: 0, assists: 0 })).toBe(0);
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
  const players = [1, 2];

  it("is pending until every participant has submitted", () => {
    const status = statsSubmissionState({
      participantPlayerIds: players,
      reports: [{ playerId: 1, goals: 2 }],
      expectedGoals: 2,
      acknowledged: false,
    });
    expect(status.state).toBe("pending");
    expect(status.complete).toBe(false);
    expect(status.canScore).toBe(false);
    expect(status.pendingPlayerIds).toEqual([2]);
  });

  it("is validated when complete submissions match the recorded total", () => {
    const status = statsSubmissionState({
      participantPlayerIds: players,
      reports: [
        { playerId: 1, goals: 2, assists: 1 },
        { playerId: 2, goals: 1, assists: 0 },
      ],
      expectedGoals: 3,
      acknowledged: false,
    });
    expect(status.state).toBe("validated");
    expect(status.consistent).toBe(true);
    expect(status.canScore).toBe(true);
    expect(status.reportedTotal).toBe(3);
  });

  it("rejects assists that exceed the match goal total", () => {
    const status = statsSubmissionState({
      participantPlayerIds: players,
      reports: [
        { playerId: 1, goals: 1, assists: 50 },
        { playerId: 2, goals: 1, assists: 50 },
      ],
      expectedGoals: 2,
      acknowledged: false,
    });
    expect(status.state).toBe("inconsistent");
    expect(status.assistsOk).toBe(false);
    expect(status.canScore).toBe(false);
  });

  it("is inconsistent when complete submissions disagree, until acknowledged", () => {
    const mismatch = statsSubmissionState({
      participantPlayerIds: players,
      reports: [
        { playerId: 1, goals: 2 },
        { playerId: 2, goals: 2 },
      ],
      expectedGoals: 3,
      acknowledged: false,
    });
    expect(mismatch.state).toBe("inconsistent");
    expect(mismatch.difference).toBe(1);
    expect(mismatch.canScore).toBe(false);

    const acknowledged = statsSubmissionState({
      participantPlayerIds: players,
      reports: [
        { playerId: 1, goals: 2 },
        { playerId: 2, goals: 2 },
      ],
      expectedGoals: 3,
      acknowledged: true,
    });
    expect(acknowledged.state).toBe("inconsistent");
    expect(acknowledged.canScore).toBe(true);
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

  it("gives the manager 16 from a captained 8-point player and leaves player points at 8", () => {
    expect(playerPointsFromStats({ goals: 2, assists: 1 })).toBe(8);
    expect(
      managerMatchPoints({
        playerIds: [1],
        captainId: 1,
        playerPointsById: { 1: 8 },
      }),
    ).toBe(16);
    expect(
      managerMatchPoints({
        playerIds: [1],
        captainId: 99,
        playerPointsById: { 1: 8 },
      }),
    ).toBe(8);
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
