import { describe, expect, it } from "vitest";
import { lineupCanSave } from "@shared/domain/lineup";
import {
  DEFAULT_MARKET_VALUE,
  TIER_VALUES,
  isValuationComplete,
  lineupCostFromValues,
  marketValuesFromTierSubmissions,
  trimmedAverage,
  type PlayerTierPlacement,
} from "@shared/domain/valuation";

function tiers(
  entries: Array<[number, PlayerTierPlacement["tier"]]>,
): PlayerTierPlacement[] {
  return entries.map(([playerId, tier]) => ({ playerId, tier }));
}

describe("valuation", () => {
  it("maps S/A/B/C/D to 30/24/18/12/8", () => {
    expect(TIER_VALUES).toEqual({ S: 30, A: 24, B: 18, C: 12, D: 8 });
    expect(DEFAULT_MARKET_VALUE).toBe(18);
  });

  it("uses a trimmed mean when a player has more than two votes", () => {
    const values = marketValuesFromTierSubmissions(
      [1],
      [tiers([[1, "S"]]), tiers([[1, "S"]]), tiers([[1, "D"]])],
    );
    expect(values.get(1)).toBe(30);
  });

  it("averages without dropping outliers when there are at most two votes", () => {
    const values = marketValuesFromTierSubmissions(
      [1],
      [tiers([[1, "S"]]), tiers([[1, "D"]])],
    );
    expect(values.get(1)).toBe(19);
  });

  it("gives unranked players B (18)", () => {
    const values = marketValuesFromTierSubmissions([1, 2], [tiers([[1, "S"]])]);
    expect(values.get(1)).toBe(30);
    expect(values.get(2)).toBe(18);
  });

  it("gives a single player 18 when nobody voted", () => {
    const values = marketValuesFromTierSubmissions([1], []);
    expect(values.get(1)).toBe(18);
  });

  it("gives a single player the average of their votes", () => {
    const values = marketValuesFromTierSubmissions([1], [tiers([[1, "A"]])]);
    expect(values.get(1)).toBe(24);
  });

  it("treats five B as 90 and five S as 150", () => {
    expect(lineupCostFromValues([18, 18, 18, 18, 18])).toBe(90);
    expect(lineupCostFromValues([30, 30, 30, 30, 30])).toBe(150);

    const bPlayers = [1, 2, 3, 4, 5].map((id) => ({ id, marketValue: TIER_VALUES.B }));
    const sPlayers = [1, 2, 3, 4, 5].map((id) => ({ id, marketValue: TIER_VALUES.S }));

    expect(
      lineupCanSave({ playerIds: [1, 2, 3, 4, 5], captainId: 1, budget: 100, players: bPlayers }),
    ).toBe(true);
    expect(
      lineupCanSave({ playerIds: [1, 2, 3, 4, 5], captainId: 1, budget: 100, players: sPlayers }),
    ).toBe(false);
  });

  it("requires every player to be placed for a complete valuation", () => {
    expect(isValuationComplete([1, 2], tiers([[1, "B"]]))).toBe(false);
    expect(isValuationComplete([1, 2], tiers([[1, "B"], [2, "S"]]))).toBe(true);
    expect(isValuationComplete([], [])).toBe(false);
  });

  it("returns 0 for an empty trimmed average", () => {
    expect(trimmedAverage([])).toBe(0);
  });
});
