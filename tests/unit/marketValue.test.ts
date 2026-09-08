import { describe, expect, it } from "vitest";
import {
  applyMarketValueChange,
  expectedContribution,
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
  it("matches the table endpoints D=0 and S≈33%", () => {
    expect(expectedContribution(8)).toBe(0);
    expect(expectedContribution(28)).toBeCloseTo(0.33);
    expect(expectedContribution(18)).toBeCloseTo(0.165);
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
  it("gives a D-tier player +5 at MVP-level 0.75+", () => {
    const first = applyMarketValueChange(8, 0.75);
    expect(first.rawChange).toBe(5);
    expect(first.multiplier).toBe(1);
    expect(first.vmAfter).toBe(13);
  });

  it("reaches about 18 VM after two MVP-level matches from 8", () => {
    const first = applyMarketValueChange(8, 1);
    expect(first.vmAfter).toBe(13);
    const second = applyMarketValueChange(first.vmAfter, 1);
    expect(second.vmAfter).toBe(18);
  });

  it("gives high-VM players little upside and full downside", () => {
    expect(vmPositionX(28)).toBe(1);
    const up = applyMarketValueChange(28, 1);
    expect(up.multiplier).toBeCloseTo(0.35);
    expect(up.delta).toBeLessThanOrEqual(4);
    const down = applyMarketValueChange(28, 0);
    expect(down.multiplier).toBeCloseTo(1);
    expect(down.delta).toBe(-3);
  });

  it("limits low-VM downside", () => {
    const down = applyMarketValueChange(8, 0);
    expect(down.multiplier).toBeCloseTo(0.35);
    expect(down.vmAfter).toBe(8);
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
