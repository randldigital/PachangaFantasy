import {
  matchPlayerVm,
  matchRatingAssignments,
  matchMvpVotes,
  matchPeerRatings,
  playerMarketValueHistory,
  type MatchMvpVote,
  type MatchPeerRating,
  type MatchPlayerVm,
  type MatchRatingAssignment,
  type PlayerMarketValueHistory,
} from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import * as matchRepo from "./matchRepo";
import * as playerRepo from "./playerRepo";
import { assignMatchRatings, ratingsAreComplete } from "@shared/domain/ratingAssignments";
import { assignClubRatings } from "@shared/domain/clubRatingAssignments";
import type { RatingAssignment } from "@shared/domain/ratingAssignments";

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
