import { players, leagues, clubs, type Player, type InsertPlayer } from "@shared/schema";
import { db } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { uniqueLeaguePlayerName } from "@shared/domain/players";
import { DEFAULT_MARKET_VALUE } from "@shared/domain/valuation";
import { contextOf, type ContextRef } from "@shared/domain/context";
import * as claimRepo from "./claimRepo";

/** Matches the one identifier that is set and requires the other to be null. */
function contextFilter(ref: ContextRef) {
  return contextOf(ref) === "league"
    ? and(eq(players.leagueId, ref.leagueId!), isNull(players.clubId))
    : and(eq(players.clubId, ref.clubId!), isNull(players.leagueId));
}

export async function getPlayer(id: number): Promise<Player | undefined> {
  const [player] = await db.select().from(players).where(eq(players.id, id));
  return player || undefined;
}

export async function getPlayersByContext(ref: ContextRef): Promise<Player[]> {
  return await db.select().from(players).where(contextFilter(ref));
}

export async function getPlayersByLeague(leagueId: number): Promise<Player[]> {
  return await getPlayersByContext({ leagueId });
}

export async function getPlayersByClub(clubId: number): Promise<Player[]> {
  return await getPlayersByContext({ clubId });
}

/** The roster of whichever League or Club the given match (or player) belongs to. */
export async function getRosterFor(ref: ContextRef): Promise<Player[]> {
  return await getPlayersByContext(ref);
}

export async function createPlayer(
  player: InsertPlayer & ContextRef & {
    createdBy?: number;
    userId?: number;
    isExternal?: boolean;
  },
): Promise<Player> {
  const ref: ContextRef = { leagueId: player.leagueId, clubId: player.clubId };
  const existing = await getPlayersByContext(ref);
  const name = uniqueLeaguePlayerName(
    player.name,
    existing.map((item) => item.name),
  );

  let marketValue = 0;
  if (contextOf(ref) === "league") {
    const [league] = await db
      .select({ status: leagues.status })
      .from(leagues)
      .where(eq(leagues.id, player.leagueId!));
    marketValue = league?.status === "closed" ? DEFAULT_MARKET_VALUE : 0;
  } else {
    const [club] = await db
      .select({ status: clubs.status })
      .from(clubs)
      .where(eq(clubs.id, player.clubId!));
    marketValue = club?.status === "closed" ? DEFAULT_MARKET_VALUE : 0;
  }

  const [newPlayer] = await db
    .insert(players)
    .values({
      name,
      emoji: player.emoji,
      leagueId: player.leagueId ?? null,
      clubId: player.clubId ?? null,
      createdBy: player.createdBy,
      userId: player.userId,
      isExternal: player.isExternal ?? false,
      marketValue,
    })
    .returning();
  return newPlayer;
}

export async function updatePlayer(
  id: number,
  updates: Partial<Player>,
): Promise<Player | undefined> {
  const [updated] = await db
    .update(players)
    .set(updates)
    .where(eq(players.id, id))
    .returning();
  return updated || undefined;
}

export async function checkUserAsPlayer(
  userId: number,
  ref: ContextRef | number,
): Promise<Player | undefined> {
  const context: ContextRef = typeof ref === "number" ? { leagueId: ref } : ref;
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, userId), contextFilter(context)));
  return player || undefined;
}

export async function findByAlias(
  ref: ContextRef,
  alias: string,
): Promise<Player | undefined> {
  const roster = await getPlayersByContext(ref);
  const wanted = alias.trim().toLowerCase();
  return roster.find((player) => player.name.toLowerCase() === wanted);
}

export type JoinAliasOutcome =
  /** The user already has a Player here; the alias is ignored. */
  | { kind: "existing"; player: Player }
  /** Alias was free; a new Player was created and the user may join. */
  | { kind: "created"; player: Player }
  /** Alias belongs to another account. */
  | { kind: "alias_taken"; player: Player }
  /** Alias belongs to an unlinked Player; an admin must confirm before joining. */
  | { kind: "claim_pending"; player: Player; requestId: number };

/**
 * Resolves the alias a user typed when joining a League or a Club. An alias matching an
 * unlinked Player never links silently: it raises a claim request that blocks membership
 * until an administrator resolves it.
 */
export async function resolveJoinAlias(input: ContextRef & {
  userId: number;
  alias: string;
}): Promise<JoinAliasOutcome> {
  const ref: ContextRef = { leagueId: input.leagueId, clubId: input.clubId };
  const existing = await checkUserAsPlayer(input.userId, ref);
  if (existing) {
    return { kind: "existing", player: existing };
  }

  const match = await findByAlias(ref, input.alias);
  if (match) {
    if (match.userId != null) {
      return { kind: "alias_taken", player: match };
    }
    const request = await claimRepo.requestClaim(match.id, input.userId);
    return { kind: "claim_pending", player: match, requestId: request.id };
  }

  const created = await createPlayer({
    ...ref,
    name: input.alias.trim(),
    userId: input.userId,
    createdBy: input.userId,
  });
  return { kind: "created", player: created };
}

/** Completes an accepted claim: the unlinked Player becomes the user's Player. */
export async function linkPlayerToUser(playerId: number, userId: number): Promise<Player> {
  const linked = await updatePlayer(playerId, { userId, isExternal: false });
  if (!linked) {
    throw new Error("Failed to link player to user");
  }
  return linked;
}

async function deleteRoster(ref: ContextRef): Promise<void> {
  const roster = await getPlayersByContext(ref);
  await claimRepo.deleteClaimsByPlayerIds(roster.map((player) => player.id));
  await db.delete(players).where(contextFilter(ref));
}

export async function deletePlayersByLeague(leagueId: number): Promise<void> {
  await deleteRoster({ leagueId });
}

export async function deletePlayersByClub(clubId: number): Promise<void> {
  await deleteRoster({ clubId });
}
