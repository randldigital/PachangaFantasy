import { describe, expect, it } from "vitest";
import {
  applyMarketValueChange,
  expectedContribution,
  computeClubMatchMarketValues,
  computeMatchMarketValues,
  mapPeerRating,
  nextScoringBaseline,
  opponentDifficulty,
  offensiveComponent,
  resultComponent,
  vmPositionX,
} from "@shared/domain/marketValue";

describe("mapPeerRating", () => {
  it("maps 0.0–10.0 scores onto 0–1", () => {
    expect(mapPeerRating(0)).toBe(0);
    expect(mapPeerRating(5)).toBe(0.5);
    expect(mapPeerRating(10)).toBe(1);
  });
});

describe("expectedContribution", () => {
  it("matches the table endpoints D=0 and S≈33% at the soft saturation VM", () => {
    expect(expectedContribution(8)).toBe(0);
    expect(expectedContribution(28)).toBeCloseTo(0.33);
    expect(expectedContribution(18)).toBeCloseTo(0.165);
    // Above saturation, expectancy stays capped even though VM can keep rising.
    expect(expectedContribution(40)).toBeCloseTo(0.33);
  });
});

describe("opponentDifficulty", () => {
  it("clamps relative team strength to ±10%", () => {
    expect(opponentDifficulty(20, 20)).toBe(1);
    expect(opponentDifficulty(10, 20)).toBe(1.1);
    expect(opponentDifficulty(20, 10)).toBe(0.9);
  });
});

describe("offensiveComponent", () => {
  it("is neutral at expected output and caps at 2×", () => {
    expect(offensiveComponent(0.2, 0.2)).toBe(0.5);
    expect(offensiveComponent(0.4, 0.2)).toBe(1);
    expect(offensiveComponent(0, 0.2)).toBe(0);
    expect(offensiveComponent(0, 0)).toBe(0.5);
  });
});

describe("resultComponent", () => {
  it("rewards beating a stronger side more than a weaker one", () => {
    const beatStronger = resultComponent(2, 1, 12, 24);
    const beatWeaker = resultComponent(2, 1, 24, 12);
    expect(beatStronger).toBeGreaterThan(beatWeaker);
    expect(beatWeaker).toBeGreaterThanOrEqual(0.55);
  });

  it("hurts less when losing to a stronger side", () => {
    const lostToStronger = resultComponent(1, 2, 12, 24);
    const lostToWeaker = resultComponent(1, 2, 24, 12);
    expect(lostToStronger).toBeGreaterThan(lostToWeaker);
  });
});

describe("applyMarketValueChange", () => {
  it("gives a D-tier player upside at strong performances", () => {
    const first = applyMarketValueChange(8, 0.75);
    expect(first.multiplier).toBe(1);
    expect(first.vmAfter).toBeGreaterThan(8);
  });

  it("lets VM climb past the old 28 ceiling when stars keep delivering", () => {
    let vm = 28;
    for (let i = 0; i < 4; i += 1) {
      vm = applyMarketValueChange(vm, 1, { mvp: 1, peer: 0.9, lost: false }).vmAfter;
    }
    expect(vm).toBeGreaterThan(28);
  });

  it("adds a star bonus when MVP=1 and peer is high", () => {
    const plain = applyMarketValueChange(18, 0.93);
    const starred = applyMarketValueChange(18, 0.93, { mvp: 1, peer: 0.86 });
    expect(starred.delta).toBe(plain.delta + 1);
  });

  it("applies elite-loss floor of -1 at VM ≥ 28", () => {
    const change = applyMarketValueChange(30, 0.55, { lost: true, mvp: 0.35, peer: 0.8 });
    expect(change.delta).toBe(-1);
    expect(change.vmAfter).toBe(29);
  });

  it("limits low-VM downside via deadzone and soft loss multiplier", () => {
    const down = applyMarketValueChange(8, 0);
    expect(down.multiplier).toBeCloseTo(0.1);
    expect(down.vmAfter).toBe(8);
    expect(down.delta).toBe(0);
  });

  it("keeps half-point VM steps", () => {
    const change = applyMarketValueChange(20, 0.35);
    expect(change.vmAfter * 2).toBe(Math.round(change.vmAfter * 2));
  });
});

describe("nextScoringBaseline", () => {
  it("moves 20% toward the match average goals per team", () => {
    expect(nextScoringBaseline(5, 4, 6)).toBe(5);
    expect(nextScoringBaseline(5, 10, 10)).toBe(6);
  });
});

describe("computeMatchMarketValues", () => {
  it("keeps points-independent VM math replayable from the same inputs", () => {
    const input = {
      participantIds: [1, 2],
      teamA: [1],
      teamB: [2],
      teamAGoals: 2,
      teamBGoals: 0,
      baseline: 5,
      preMatchVm: { 1: 8, 2: 18 },
      stats: [
        { playerId: 1, goals: 2, assists: 0 },
        { playerId: 2, goals: 0, assists: 0 },
      ],
      mvpVotes: [{ voterPlayerId: 2, mvpPlayerId: 1 }],
      peerRatings: [
        { raterPlayerId: 2, rateePlayerId: 1, score: 10 },
        { raterPlayerId: 1, rateePlayerId: 2, score: 5 },
      ],
    };
    const first = computeMatchMarketValues(input);
    const again = computeMatchMarketValues(input);
    expect(first).toEqual(again);
    expect(first.find((row) => row.playerId === 1)?.change.vmAfter).toBeGreaterThan(8);
  });
});

describe("Gazpachangas match 12 calibration", () => {
  const teamA = [42, 13, 40, 12, 20];
  const teamB = [15, 16, 22, 45, 28];
  const input = {
    participantIds: [...teamA, ...teamB],
    teamA,
    teamB,
    teamAGoals: 6,
    teamBGoals: 9,
    baseline: 5,
    preMatchVm: {
      12: 17,
      13: 22,
      15: 25,
      16: 24,
      20: 16,
      22: 22,
      28: 12,
      40: 20,
      42: 30,
      45: 18,
    },
    stats: [
      { playerId: 12, goals: 1, assists: 1 },
      { playerId: 13, goals: 1, assists: 0 },
      { playerId: 15, goals: 3, assists: 2 },
      { playerId: 16, goals: 1, assists: 0 },
      { playerId: 20, goals: 0, assists: 2 },
      { playerId: 22, goals: 2, assists: 2 },
      { playerId: 28, goals: 1, assists: 1 },
      { playerId: 40, goals: 0, assists: 0 },
      { playerId: 42, goals: 3, assists: 1 },
      { playerId: 45, goals: 2, assists: 2 },
    ],
    mvpVotes: [
      { voterPlayerId: 12, mvpPlayerId: 15 },
      { voterPlayerId: 13, mvpPlayerId: 45 },
      { voterPlayerId: 15, mvpPlayerId: 22 },
      { voterPlayerId: 16, mvpPlayerId: 45 },
      { voterPlayerId: 20, mvpPlayerId: 45 },
      { voterPlayerId: 22, mvpPlayerId: 15 },
      { voterPlayerId: 28, mvpPlayerId: 16 },
      { voterPlayerId: 40, mvpPlayerId: 15 },
      { voterPlayerId: 42, mvpPlayerId: 16 },
    ],
    peerRatings: [
      { raterPlayerId: 12, rateePlayerId: 16, score: 8 },
      { raterPlayerId: 12, rateePlayerId: 20, score: 4 },
      { raterPlayerId: 12, rateePlayerId: 28, score: 7.1 },
      { raterPlayerId: 12, rateePlayerId: 42, score: 8.6 },
      { raterPlayerId: 13, rateePlayerId: 12, score: 5 },
      { raterPlayerId: 13, rateePlayerId: 15, score: 6.5 },
      { raterPlayerId: 13, rateePlayerId: 16, score: 6.5 },
      { raterPlayerId: 13, rateePlayerId: 40, score: 7 },
      { raterPlayerId: 13, rateePlayerId: 45, score: 7.5 },
      { raterPlayerId: 15, rateePlayerId: 13, score: 6 },
      { raterPlayerId: 15, rateePlayerId: 20, score: 6 },
      { raterPlayerId: 15, rateePlayerId: 28, score: 6.6 },
      { raterPlayerId: 15, rateePlayerId: 42, score: 7 },
      { raterPlayerId: 15, rateePlayerId: 45, score: 9 },
      { raterPlayerId: 16, rateePlayerId: 13, score: 5.8 },
      { raterPlayerId: 16, rateePlayerId: 22, score: 7.5 },
      { raterPlayerId: 16, rateePlayerId: 40, score: 5 },
      { raterPlayerId: 16, rateePlayerId: 45, score: 9 },
      { raterPlayerId: 20, rateePlayerId: 13, score: 9 },
      { raterPlayerId: 20, rateePlayerId: 16, score: 9 },
      { raterPlayerId: 20, rateePlayerId: 22, score: 10 },
      { raterPlayerId: 20, rateePlayerId: 28, score: 8.9 },
      { raterPlayerId: 20, rateePlayerId: 40, score: 8.5 },
      { raterPlayerId: 22, rateePlayerId: 16, score: 8.5 },
      { raterPlayerId: 22, rateePlayerId: 40, score: 9.8 },
      { raterPlayerId: 22, rateePlayerId: 42, score: 7.9 },
      { raterPlayerId: 22, rateePlayerId: 45, score: 9 },
      { raterPlayerId: 28, rateePlayerId: 12, score: 7.5 },
      { raterPlayerId: 28, rateePlayerId: 15, score: 8.5 },
      { raterPlayerId: 28, rateePlayerId: 20, score: 6.5 },
      { raterPlayerId: 28, rateePlayerId: 22, score: 8 },
      { raterPlayerId: 40, rateePlayerId: 12, score: 5.9 },
      { raterPlayerId: 40, rateePlayerId: 15, score: 7.6 },
      { raterPlayerId: 40, rateePlayerId: 22, score: 7.1 },
      { raterPlayerId: 40, rateePlayerId: 42, score: 8.5 },
      { raterPlayerId: 42, rateePlayerId: 12, score: 6.1 },
      { raterPlayerId: 42, rateePlayerId: 13, score: 6.7 },
      { raterPlayerId: 42, rateePlayerId: 15, score: 7.2 },
      { raterPlayerId: 42, rateePlayerId: 20, score: 5.5 },
      { raterPlayerId: 42, rateePlayerId: 28, score: 6.1 },
    ],
  };

  it("hits the locked post-match ladder", () => {
    const byId = new Map(computeMatchMarketValues(input).map((row) => [row.playerId, row]));
    expect(byId.get(45)?.change).toMatchObject({ vmBefore: 18, vmAfter: 20.5, delta: 2.5 });
    expect(byId.get(15)?.change).toMatchObject({ vmBefore: 25, vmAfter: 26, delta: 1 });
    expect(byId.get(22)?.change).toMatchObject({ vmBefore: 22, vmAfter: 22.5, delta: 0.5 });
    expect(byId.get(28)?.change).toMatchObject({ vmBefore: 12, vmAfter: 13, delta: 1 });
    expect(byId.get(42)?.change).toMatchObject({ vmBefore: 30, vmAfter: 29, delta: -1 });
  });
});

describe("computeClubMatchMarketValues", () => {
  const squad = {
    participantIds: [1, 2, 3],
    ourGoals: 2,
    opponentGoals: 1,
    baseline: 5,
    preMatchVm: { 1: 18, 2: 18, 3: 18 },
    stats: [
      { playerId: 1, goals: 2, assists: 0 },
      { playerId: 2, goals: 0, assists: 1 },
      { playerId: 3, goals: 0, assists: 0 },
    ],
    mvpVotes: [
      { voterPlayerId: 2, mvpPlayerId: 1 },
      { voterPlayerId: 3, mvpPlayerId: 1 },
    ],
    peerRatings: [
      { raterPlayerId: 2, rateePlayerId: 1, score: 9 },
      { raterPlayerId: 3, rateePlayerId: 1, score: 8 },
      { raterPlayerId: 1, rateePlayerId: 2, score: 6 },
    ],
  };

  it("treats the opponent as equal VM so difficulty is 1", () => {
    const rows = computeClubMatchMarketValues(squad);
    expect(rows.every((row) => row.ownTeamAvgVm === row.oppTeamAvgVm)).toBe(true);
    expect(opponentDifficulty(rows[0].ownTeamAvgVm, rows[0].oppTeamAvgVm)).toBe(1);
  });

  it("uses W/D/L at equal VM for the result term", () => {
    const win = computeClubMatchMarketValues(squad);
    const draw = computeClubMatchMarketValues({ ...squad, opponentGoals: 2 });
    const loss = computeClubMatchMarketValues({ ...squad, opponentGoals: 3 });
    expect(win[0].result).toBeCloseTo(resultComponent(2, 1, 18, 18));
    expect(draw[0].result).toBeCloseTo(resultComponent(2, 2, 18, 18));
    expect(loss[0].result).toBeCloseTo(resultComponent(2, 3, 18, 18));
    expect(win[0].result).toBeGreaterThan(draw[0].result);
    expect(draw[0].result).toBeGreaterThan(loss[0].result);
  });
});
