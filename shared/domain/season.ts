/**
 * A season runs 1 August 00:00 to 31 July 23:59 of the following year.
 * The label is `YYYY/YY` of the August start, e.g. 1 Aug 2026 – 31 Jul 2027 is `2026/27`.
 */

export const SEASON_START_MONTH = 7; // August, zero-based

export type SeasonKey = string;

function startYearOf(date: Date): number {
  return date.getMonth() >= SEASON_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
}

export function seasonKeyFromStartYear(startYear: number): SeasonKey {
  const endYear = (startYear + 1) % 100;
  return `${startYear}/${String(endYear).padStart(2, "0")}`;
}

export function seasonOf(date: Date | string | number): SeasonKey {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    throw new Error("seasonOf requires a valid date");
  }
  return seasonKeyFromStartYear(startYearOf(value));
}

export function currentSeasonKey(now: Date = new Date()): SeasonKey {
  return seasonOf(now);
}

export function isSeasonKey(value: unknown): value is SeasonKey {
  return typeof value === "string" && /^\d{4}\/\d{2}$/.test(value);
}

export function seasonStartYear(key: SeasonKey): number {
  return Number(key.slice(0, 4));
}

export function seasonRange(key: SeasonKey): { start: Date; end: Date } {
  const startYear = seasonStartYear(key);
  return {
    start: new Date(startYear, SEASON_START_MONTH, 1, 0, 0, 0, 0),
    end: new Date(startYear + 1, SEASON_START_MONTH, 1, 0, 0, 0, -1),
  };
}

/** Newest season first. */
export function sortSeasonKeysDescending(keys: SeasonKey[]): SeasonKey[] {
  return [...new Set(keys)].sort((left, right) => seasonStartYear(right) - seasonStartYear(left));
}

export function groupBySeason<T>(
  items: T[],
  seasonKeyOf: (item: T) => SeasonKey,
): { season: SeasonKey; items: T[] }[] {
  const buckets = new Map<SeasonKey, T[]>();
  for (const item of items) {
    const key = seasonKeyOf(item);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return sortSeasonKeysDescending([...buckets.keys()]).map((season) => ({
    season,
    items: buckets.get(season) ?? [],
  }));
}
