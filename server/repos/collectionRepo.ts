import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  collectionCards,
  collectionOwnership,
  collectionPackOpenings,
  collectionPackState,
  collectionPeriods,
  collections,
  matchMvpVotes,
  matchParticipants,
  matches,
  playerMarketValueHistory,
  playerMatchPoints,
  players,
  statReports,
  users,
  type Collection,
  type CollectionCard,
  type Match,
} from "@shared/schema";
import {
  ALBUM_PAGE_SIZE,
  extraSourceKey,
  invalidationAction,
  isOfficialScored,
  matchFactCards,
  monthAfter,
  monthKey,
  monthKeysFromThrough,
  monthRangeUtc,
  PACK_COOLDOWN_MS,
  pickPack,
  playerFact,
  previousMonthKey,
  selectTotm,
  sortRankFor,
  totmFacts,
  type CardRarity,
  type CardStatus,
  type CardType,
  type FactCandidate,
  type TotmPerformance,
} from "@shared/domain/collection";
import { seasonOf } from "@shared/domain/season";
import { db } from "../db";
import { storageDir } from "../env";
import { logger } from "../logger";
import * as matchRepo from "./matchRepo";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class CollectionExistsError extends Error {
  constructor() {
    super("Collection already exists");
    this.name = "CollectionExistsError";
  }
}

export class PackCooldownError extends Error {
  constructor(readonly nextPackAt: Date) {
    super("Pack is not ready");
    this.name = "PackCooldownError";
  }
}

export class PackEmptyError extends Error {
  constructor() {
    super("No active cards");
    this.name = "PackEmptyError";
  }
}

export type AlbumCard = {
  id: number;
  sourceKey: string;
  cardType: string;
  rarity: string;
  status: CardStatus;
  playerId: number | null;
  userId: number | null;
  avatarVersion: number | null;
  playerName: string | null;
  emoji: string | null;
  matchId: number | null;
  seasonKey: string | null;
  occurredAt: string;
  periodKey: string | null;
  payload: Record<string, unknown>;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  hasImage: boolean;
  ownedQuantity: number;
  points: number | null;
  goals: number | null;
  assists: number | null;
  marketValue: number | null;
  valueDelta: number | null;
  side: "blue" | "red" | null;
};

export type AlbumQuery = {
  viewerId: number;
  season?: string;
  cardType?: CardType;
  rarity?: CardRarity;
  status?: CardStatus;
  owned?: boolean;
  cursor?: string | null;
  limit?: number;
};

export type AlbumTypeCount = {
  cardType: string;
  owned: number;
  existing: number;
};

/** Unique owned cards versus existing definitions. Independent of the current page. */
export type AlbumProgress = {
  owned: number;
  existing: number;
  byType: AlbumTypeCount[];
};

export type AlbumPage = {
  collection: {
    id: number;
    leagueId: number | null;
    clubId: number | null;
    createdBy: number;
    createdAt: Date | null;
  };
  cards: AlbumCard[];
  nextCursor: string | null;
  pack: { nextPackAt: string | null; ready: boolean };
  progress: AlbumProgress;
};

function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && (current as { code?: string }).code === "23505") {
      return true;
    }
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

function toInsert(collectionId: number, fact: FactCandidate) {
  return {
    collectionId,
    sourceKey: fact.sourceKey,
    cardType: fact.cardType,
    rarity: fact.rarity,
    status: "active" as const,
    playerId: fact.playerId,
    matchId: fact.matchId,
    seasonKey: fact.seasonKey,
    occurredAt: fact.occurredAt,
    periodKey: fact.periodKey,
    sortRank: sortRankFor(fact.cardType),
    payload: fact.payload,
  };
}

function orgPlayerFilter(collection: Collection) {
  return collection.leagueId != null
    ? eq(players.leagueId, collection.leagueId)
    : eq(players.clubId, collection.clubId!);
}

function orgMatchFilter(collection: Collection) {
  return collection.leagueId != null
    ? eq(matches.leagueId, collection.leagueId)
    : eq(matches.clubId, collection.clubId!);
}

async function ownerCount(tx: Tx | typeof db, cardId: number): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(collectionOwnership)
    .where(eq(collectionOwnership.cardId, cardId));
  return Number(row?.count ?? 0);
}

async function invalidateCard(tx: Tx, card: CollectionCard): Promise<void> {
  if (card.status === "retired") {
    return;
  }
  if (invalidationAction(await ownerCount(tx, card.id)) === "delete") {
    await tx.delete(collectionCards).where(eq(collectionCards.id, card.id));
    return;
  }
  if (card.status !== "error") {
    await tx.update(collectionCards).set({ status: "error" }).where(eq(collectionCards.id, card.id));
  }
}

async function applyMatchFacts(tx: Tx, collectionId: number, match: Match): Promise<void> {
  const accepted = await tx
    .select({ playerId: matchParticipants.playerId })
    .from(matchParticipants)
    .where(and(eq(matchParticipants.matchId, match.id), eq(matchParticipants.status, "accepted")));
  const acceptedIds = new Set(accepted.map((row) => row.playerId));
  const reports = await tx.select().from(statReports).where(eq(statReports.matchId, match.id));
  const votes = await tx.select().from(matchMvpVotes).where(eq(matchMvpVotes.matchId, match.id));
  const facts = matchFactCards(
    match,
    reports
      .filter((report) => acceptedIds.has(report.playerId))
      .map((report) => ({ playerId: report.playerId, goals: report.goals })),
    votes.map((vote) => ({ mvpPlayerId: vote.mvpPlayerId })),
  );
  if (facts.length > 0) {
    await tx
      .insert(collectionCards)
      .values(facts.map((fact) => toInsert(collectionId, fact)))
      .onConflictDoNothing({ target: [collectionCards.collectionId, collectionCards.sourceKey] });
  }

  const existing = await tx
    .select()
    .from(collectionCards)
    .where(and(eq(collectionCards.collectionId, collectionId), eq(collectionCards.matchId, match.id)));
  const keys = new Set(facts.map((fact) => fact.sourceKey));
  const official = isOfficialScored(match);
  for (const card of existing) {
    if (card.cardType === "player" || card.cardType === "extra" || card.status === "retired") {
      continue;
    }
    if (card.cardType === "totm") {
      if (!official) {
        await invalidateCard(tx, card);
      }
      continue;
    }
    if (!keys.has(card.sourceKey)) {
      await invalidateCard(tx, card);
    }
  }
}

async function firstOfficialMonth(tx: Tx, collection: Collection): Promise<string | null> {
  const [row] = await tx
    .select({ date: matches.date })
    .from(matches)
    .where(
      and(
        orgMatchFilter(collection),
        eq(matches.isFriendly, false),
        inArray(matches.status, ["scored", "closed"]),
      ),
    )
    .orderBy(asc(matches.date))
    .limit(1);
  return row ? monthKey(row.date) : null;
}

async function loadPerformances(tx: Tx, collection: Collection, month: string): Promise<TotmPerformance[]> {
  const range = monthRangeUtc(month);
  const history = await tx
    .select({
      playerId: playerMarketValueHistory.playerId,
      matchId: playerMarketValueHistory.matchId,
      performanceScore: playerMarketValueHistory.performanceScore,
      mvp: playerMarketValueHistory.mvp,
      occurredAt: matches.date,
      seasonKey: matches.seasonKey,
    })
    .from(playerMarketValueHistory)
    .innerJoin(matches, eq(matches.id, playerMarketValueHistory.matchId))
    .where(
      and(
        orgMatchFilter(collection),
        eq(matches.isFriendly, false),
        inArray(matches.status, ["scored", "closed"]),
        gte(matches.date, range.start),
        lt(matches.date, range.end),
      ),
    );

  if (history.length === 0) {
    return [];
  }
  const matchIds = [...new Set(history.map((row) => row.matchId))];
  const reports = await tx.select().from(statReports).where(inArray(statReports.matchId, matchIds));
  const goals = new Map(reports.map((report) => [`${report.matchId}:${report.playerId}`, report.goals ?? 0]));
  return history.map((row) => ({
    playerId: row.playerId,
    matchId: row.matchId,
    performanceScore: row.performanceScore,
    mvp: row.mvp,
    goals: goals.get(`${row.matchId}:${row.playerId}`) ?? 0,
    occurredAt: row.occurredAt,
    seasonKey: row.seasonKey ?? seasonOf(row.occurredAt),
  }));
}

async function materializeMonth(tx: Tx, collection: Collection, month: string): Promise<void> {
  const inserted = await tx
    .insert(collectionPeriods)
    .values({ collectionId: collection.id, periodKey: `totm:${month}` })
    .onConflictDoNothing()
    .returning({ periodKey: collectionPeriods.periodKey });
  if (inserted.length === 0) {
    return;
  }
  const facts = totmFacts(month, selectTotm(await loadPerformances(tx, collection, month)));
  if (facts.length === 0) {
    return;
  }
  await tx
    .insert(collectionCards)
    .values(facts.map((fact) => toInsert(collection.id, fact)))
    .onConflictDoNothing({ target: [collectionCards.collectionId, collectionCards.sourceKey] });
}

async function fillTotmGaps(tx: Tx, collection: Collection, throughMonth: string): Promise<void> {
  const periods = await tx
    .select({ periodKey: collectionPeriods.periodKey })
    .from(collectionPeriods)
    .where(and(eq(collectionPeriods.collectionId, collection.id), sql`${collectionPeriods.periodKey} like 'totm:%'`));
  const latest = periods
    .map((row) => row.periodKey.slice("totm:".length))
    .sort()
    .at(-1);
  const start = latest ? monthAfter(latest) : await firstOfficialMonth(tx, collection);
  if (!start) {
    return;
  }
  for (const month of monthKeysFromThrough(start, throughMonth)) {
    await materializeMonth(tx, collection, month);
  }
}

async function bootstrap(tx: Tx, collection: Collection): Promise<void> {
  const roster = await tx.select().from(players).where(orgPlayerFilter(collection));
  if (roster.length > 0) {
    await tx
      .insert(collectionCards)
      .values(roster.map((player) => toInsert(collection.id, playerFact(player))))
      .onConflictDoNothing({ target: [collectionCards.collectionId, collectionCards.sourceKey] });
  }
  const orgMatches = await tx.select().from(matches).where(orgMatchFilter(collection));
  for (const match of orgMatches) {
    await applyMatchFacts(tx, collection.id, match);
  }
  await fillTotmGaps(tx, collection, previousMonthKey());
}

export async function getCollection(id: number): Promise<Collection | undefined> {
  const [row] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  return row;
}

export async function getByLeague(leagueId: number): Promise<Collection | undefined> {
  const [row] = await db.select().from(collections).where(eq(collections.leagueId, leagueId)).limit(1);
  return row;
}

export async function getByClub(clubId: number): Promise<Collection | undefined> {
  const [row] = await db.select().from(collections).where(eq(collections.clubId, clubId)).limit(1);
  return row;
}

export async function getCard(id: number): Promise<CollectionCard | undefined> {
  const [row] = await db.select().from(collectionCards).where(eq(collectionCards.id, id)).limit(1);
  return row;
}

export async function createCollection(input: {
  leagueId?: number | null;
  clubId?: number | null;
  createdBy: number;
}): Promise<Collection> {
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(collections)
        .values({
          leagueId: input.leagueId ?? null,
          clubId: input.clubId ?? null,
          createdBy: input.createdBy,
        })
        .returning();
      await bootstrap(tx, created);
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CollectionExistsError();
    }
    throw error;
  }
}

export async function reconcileCollection(collectionId: number): Promise<void> {
  const collection = await getCollection(collectionId);
  if (!collection) {
    return;
  }
  await db.transaction(async (tx) => {
    await bootstrap(tx, collection);
  });
}

/** Narrow check: one period lookup, then only missing completed months. */
export async function ensureDueTotm(collectionId: number, now: Date = new Date()): Promise<void> {
  const previous = previousMonthKey(now);
  const [existing] = await db
    .select({ periodKey: collectionPeriods.periodKey })
    .from(collectionPeriods)
    .where(and(eq(collectionPeriods.collectionId, collectionId), eq(collectionPeriods.periodKey, `totm:${previous}`)))
    .limit(1);
  if (existing) {
    return;
  }
  const collection = await getCollection(collectionId);
  if (!collection) {
    return;
  }
  await db.transaction(async (tx) => {
    await fillTotmGaps(tx, collection, previous);
  });
}

export async function reconcileMatch(matchId: number): Promise<void> {
  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    return;
  }
  const collection = match.leagueId != null ? await getByLeague(match.leagueId) : match.clubId != null ? await getByClub(match.clubId) : undefined;
  if (!collection) {
    return;
  }
  await db.transaction(async (tx) => {
    await applyMatchFacts(tx, collection.id, match);
  });
}

export async function syncMatch(matchId: number): Promise<void> {
  try {
    await reconcileMatch(matchId);
  } catch (error) {
    logger.error("Collection match sync failed", error);
  }
}

export async function syncMatches(matchIds: number[]): Promise<void> {
  for (const matchId of matchIds) {
    await syncMatch(matchId);
  }
}

export async function syncPlayer(player: {
  id: number;
  leagueId: number | null;
  clubId: number | null;
  createdAt?: Date | null;
}): Promise<void> {
  try {
    const collection = player.leagueId != null ? await getByLeague(player.leagueId) : player.clubId != null ? await getByClub(player.clubId) : undefined;
    if (!collection) {
      return;
    }
    await db
      .insert(collectionCards)
      .values(toInsert(collection.id, playerFact(player)))
      .onConflictDoNothing({ target: [collectionCards.collectionId, collectionCards.sourceKey] });
  } catch (error) {
    logger.error("Collection player sync failed", error);
  }
}

/** Drop or stamp cards for a match that is about to disappear. Does not delete the match. */
export async function detachMatch(matchId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const cards = await tx.select().from(collectionCards).where(eq(collectionCards.matchId, matchId));
    for (const card of cards) {
      if (card.cardType === "player" || card.cardType === "extra") {
        continue;
      }
      await invalidateCard(tx, card);
    }
    await tx.update(collectionCards).set({ matchId: null }).where(eq(collectionCards.matchId, matchId));
  });
}

type Cursor = { rank: number; at: string; id: number };

function encodeCursor(rank: number, occurredAt: Date, id: number): string {
  return Buffer.from(JSON.stringify({ rank, at: occurredAt.toISOString(), id })).toString("base64url");
}

function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (typeof parsed.rank !== "number" || typeof parsed.at !== "string" || typeof parsed.id !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cardSide(playerId: number | null, teams: { teamA?: number[]; teamB?: number[] } | null): "blue" | "red" | null {
  if (playerId == null || teams == null) return null;
  if (teams.teamB?.includes(playerId)) return "blue";
  if (teams.teamA?.includes(playerId)) return "red";
  return null;
}

function mapAlbumRow(row: {
  id: number;
  sourceKey: string;
  cardType: string;
  rarity: string;
  status: CardStatus;
  playerId: number | null;
  matchId: number | null;
  seasonKey: string | null;
  occurredAt: Date;
  periodKey: string | null;
  payload: Record<string, unknown>;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imagePath: string | null;
  playerName: string | null;
  emoji: string | null;
  userId: number | null;
  avatarVersion: number | null;
  quantity: number | null;
  points: number | null;
  goals: number | null;
  assists: number | null;
  marketValue: number | null;
  valueDelta: number | null;
  matchTeams: { teamA?: number[]; teamB?: number[] } | null;
}): AlbumCard {
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    cardType: row.cardType,
    rarity: row.rarity,
    status: row.status,
    playerId: row.playerId,
    userId: row.userId,
    avatarVersion: row.avatarVersion,
    playerName: row.playerName,
    emoji: row.emoji,
    matchId: row.matchId,
    seasonKey: row.seasonKey,
    occurredAt: row.occurredAt.toISOString(),
    periodKey: row.periodKey,
    payload: row.payload,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    hasImage: Boolean(row.imagePath),
    ownedQuantity: row.quantity ?? 0,
    points: finiteNumber(row.points),
    goals: finiteNumber(row.goals),
    assists: finiteNumber(row.assists),
    marketValue: finiteNumber(row.marketValue),
    valueDelta: finiteNumber(row.valueDelta),
    side: cardSide(row.playerId, row.matchTeams),
  };
}

const albumSelection = {
  id: collectionCards.id,
  sourceKey: collectionCards.sourceKey,
  cardType: collectionCards.cardType,
  rarity: collectionCards.rarity,
  status: collectionCards.status,
  playerId: collectionCards.playerId,
  matchId: collectionCards.matchId,
  seasonKey: collectionCards.seasonKey,
  occurredAt: collectionCards.occurredAt,
  periodKey: collectionCards.periodKey,
  sortRank: collectionCards.sortRank,
  payload: collectionCards.payload,
  title: collectionCards.title,
  subtitle: collectionCards.subtitle,
  body: collectionCards.body,
  imagePath: collectionCards.imagePath,
  playerName: players.name,
  emoji: players.emoji,
  userId: players.userId,
  avatarVersion: users.avatarVersion,
  quantity: collectionOwnership.quantity,
  points: playerMatchPoints.points,
  goals: playerMatchPoints.goals,
  assists: playerMatchPoints.assists,
  marketValue: players.marketValue,
  valueDelta: playerMarketValueHistory.delta,
  matchTeams: matches.matchTeams,
};

function albumQuery(viewerId: number) {
  return db
    .select(albumSelection)
    .from(collectionCards)
    .leftJoin(players, eq(players.id, collectionCards.playerId))
    .leftJoin(users, eq(users.id, players.userId))
    .leftJoin(
      collectionOwnership,
      and(eq(collectionOwnership.cardId, collectionCards.id), eq(collectionOwnership.userId, viewerId)),
    )
    .leftJoin(
      playerMatchPoints,
      and(eq(playerMatchPoints.matchId, collectionCards.matchId), eq(playerMatchPoints.playerId, collectionCards.playerId)),
    )
    .leftJoin(
      playerMarketValueHistory,
      and(eq(playerMarketValueHistory.matchId, collectionCards.matchId), eq(playerMarketValueHistory.playerId, collectionCards.playerId)),
    )
    .leftJoin(matches, eq(matches.id, collectionCards.matchId));
}

async function albumProgress(collectionId: number, viewerId: number): Promise<AlbumProgress> {
  const rows = await db
    .select({
      cardType: collectionCards.cardType,
      existing: sql<number>`count(*)::int`,
      owned: sql<number>`count(${collectionOwnership.cardId})::int`,
    })
    .from(collectionCards)
    .leftJoin(
      collectionOwnership,
      and(eq(collectionOwnership.cardId, collectionCards.id), eq(collectionOwnership.userId, viewerId)),
    )
    .where(eq(collectionCards.collectionId, collectionId))
    .groupBy(collectionCards.cardType);
  const byType = rows.map((row) => ({
    cardType: row.cardType,
    existing: Number(row.existing),
    owned: Number(row.owned),
  }));
  return {
    existing: byType.reduce((sum, row) => sum + row.existing, 0),
    owned: byType.reduce((sum, row) => sum + row.owned, 0),
    byType,
  };
}

export async function getAlbum(collection: Collection, query: AlbumQuery): Promise<AlbumPage> {
  await ensureDueTotm(collection.id);
  const limit = Math.min(Math.max(query.limit ?? ALBUM_PAGE_SIZE, 1), 100);
  const filters = [eq(collectionCards.collectionId, collection.id)];
  if (query.cardType) {
    filters.push(eq(collectionCards.cardType, query.cardType));
  }
  if (query.rarity) {
    filters.push(eq(collectionCards.rarity, query.rarity));
  }
  if (query.status) {
    filters.push(eq(collectionCards.status, query.status));
  }
  if (query.season) {
    filters.push(or(eq(collectionCards.seasonKey, query.season), isNull(collectionCards.seasonKey))!);
  }
  if (query.owned === true) {
    filters.push(sql`${collectionOwnership.userId} is not null`);
  } else if (query.owned === false) {
    filters.push(isNull(collectionOwnership.userId));
  }
  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    const at = new Date(cursor.at);
    filters.push(sql`(
      ${collectionCards.sortRank} > ${cursor.rank}
      OR (${collectionCards.sortRank} = ${cursor.rank} AND ${collectionCards.occurredAt} > ${at})
      OR (${collectionCards.sortRank} = ${cursor.rank} AND ${collectionCards.occurredAt} = ${at} AND ${collectionCards.id} > ${cursor.id})
    )`);
  }

  const rows = await albumQuery(query.viewerId)
    .where(and(...filters))
    .orderBy(asc(collectionCards.sortRank), asc(collectionCards.occurredAt), asc(collectionCards.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const cards = page.map(mapAlbumRow);
  await attachTotmTotals(db, collection, cards);
  const last = page.at(-1);
  const [packRow] = await db
    .select()
    .from(collectionPackState)
    .where(and(eq(collectionPackState.collectionId, collection.id), eq(collectionPackState.userId, query.viewerId)))
    .limit(1);
  const nextPackAt = packRow?.nextPackAt ?? null;
  return {
    collection: {
      id: collection.id,
      leagueId: collection.leagueId,
      clubId: collection.clubId,
      createdBy: collection.createdBy,
      createdAt: collection.createdAt,
    },
    cards,
    nextCursor: rows.length > limit && last ? encodeCursor(last.sortRank, last.occurredAt, last.id) : null,
    pack: {
      nextPackAt: nextPackAt ? nextPackAt.toISOString() : null,
      ready: nextPackAt == null || nextPackAt.getTime() <= Date.now(),
    },
    progress: await albumProgress(collection.id, query.viewerId),
  };
}

async function cardsByIds(tx: Tx, collectionId: number, viewerId: number, ids: number[]): Promise<AlbumCard[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await tx
    .select(albumSelection)
    .from(collectionCards)
    .leftJoin(players, eq(players.id, collectionCards.playerId))
    .leftJoin(users, eq(users.id, players.userId))
    .leftJoin(
      collectionOwnership,
      and(eq(collectionOwnership.cardId, collectionCards.id), eq(collectionOwnership.userId, viewerId)),
    )
    .leftJoin(
      playerMatchPoints,
      and(eq(playerMatchPoints.matchId, collectionCards.matchId), eq(playerMatchPoints.playerId, collectionCards.playerId)),
    )
    .leftJoin(
      playerMarketValueHistory,
      and(eq(playerMarketValueHistory.matchId, collectionCards.matchId), eq(playerMarketValueHistory.playerId, collectionCards.playerId)),
    )
    .leftJoin(matches, eq(matches.id, collectionCards.matchId))
    .where(and(eq(collectionCards.collectionId, collectionId), inArray(collectionCards.id, ids)));
  const byId = new Map(rows.map((row) => [row.id, mapAlbumRow(row)]));
  const cards = ids.map((id) => byId.get(id)).filter((card): card is AlbumCard => card != null);
  const [collection] = await tx.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
  if (collection) await attachTotmTotals(tx, collection, cards);
  return cards;
}

async function attachTotmTotals(tx: Tx | typeof db, collection: Collection, cards: AlbumCard[]): Promise<void> {
  const targets = cards.filter(
    (card) => card.cardType === "totm" && card.playerId != null && typeof card.payload.month === "string",
  );
  const months = [...new Set(targets.map((card) => String(card.payload.month)))];
  for (const month of months) {
    const range = monthRangeUtc(month);
    const playerIds = [...new Set(targets.filter((card) => card.payload.month === month).map((card) => card.playerId!))];
    if (playerIds.length === 0) continue;
    const totals = await tx
      .select({
        playerId: playerMatchPoints.playerId,
        points: sql<number>`coalesce(sum(${playerMatchPoints.points}), 0)::float`,
        goals: sql<number>`coalesce(sum(${playerMatchPoints.goals}), 0)::int`,
        assists: sql<number>`coalesce(sum(${playerMatchPoints.assists}), 0)::int`,
      })
      .from(playerMatchPoints)
      .innerJoin(matches, eq(matches.id, playerMatchPoints.matchId))
      .where(and(
        orgMatchFilter(collection),
        eq(matches.isFriendly, false),
        inArray(matches.status, ["scored", "closed"]),
        gte(matches.date, range.start),
        lt(matches.date, range.end),
        inArray(playerMatchPoints.playerId, playerIds),
      ))
      .groupBy(playerMatchPoints.playerId);
    const byPlayer = new Map(totals.map((row) => [row.playerId, row]));
    for (const card of targets) {
      if (card.payload.month !== month || card.playerId == null) continue;
      const row = byPlayer.get(card.playerId);
      card.points = finiteNumber(row?.points) ?? 0;
      card.goals = finiteNumber(row?.goals) ?? 0;
      card.assists = finiteNumber(row?.assists) ?? 0;
    }
  }
}

export async function openPack(collectionId: number, userId: number): Promise<{ cards: AlbumCard[]; nextPackAt: string }> {
  await ensureDueTotm(collectionId);
  return db.transaction(async (tx) => {
    await tx
      .insert(collectionPackState)
      .values({ collectionId, userId, nextPackAt: null })
      .onConflictDoNothing();
    const [state] = await tx
      .select()
      .from(collectionPackState)
      .where(and(eq(collectionPackState.collectionId, collectionId), eq(collectionPackState.userId, userId)))
      .for("update");
    if (state?.nextPackAt && state.nextPackAt.getTime() > Date.now()) {
      throw new PackCooldownError(state.nextPackAt);
    }

    const active = await tx
      .select({
        id: collectionCards.id,
        rarity: collectionCards.rarity,
        status: collectionCards.status,
      })
      .from(collectionCards)
      .where(and(eq(collectionCards.collectionId, collectionId), eq(collectionCards.status, "active")));
    const ownedRows = await tx
      .select({ cardId: collectionOwnership.cardId })
      .from(collectionOwnership)
      .where(and(eq(collectionOwnership.collectionId, collectionId), eq(collectionOwnership.userId, userId)));
    const draw = pickPack({
      cards: active.map((row) => ({
        id: row.id,
        rarity: row.rarity as CardRarity,
        status: row.status,
      })),
      ownedIds: ownedRows.map((row) => row.cardId),
    });
    if (!draw.ok) {
      throw new PackEmptyError();
    }

    const counts = new Map<number, number>();
    for (const cardId of draw.cardIds) {
      counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
    }
    const rarityById = new Map(active.map((row) => [row.id, row.rarity]));
    for (const [cardId, add] of counts) {
      await tx
        .insert(collectionOwnership)
        .values({ collectionId, cardId, userId, quantity: add })
        .onConflictDoUpdate({
          target: [collectionOwnership.userId, collectionOwnership.cardId],
          set: {
            quantity: sql`${collectionOwnership.quantity} + ${add}`,
            updatedAt: new Date(),
          },
        });
    }
    const nextPackAt = new Date(Date.now() + PACK_COOLDOWN_MS);
    await tx
      .update(collectionPackState)
      .set({ nextPackAt })
      .where(and(eq(collectionPackState.collectionId, collectionId), eq(collectionPackState.userId, userId)));
    await tx.insert(collectionPackOpenings).values({
      collectionId,
      userId,
      cardIds: draw.cardIds,
      rarities: draw.cardIds.map((id) => rarityById.get(id) ?? "common"),
    });
    return {
      cards: await cardsByIds(tx, collectionId, userId, draw.cardIds),
      nextPackAt: nextPackAt.toISOString(),
    };
  });
}

function extraFile(collectionId: number, cardId: number): { absolute: string; relative: string } {
  const relative = path.join(storageDir(), "collection", String(collectionId), `${cardId}.jpg`);
  return { absolute: path.resolve(process.cwd(), relative), relative };
}

export function extraImageFile(imagePath: string): string | null {
  const root = path.resolve(process.cwd(), storageDir(), "collection");
  const absolute = path.resolve(process.cwd(), imagePath);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return absolute;
}

export async function createExtra(
  collectionId: number,
  input: { title: string; subtitle: string; body: string; rarity: CardRarity },
  image: Buffer,
): Promise<CollectionCard> {
  const [card] = await db
    .insert(collectionCards)
    .values({
      collectionId,
      sourceKey: extraSourceKey(randomUUID()),
      cardType: "extra",
      rarity: input.rarity,
      status: "active",
      occurredAt: new Date(),
      sortRank: sortRankFor("extra"),
      payload: {},
      title: input.title,
      subtitle: input.subtitle || null,
      body: input.body || null,
    })
    .returning();
  try {
    const file = extraFile(collectionId, card.id);
    await fs.mkdir(path.dirname(file.absolute), { recursive: true });
    await fs.writeFile(file.absolute, image);
    const [updated] = await db
      .update(collectionCards)
      .set({ imagePath: file.relative })
      .where(eq(collectionCards.id, card.id))
      .returning();
    return updated ?? card;
  } catch (error) {
    await db.delete(collectionCards).where(eq(collectionCards.id, card.id));
    throw error;
  }
}

export async function updateExtra(
  card: CollectionCard,
  input: { title?: string; subtitle?: string; body?: string; rarity?: CardRarity },
  image?: Buffer,
): Promise<CollectionCard> {
  let imagePath = card.imagePath;
  if (image) {
    const file = extraFile(card.collectionId, card.id);
    await fs.mkdir(path.dirname(file.absolute), { recursive: true });
    await fs.writeFile(file.absolute, image);
    imagePath = file.relative;
  }
  const [updated] = await db
    .update(collectionCards)
    .set({
      title: input.title ?? card.title,
      subtitle: input.subtitle ?? card.subtitle,
      body: input.body ?? card.body,
      rarity: input.rarity ?? card.rarity,
      imagePath,
    })
    .where(eq(collectionCards.id, card.id))
    .returning();
  return updated ?? card;
}

export async function deleteExtra(card: CollectionCard): Promise<"deleted" | "retired"> {
  const owners = await ownerCount(db, card.id);
  if (owners === 0) {
    await db.delete(collectionCards).where(eq(collectionCards.id, card.id));
    if (card.imagePath) {
      const file = extraImageFile(card.imagePath);
      if (file) {
        await fs.rm(file, { force: true });
      }
    }
    return "deleted";
  }
  await db.update(collectionCards).set({ status: "retired" }).where(eq(collectionCards.id, card.id));
  return "retired";
}
