import {
  matches,
  matchParticipants,
  players,
  playerMatchPoints,
  managerMatchPoints,
  statReports,
  lineups,
  matchPlayerVm,
  matchRatingAssignments,
  matchMvpVotes,
  matchPeerRatings,
  playerMarketValueHistory,
  type Match,
  type InsertMatch,
  type InsertClubMatch,
  type MatchParticipant,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { seasonOf } from "@shared/domain/season";
import { contextOf, type ContextRef } from "@shared/domain/context";
import { logger } from "../logger";

export async function getMatch(id: number): Promise<Match | undefined> {
  const [match] = await db.select().from(matches).where(eq(matches.id, id));
  return match || undefined;
}

export async function getMatchesByContext(ref: ContextRef): Promise<Match[]> {
  const filter =
    contextOf(ref) === "league"
      ? eq(matches.leagueId, ref.leagueId!)
      : eq(matches.clubId, ref.clubId!);
  return await db.select().from(matches).where(filter);
}

export async function getMatchesByLeague(leagueId: number): Promise<Match[]> {
  return await getMatchesByContext({ leagueId });
}

export async function getMatchesByClub(clubId: number): Promise<Match[]> {
  return await getMatchesByContext({ clubId });
}

export async function createMatch(
  match: (InsertMatch | InsertClubMatch) & { createdBy: number },
): Promise<Match> {
  const [created] = await db
    .insert(matches)
    .values({ ...match, seasonKey: seasonOf(match.date) } as any)
    .returning();
  return created;
}

export async function updateMatch(
  id: number,
  updates: Partial<Match>,
): Promise<Match | undefined> {
  const [match] = await db.update(matches).set(updates).where(eq(matches.id, id)).returning();
  return match || undefined;
}

export async function deleteMatch(id: number): Promise<void> {
  await db.delete(playerMarketValueHistory).where(eq(playerMarketValueHistory.matchId, id));
  await db.delete(matchPeerRatings).where(eq(matchPeerRatings.matchId, id));
  await db.delete(matchMvpVotes).where(eq(matchMvpVotes.matchId, id));
  await db.delete(matchRatingAssignments).where(eq(matchRatingAssignments.matchId, id));
  await db.delete(matchPlayerVm).where(eq(matchPlayerVm.matchId, id));
  await db.delete(playerMatchPoints).where(eq(playerMatchPoints.matchId, id));
  await db.delete(managerMatchPoints).where(eq(managerMatchPoints.matchId, id));
  await db.delete(statReports).where(eq(statReports.matchId, id));
  await db.delete(lineups).where(eq(lineups.matchId, id));
  await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
  await db.delete(matches).where(eq(matches.id, id));
}

export async function joinMatch(matchId: number, userId: number): Promise<MatchParticipant> {
  const match = await getMatch(matchId);
  if (!match) {
    throw new Error("Match not found");
  }

  const contextFilter =
    match.leagueId != null
      ? and(eq(players.leagueId, match.leagueId), isNull(players.clubId))
      : and(eq(players.clubId, match.clubId!), isNull(players.leagueId));
  const userPlayer = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, userId), contextFilter))
    .limit(1);

  if (userPlayer.length === 0) {
    throw new Error("User is not a player in this league");
  }

  const playerId = userPlayer[0].id;

  const existingParticipant = await db
    .select()
    .from(matchParticipants)
    .where(
      and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, playerId)),
    )
    .limit(1);

  if (existingParticipant.length > 0) {
    return existingParticipant[0];
  }

  const [participant] = await db
    .insert(matchParticipants)
    .values({ matchId, playerId, status: "accepted" })
    .returning();

  return participant;
}

export async function addPlayerToMatch(
  matchId: number,
  playerId: number,
): Promise<MatchParticipant> {
  try {
    const existingParticipant = await db
      .select()
      .from(matchParticipants)
      .where(
        and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, playerId)),
      )
      .limit(1);

    if (existingParticipant.length > 0) {
      return existingParticipant[0];
    }

    const [participant] = await db
      .insert(matchParticipants)
      .values({ matchId, playerId, status: "accepted" })
      .returning();
    return participant;
  } catch (error) {
    logger.error("Error adding player to match", error);
    throw new Error("Failed to add player to match", { cause: error });
  }
}

export async function getMatchParticipants(matchId: number): Promise<MatchParticipant[]> {
  return await db
    .select()
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId));
}
