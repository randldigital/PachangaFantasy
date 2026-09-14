export type ValuationTier = "S" | "A" | "B" | "C" | "D";
export type ValuationStar = 1 | 2 | 3 | 4 | 5;

export const VALUATION_TIERS: ValuationTier[] = ["S", "A", "B", "C", "D"];
export const VALUATION_STARS: ValuationStar[] = [1, 2, 3, 4, 5];

export const TIER_VALUES: Record<ValuationTier, number> = {
  S: 30,
  A: 24,
  B: 18,
  C: 12,
  D: 8,
};

export const STAR_TO_TIER: Record<ValuationStar, ValuationTier> = {
  5: "S",
  4: "A",
  3: "B",
  2: "C",
  1: "D",
};

export const TIER_TO_STAR: Record<ValuationTier, ValuationStar> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

export function starFromTier(tier: ValuationTier): ValuationStar {
  return TIER_TO_STAR[tier];
}

export function tierFromStar(star: number): ValuationTier | null {
  if (star === 1 || star === 2 || star === 3 || star === 4 || star === 5) {
    return STAR_TO_TIER[star];
  }
  return null;
}

export const DEFAULT_MARKET_VALUE = TIER_VALUES.B;

export interface PlayerTierPlacement {
  playerId: number;
  tier: ValuationTier;
}

export function trimmedAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const working = [...values];
  if (working.length > 2) {
    working.sort((a, b) => a - b);
    working.splice(0, 1);
    working.pop();
  }
  return working.reduce((sum, value) => sum + value, 0) / working.length;
}

export function normalizeTierPlacements(
  placements: PlayerTierPlacement[],
  playerIds: number[],
): PlayerTierPlacement[] {
  const validIds = new Set(playerIds);
  const byPlayer = new Map<number, ValuationTier>();
  for (const placement of placements) {
    if (!validIds.has(placement.playerId) || !(placement.tier in TIER_VALUES)) {
      continue;
    }
    byPlayer.set(placement.playerId, placement.tier);
  }
  return [...byPlayer.entries()].map(([playerId, tier]) => ({ playerId, tier }));
}

/** True when every player has a tier. Submit does not require this — skipped votes are omitted. */
export function isValuationComplete(
  playerIds: number[],
  placements: PlayerTierPlacement[],
): boolean {
  if (playerIds.length === 0) {
    return false;
  }
  const placed = new Set(
    normalizeTierPlacements(placements, playerIds).map((placement) => placement.playerId),
  );
  return playerIds.every((playerId) => placed.has(playerId));
}

export function marketValuesFromTierSubmissions(
  playerIds: number[],
  submissions: PlayerTierPlacement[][],
): Map<number, number> {
  const votes = new Map<number, number[]>();

  for (const submission of submissions) {
    for (const placement of submission) {
      const value = TIER_VALUES[placement.tier];
      if (value === undefined) {
        continue;
      }
      const list = votes.get(placement.playerId) ?? [];
      list.push(value);
      votes.set(placement.playerId, list);
    }
  }

  const values = new Map<number, number>();
  for (const playerId of playerIds) {
    const playerVotes = votes.get(playerId) ?? [];
    if (playerVotes.length === 0) {
      values.set(playerId, DEFAULT_MARKET_VALUE);
    } else {
      values.set(playerId, Math.round(trimmedAverage(playerVotes)));
    }
  }
  return values;
}

export function lineupCostFromValues(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}
