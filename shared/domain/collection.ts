/**
 * Collection rules. Definitions are minted from official scored matches.
 * Rendering, ownership writes, and image files live elsewhere.
 */

import { mvpPlayerIds } from "./scoring";
import { seasonOf } from "./season";

export const COLLECTION_TIMEZONE = "Europe/Madrid";
export const PACK_SIZE = 2;
export const PACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const HAT_TRICK_GOALS = 3;
export const TOTM_SIZE = 5;
export const ALBUM_PAGE_SIZE = 48;

export const CARD_TYPES = ["player", "match", "mvp", "hattrick", "totm", "extra"] as const;
export const CARD_RARITIES = ["common", "rare", "epic", "legendary"] as const;
export const CARD_STATUSES = ["active", "error", "retired"] as const;

export type CardType = (typeof CARD_TYPES)[number];
export type CardRarity = (typeof CARD_RARITIES)[number];
export type CardStatus = (typeof CARD_STATUSES)[number];

/** Weights are relative. The picker renormalizes over rarities that have an active card. */
export const PACK_WEIGHTS: Record<CardRarity, number> = {
  common: 70,
  rare: 22,
  epic: 7,
  legendary: 1,
};

const TYPE_RARITY: Record<Exclude<CardType, "extra">, CardRarity> = {
  player: "common",
  match: "common",
  mvp: "rare",
  hattrick: "epic",
  totm: "rare",
};

const TYPE_RANK: Record<CardType, number> = {
  player: 0,
  match: 1,
  mvp: 2,
  hattrick: 3,
  totm: 4,
  extra: 5,
};

export function isCardType(value: unknown): value is CardType {
  return typeof value === "string" && (CARD_TYPES as readonly string[]).includes(value);
}

export function isCardRarity(value: unknown): value is CardRarity {
  return typeof value === "string" && (CARD_RARITIES as readonly string[]).includes(value);
}

export function isCardStatus(value: unknown): value is CardStatus {
  return typeof value === "string" && (CARD_STATUSES as readonly string[]).includes(value);
}

export function rarityForType(type: Exclude<CardType, "extra">): CardRarity {
  return TYPE_RARITY[type];
}

export function sortRankFor(type: CardType): number {
  return TYPE_RANK[type];
}

export function playerSourceKey(playerId: number): string {
  return `player:${playerId}`;
}

export function matchSourceKey(matchId: number): string {
  return `match:${matchId}`;
}

export function mvpSourceKey(matchId: number, playerId: number): string {
  return `mvp:${matchId}:${playerId}`;
}

export function hatTrickSourceKey(matchId: number, playerId: number): string {
  return `hattrick:${matchId}:${playerId}`;
}

export function totmSourceKey(month: string, matchId: number, playerId: number): string {
  return `totm:${month}:${matchId}:${playerId}`;
}

export function extraSourceKey(id: string): string {
  return `extra:${id}`;
}

/** Owned invalidated facts stay as error. Unowned ones are removed. Error is never cleared. */
export function invalidationAction(ownerCount: number): "delete" | "error" {
  return ownerCount > 0 ? "error" : "delete";
}

export type MatchFactInput = {
  id: number;
  isFriendly?: boolean | null;
  status?: string | null;
  date: Date | string;
  seasonKey?: string | null;
  leagueId?: number | null;
  clubId?: number | null;
  teamAGoals?: number | null;
  teamBGoals?: number | null;
  ourGoals?: number | null;
  opponentGoals?: number | null;
  opponentName?: string | null;
};

export type FactCandidate = {
  sourceKey: string;
  cardType: CardType;
  rarity: CardRarity;
  playerId: number | null;
  matchId: number | null;
  seasonKey: string | null;
  occurredAt: Date;
  periodKey: string | null;
  payload: Record<string, unknown>;
};

export function isOfficialScored(match: { isFriendly?: boolean | null; status?: string | null }): boolean {
  if (match.isFriendly) {
    return false;
  }
  return match.status === "scored" || match.status === "closed";
}

function occurredAt(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

function seasonKeyOf(match: MatchFactInput): string {
  return match.seasonKey ?? seasonOf(match.date);
}

function scorePayload(match: MatchFactInput): Record<string, unknown> {
  if (match.clubId != null) {
    return {
      ourGoals: match.ourGoals ?? null,
      opponentGoals: match.opponentGoals ?? null,
      opponentName: match.opponentName ?? null,
    };
  }
  return {
    teamAGoals: match.teamAGoals ?? null,
    teamBGoals: match.teamBGoals ?? null,
  };
}

export function playerFact(player: { id: number; createdAt?: Date | string | null }): FactCandidate {
  return {
    sourceKey: playerSourceKey(player.id),
    cardType: "player",
    rarity: rarityForType("player"),
    playerId: player.id,
    matchId: null,
    seasonKey: null,
    occurredAt: player.createdAt ? occurredAt(player.createdAt) : new Date(0),
    periodKey: null,
    payload: { playerId: player.id },
  };
}

/**
 * Match, MVP, and hat-trick cards for one match.
 * `stats` must already be limited to accepted participants.
 * Friendly and unfinished matches yield nothing.
 */
export function matchFactCards(
  match: MatchFactInput,
  stats: { playerId: number; goals?: number | null }[],
  votes: { mvpPlayerId: number }[],
): FactCandidate[] {
  if (!isOfficialScored(match)) {
    return [];
  }
  const when = occurredAt(match.date);
  const seasonKey = seasonKeyOf(match);
  const cards: FactCandidate[] = [
    {
      sourceKey: matchSourceKey(match.id),
      cardType: "match",
      rarity: rarityForType("match"),
      playerId: null,
      matchId: match.id,
      seasonKey,
      occurredAt: when,
      periodKey: null,
      payload: { matchId: match.id, ...scorePayload(match) },
    },
  ];
  for (const playerId of mvpPlayerIds(votes)) {
    cards.push({
      sourceKey: mvpSourceKey(match.id, playerId),
      cardType: "mvp",
      rarity: rarityForType("mvp"),
      playerId,
      matchId: match.id,
      seasonKey,
      occurredAt: when,
      periodKey: null,
      payload: { matchId: match.id, playerId, ...scorePayload(match) },
    });
  }
  for (const stat of stats) {
    const goals = stat.goals ?? 0;
    if (goals < HAT_TRICK_GOALS) {
      continue;
    }
    cards.push({
      sourceKey: hatTrickSourceKey(match.id, stat.playerId),
      cardType: "hattrick",
      rarity: rarityForType("hattrick"),
      playerId: stat.playerId,
      matchId: match.id,
      seasonKey,
      occurredAt: when,
      periodKey: null,
      payload: { matchId: match.id, playerId: stat.playerId, goals, ...scorePayload(match) },
    });
  }
  return cards;
}

export type TotmPerformance = {
  playerId: number;
  matchId: number;
  performanceScore: number;
  mvp: number;
  goals: number;
  occurredAt: Date;
  seasonKey: string | null;
};

/** Negative when `left` should rank above `right`. */
export function compareTotm(left: TotmPerformance, right: TotmPerformance): number {
  if (left.performanceScore !== right.performanceScore) {
    return right.performanceScore - left.performanceScore;
  }
  if (left.mvp !== right.mvp) {
    return right.mvp - left.mvp;
  }
  if (left.goals !== right.goals) {
    return right.goals - left.goals;
  }
  if (left.playerId !== right.playerId) {
    return left.playerId - right.playerId;
  }
  return left.matchId - right.matchId;
}

/** At most five players. Each player contributes only their best performance. */
export function selectTotm(rows: TotmPerformance[]): TotmPerformance[] {
  const best = new Map<number, TotmPerformance>();
  for (const row of rows) {
    const current = best.get(row.playerId);
    if (!current || compareTotm(row, current) < 0) {
      best.set(row.playerId, row);
    }
  }
  return [...best.values()].sort(compareTotm).slice(0, TOTM_SIZE);
}

export function totmFacts(month: string, selected: TotmPerformance[]): FactCandidate[] {
  return selected.map((row, index) => ({
    sourceKey: totmSourceKey(month, row.matchId, row.playerId),
    cardType: "totm" as const,
    rarity: rarityForType("totm"),
    playerId: row.playerId,
    matchId: row.matchId,
    seasonKey: row.seasonKey,
    occurredAt: row.occurredAt,
    periodKey: `totm:${month}`,
    payload: {
      month,
      rank: index + 1,
      performanceScore: row.performanceScore,
      matchId: row.matchId,
      playerId: row.playerId,
    },
  }));
}

export type PackChoice = {
  id: number;
  rarity: CardRarity;
  status?: CardStatus;
};

export type PackDraw =
  | { ok: true; cardIds: number[] }
  | { ok: false; reason: "empty" };

/**
 * Two cards from active definitions. Unowned active cards of the rolled rarity
 * are preferred. A card chosen earlier in the same pack counts as owned.
 */
export function pickPack(input: {
  cards: PackChoice[];
  ownedIds: Iterable<number>;
  random?: () => number;
}): PackDraw {
  const active = input.cards.filter((card) => (card.status ?? "active") === "active");
  if (active.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const random = input.random ?? Math.random;
  const owned = new Set(input.ownedIds);
  const cardIds: number[] = [];
  for (let slot = 0; slot < PACK_SIZE; slot += 1) {
    const rarity = rollRarity(active, random);
    const pool = active.filter((card) => card.rarity === rarity);
    const unowned = pool.filter((card) => !owned.has(card.id));
    const source = unowned.length > 0 ? unowned : pool;
    const index = Math.min(source.length - 1, Math.floor(random() * source.length));
    const chosen = source[index];
    cardIds.push(chosen.id);
    owned.add(chosen.id);
  }
  return { ok: true, cardIds };
}

export function rollRarity(cards: { rarity: CardRarity }[], random: () => number): CardRarity {
  const present = CARD_RARITIES.filter((rarity) => cards.some((card) => card.rarity === rarity));
  const weights = present.map((rarity) => PACK_WEIGHTS[rarity]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let ticket = random() * total;
  for (let index = 0; index < present.length; index += 1) {
    ticket -= weights[index];
    if (ticket < 0) {
      return present[index];
    }
  }
  return present[present.length - 1];
}

function zoneParts(instant: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  let hour = Number(map.hour);
  if (hour === 24) {
    hour = 0;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = zoneParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** UTC instant of a civil midnight in the collection timezone. */
export function zonedMidnightUtc(year: number, month: number, day: number, timeZone = COLLECTION_TIMEZONE): Date {
  let utc = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = zoneOffsetMinutes(new Date(utc), timeZone);
    const next = Date.UTC(year, month - 1, day, 0, 0, 0) - offset * 60_000;
    if (next === utc) {
      break;
    }
    utc = next;
  }
  return new Date(utc);
}

export function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonth(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

export function monthKey(date: Date, timeZone = COLLECTION_TIMEZONE): string {
  const parts = zoneParts(date, timeZone);
  return formatMonth(parts.year, parts.month);
}

export function monthBefore(key: string): string {
  const { year, month } = parseMonth(key);
  if (month === 1) {
    return formatMonth(year - 1, 12);
  }
  return formatMonth(year, month - 1);
}

export function monthAfter(key: string): string {
  const { year, month } = parseMonth(key);
  if (month === 12) {
    return formatMonth(year + 1, 1);
  }
  return formatMonth(year, month + 1);
}

export function previousMonthKey(now: Date = new Date(), timeZone = COLLECTION_TIMEZONE): string {
  return monthBefore(monthKey(now, timeZone));
}

export function compareMonthKeys(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function monthKeysFromThrough(start: string, endInclusive: string): string[] {
  if (compareMonthKeys(start, endInclusive) > 0) {
    return [];
  }
  const keys: string[] = [];
  let cursor = start;
  while (compareMonthKeys(cursor, endInclusive) <= 0) {
    keys.push(cursor);
    cursor = monthAfter(cursor);
  }
  return keys;
}

export function monthRangeUtc(key: string, timeZone = COLLECTION_TIMEZONE): { start: Date; end: Date } {
  const { year, month } = parseMonth(key);
  const next = monthAfter(key);
  const nextParts = parseMonth(next);
  return {
    start: zonedMidnightUtc(year, month, 1, timeZone),
    end: zonedMidnightUtc(nextParts.year, nextParts.month, 1, timeZone),
  };
}
