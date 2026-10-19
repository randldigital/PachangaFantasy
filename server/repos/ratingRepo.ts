import {
  matchPlayerVm,
  matchRatingAssignments,
  matchMvpVotes,
  matchPeerRatings,
  matches,
  playerMarketValueHistory,
  playerMatchPoints,
  type MatchMvpVote,
  type MatchPeerRating,
  type MatchPlayerVm,
  type MatchRatingAssignment,
  type PlayerMarketValueHistory,
} from "@shared/schema";
import { db } from "../db";
import { and, asc, eq } from "drizzle-orm";
import * as matchRepo from "./matchRepo";
import * as playerRepo from "./playerRepo";
import { assignMatchRatings, ratingsAreComplete } from "@shared/domain/ratingAssignments";
import { assignClubRatings } from "@shared/domain/clubRatingAssignments";
import type { RatingAssignment } from "@shared/domain/ratingAssignments";

export type PlayerMarketValueHistoryRow = {
  matchId: number;
  date: Date | string | null;
  seasonKey: string | null;
  vmBefore: number;
  vmAfter: number;
  delta: number;
  goals: number;
  assists: number;
  points: number;
  mvpVotes: number;
  peerAverage: number | null;
  performanceScore: number;
};

export async function snapshotMatchPlayerVm(matchId: number): Promise<MatchPlayerVm[]> {
  const existing = await db.select().from(matchPlayerVm).where(eq(matchPlayerVm.matchId, matchId));
  if (existing.length > 0) {
    return existing;
  }

  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    return [];
  }
  const participants = await matchRepo.getMatchParticipants(matchId);
  const roster = await playerRepo.getRosterFor(match);
  const byId = new Map(roster.map((player) => [player.id, player]));
  const rows = participants
    .filter((participant) => participant.status === "accepted")
    .map((participant) => ({
      matchId,
      playerId: participant.playerId,
      marketValue: byId.get(participant.playerId)?.marketValue ?? 18,
    }));
  if (rows.length === 0) {
    return [];
  }
  return await db.insert(matchPlayerVm).values(rows).returning();
}

export async function replaceMatchPlayerVmFromRoster(matchId: number): Promise<MatchPlayerVm[]> {
  await db.delete(matchPlayerVm).where(eq(matchPlayerVm.matchId, matchId));
  return snapshotMatchPlayerVm(matchId);
}

export async function restorePlayerMarketValuesFromSnapshot(matchId: number): Promise<void> {
  const rows = await getMatchPlayerVm(matchId);
  for (const row of rows) {
    await playerRepo.updatePlayer(row.playerId, { marketValue: row.marketValue });
  }
}

export async function getMatchPlayerVm(matchId: number): Promise<MatchPlayerVm[]> {
  return await db.select().from(matchPlayerVm).where(eq(matchPlayerVm.matchId, matchId));
}

export async function ensureRatingAssignments(matchId: number): Promise<MatchRatingAssignment[]> {
  const existing = await db
    .select()
    .from(matchRatingAssignments)
    .where(eq(matchRatingAssignments.matchId, matchId));
  if (existing.length > 0) {
    return existing;
  }

  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    return [];
  }
  const isClub = match.clubId != null;
  if (!isClub && !match.matchTeams) {
    return [];
  }
  const participants = await matchRepo.getMatchParticipants(matchId);
  const roster = await playerRepo.getRosterFor(match);
  const accepted = participants.filter((participant) => participant.status === "accepted");
  const participantIds = accepted.map((participant) => participant.playerId);
  const voterPlayerIds = accepted
    .map((participant) => roster.find((player) => player.id === participant.playerId))
    .filter((player) => player?.userId != null)
    .map((player) => player!.id);

  const generated = isClub
    ? assignClubRatings({ matchId, participantIds, voterPlayerIds })
    : assignMatchRatings({
        matchId,
        teamA: match.matchTeams!.teamA,
        teamB: match.matchTeams!.teamB,
        voterPlayerIds,
        participantIds,
      });
  if (generated.length === 0) {
    return [];
  }
  return await db.insert(matchRatingAssignments).values(
    generated.map((row) => ({
      matchId,
      raterPlayerId: row.raterPlayerId,
      rateePlayerId: row.rateePlayerId,
      kind: row.kind,
    })),
  ).returning();
}

export async function getRatingAssignments(matchId: number): Promise<MatchRatingAssignment[]> {
  return await db
    .select()
    .from(matchRatingAssignments)
    .where(eq(matchRatingAssignments.matchId, matchId));
}

export async function voterPlayerIdsForMatch(matchId: number): Promise<number[]> {
  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    return [];
  }
  const participants = await matchRepo.getMatchParticipants(matchId);
  const roster = await playerRepo.getRosterFor(match);
  return participants
    .filter((participant) => participant.status === "accepted")
    .map((participant) => roster.find((player) => player.id === participant.playerId))
    .filter((player) => player?.userId != null)
    .map((player) => player!.id);
}

export async function getMvpVotes(matchId: number): Promise<MatchMvpVote[]> {
  return await db.select().from(matchMvpVotes).where(eq(matchMvpVotes.matchId, matchId));
}

export async function getPeerRatings(matchId: number): Promise<MatchPeerRating[]> {
  return await db.select().from(matchPeerRatings).where(eq(matchPeerRatings.matchId, matchId));
}

export async function submittedVoterIds(matchId: number): Promise<number[]> {
  const votes = await getMvpVotes(matchId);
  return votes.map((vote) => vote.voterPlayerId);
}

export async function matchRatingsComplete(matchId: number): Promise<boolean> {
  const [voters, submitted] = await Promise.all([
    voterPlayerIdsForMatch(matchId),
    submittedVoterIds(matchId),
  ]);
  return ratingsAreComplete(voters, submitted);
}

export async function saveBallot(
  matchId: number,
  voterPlayerId: number,
  mvpPlayerId: number,
  ratings: { playerId: number; score: number }[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(matchMvpVotes)
      .where(and(eq(matchMvpVotes.matchId, matchId), eq(matchMvpVotes.voterPlayerId, voterPlayerId)));
    await tx.insert(matchMvpVotes).values({ matchId, voterPlayerId, mvpPlayerId });
    await tx
      .delete(matchPeerRatings)
      .where(
        and(eq(matchPeerRatings.matchId, matchId), eq(matchPeerRatings.raterPlayerId, voterPlayerId)),
      );
    if (ratings.length > 0) {
      await tx.insert(matchPeerRatings).values(
        ratings.map((rating) => ({
          matchId,
          raterPlayerId: voterPlayerId,
          rateePlayerId: rating.playerId,
          score: rating.score,
        })),
      );
    }
  });
}

export async function getMarketValueHistory(matchId: number): Promise<PlayerMarketValueHistory[]> {
  return await db
    .select()
    .from(playerMarketValueHistory)
    .where(eq(playerMarketValueHistory.matchId, matchId));
}

/** Non-friendly scored matches for one player, chronological (for VM charts). */
export async function getPlayerMarketValueHistory(
  playerId: number,
  season?: string,
): Promise<PlayerMarketValueHistoryRow[]> {
  const rows = await db
    .select({
      matchId: playerMarketValueHistory.matchId,
      date: matches.date,
      seasonKey: matches.seasonKey,
      vmBefore: playerMarketValueHistory.vmBefore,
      vmAfter: playerMarketValueHistory.vmAfter,
      delta: playerMarketValueHistory.delta,
      mvpVotes: playerMarketValueHistory.mvpVotes,
      peerAverage: playerMarketValueHistory.peerAverage,
      performanceScore: playerMarketValueHistory.performanceScore,
      goals: playerMatchPoints.goals,
      assists: playerMatchPoints.assists,
      points: playerMatchPoints.points,
    })
    .from(playerMarketValueHistory)
    .innerJoin(
      matches,
      and(
        eq(playerMarketValueHistory.matchId, matches.id),
        eq(matches.isFriendly, false),
        season ? eq(matches.seasonKey, season) : undefined,
      ),
    )
    .leftJoin(
      playerMatchPoints,
      and(
        eq(playerMatchPoints.matchId, playerMarketValueHistory.matchId),
        eq(playerMatchPoints.playerId, playerMarketValueHistory.playerId),
      ),
    )
    .where(eq(playerMarketValueHistory.playerId, playerId))
    .orderBy(asc(matches.date), asc(playerMarketValueHistory.id));

  return rows.map((row) => ({
    matchId: row.matchId,
    date: row.date,
    seasonKey: row.seasonKey,
    vmBefore: Number(row.vmBefore),
    vmAfter: Number(row.vmAfter),
    delta: Number(row.delta),
    goals: Number(row.goals ?? 0),
    assists: Number(row.assists ?? 0),
    points: Number(row.points ?? 0),
    mvpVotes: Number(row.mvpVotes ?? 0),
    peerAverage: row.peerAverage == null ? null : Number(row.peerAverage),
    performanceScore: Number(row.performanceScore ?? 0),
  }));
}

export function assignmentRows(rows: MatchRatingAssignment[]): RatingAssignment[] {
  return rows.map((row) => ({
    raterPlayerId: row.raterPlayerId,
    rateePlayerId: row.rateePlayerId,
    kind: row.kind,
  }));
}

export async function playerByUser(matchId: number, userId: number) {
  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    return undefined;
  }
  return playerRepo.checkUserAsPlayer(userId, match);
}
