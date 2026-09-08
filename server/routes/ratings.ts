import type { Express, Response } from "express";
import { submitRatingsSchema } from "@shared/schema";
import { logger } from "../logger";
import { requireAuth } from "../middleware/auth";
import { loadMatchMember } from "../middleware/access";
import { isStatsEditable } from "@shared/domain/stats";
import { ballotMatchesAssignments } from "@shared/domain/ratingAssignments";
import * as matchRepo from "../repos/matchRepo";
import * as playerRepo from "../repos/playerRepo";
import * as ratingRepo from "../repos/ratingRepo";
import type { AuthRequest } from "../types";

async function ratingsPayload(matchId: number, leagueId: number, userId: number) {
  const [assignments, votes, peerRatings, voters, submitted, history, roster, vmRows, ownPlayer] =
    await Promise.all([
      ratingRepo.getRatingAssignments(matchId),
      ratingRepo.getMvpVotes(matchId),
      ratingRepo.getPeerRatings(matchId),
      ratingRepo.voterPlayerIdsForMatch(matchId),
      ratingRepo.submittedVoterIds(matchId),
      ratingRepo.getMarketValueHistory(matchId),
      playerRepo.getPlayersByLeague(leagueId),
      ratingRepo.getMatchPlayerVm(matchId),
      playerRepo.checkUserAsPlayer(userId, leagueId),
    ]);

  const names = new Map(roster.map((player) => [player.id, player.name]));
  const myAssignments = ownPlayer
    ? assignments.filter((row) => row.raterPlayerId === ownPlayer.id)
    : [];
  const myVote = ownPlayer
    ? votes.find((vote) => vote.voterPlayerId === ownPlayer.id)
    : undefined;
  const myRatings = ownPlayer
    ? peerRatings.filter((row) => row.raterPlayerId === ownPlayer.id)
    : [];

  return {
    ratingsComplete: voters.every((id) => submitted.includes(id)),
    voterCount: voters.length,
    submittedCount: submitted.length,
    submittedVoterIds: submitted,
    assignments: myAssignments.map((row) => ({
      playerId: row.rateePlayerId,
      name: names.get(row.rateePlayerId) ?? `#${row.rateePlayerId}`,
      kind: row.kind,
      score: myRatings.find((rating) => rating.rateePlayerId === row.rateePlayerId)?.score ?? null,
    })),
    myBallot:
      ownPlayer && voters.includes(ownPlayer.id)
        ? {
            voterPlayerId: ownPlayer.id,
            submitted: Boolean(myVote),
            mvpPlayerId: myVote?.mvpPlayerId ?? null,
          }
        : null,
    history: history.map((row) => ({
      playerId: row.playerId,
      name: names.get(row.playerId) ?? `#${row.playerId}`,
      vmBefore: row.vmBefore,
      vmAfter: row.vmAfter,
      delta: row.delta,
      performanceScore: row.performanceScore,
    })),
    preMatchVm: Object.fromEntries(vmRows.map((row) => [row.playerId, row.marketValue])),
  };
}

export function registerRatingRoutes(app: Express) {
  app.get("/api/matches/:matchId/ratings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;
      if (access.match.status === "completed" || access.match.status === "scored") {
        await ratingRepo.ensureRatingAssignments(matchId);
        await ratingRepo.snapshotMatchPlayerVm(matchId);
      }
      res.json(await ratingsPayload(matchId, access.match.leagueId, access.user.id));
    } catch (error) {
      logger.error("Error fetching match ratings", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/matches/:matchId/ratings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (access.match.status === "scored") {
        return res.status(400).json({
          message: "Ratings are locked because this match has been scored",
          code: "STATS_LOCKED",
        });
      }
      if (!isStatsEditable(access.match.status)) {
        return res.status(400).json({
          message: "Ratings can be submitted after the match is finished",
          code: "STATS_NOT_EDITABLE",
        });
      }

      const parsed = submitRatingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }

      const ownPlayer = await playerRepo.checkUserAsPlayer(access.user.id, access.match.leagueId);
      if (!ownPlayer) {
        return res.status(403).json({
          message: "Only match participants can submit ratings",
          code: "STATS_NOT_PARTICIPANT",
        });
      }

      const voters = await ratingRepo.voterPlayerIdsForMatch(matchId);
      if (!voters.includes(ownPlayer.id)) {
        return res.status(403).json({
          message: "Only registered participants can submit ratings",
          code: "STATS_NOT_PARTICIPANT",
        });
      }

      if (parsed.data.mvpPlayerId === ownPlayer.id) {
        return res.status(400).json({
          message: "You cannot vote for yourself as Player of the Match",
          code: "RATINGS_INVALID",
        });
      }

      const participantIds = (await matchRepo.getMatchParticipants(matchId))
        .filter((participant) => participant.status === "accepted")
        .map((participant) => participant.playerId);
      if (!participantIds.includes(parsed.data.mvpPlayerId)) {
        return res.status(400).json({
          message: "Player of the Match must have played this match",
          code: "RATINGS_INVALID",
        });
      }

      const assignments = await ratingRepo.ensureRatingAssignments(matchId);
      if (
        !ballotMatchesAssignments(
          ownPlayer.id,
          parsed.data.ratings,
          ratingRepo.assignmentRows(assignments),
        )
      ) {
        return res.status(400).json({
          message: "Rate exactly the assigned teammate and rival",
          code: "RATINGS_INVALID",
        });
      }

      await ratingRepo.saveBallot(
        matchId,
        ownPlayer.id,
        parsed.data.mvpPlayerId,
        parsed.data.ratings,
      );
      res.json(await ratingsPayload(matchId, access.match.leagueId, access.user.id));
    } catch (error) {
      logger.error("Error saving match ratings", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
