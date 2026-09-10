import type { Express, Response } from "express";
import {
  clubResultSchema,
  createMatchSchema,
  endMatchSchema,
  insertClubMatchSchema,
  insertMatchSchema,
  saveTeamsSchema,
} from "@shared/schema";
import { logger } from "../logger";
import { isLeagueAdmin, requireAuth, requireUser } from "../middleware/auth";
import {
  isAdmin,
  loadLeagueMember,
  loadMatchAccess,
  loadMatchMember,
  rejectUnlessAdmin,
} from "../middleware/access";
import * as clubRepo from "../repos/clubRepo";
import * as leagueRepo from "../repos/leagueRepo";
import * as matchRepo from "../repos/matchRepo";
import * as playerRepo from "../repos/playerRepo";
import * as ratingRepo from "../repos/ratingRepo";
import * as scoreRepo from "../repos/scoreRepo";
import * as userRepo from "../repos/userRepo";
import {
  canCloseMatch,
  canEndMatch,
  canStartMatch,
  hasActiveMatch,
  isJoinableStatus,
} from "@shared/domain/matchLifecycle";
import { matchCapacity, sideSizeOf, teamsAreComplete, validateMatchTeams } from "@shared/domain/teams";
import type { AuthRequest } from "../types";

/** Creating a Club Match: a date and an opponent name, with no Fantasy machinery. */
async function createClubMatch(req: AuthRequest, res: Response) {
  const parsed = insertClubMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
  }

  const user = requireUser(req);
  const club = await clubRepo.getClub(parsed.data.clubId);
  if (!club) {
    return res.status(404).json({ message: "Club not found" });
  }
  if (!isAdmin(club, user.id)) {
    return res.status(403).json({ message: "Only club creator can create matches" });
  }

  const existing = await matchRepo.getMatchesByClub(club.id);
  if (hasActiveMatch(existing)) {
    return res.status(409).json({
      message: "A club may have only one Open or Started match",
      code: "MATCH_ALREADY_ACTIVE",
    });
  }

  const match = await matchRepo.createMatch({ ...parsed.data, createdBy: user.id });
  logger.info("Club creator created match", { club: club.id, match: match.id });
  return res.json(match);
}

export function registerMatchRoutes(app: Express) {
  app.post("/api/matches", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const context = createMatchSchema.safeParse(req.body);
      if (!context.success) {
        return res.status(400).json({ message: "Invalid input", errors: context.error.issues });
      }
      if (req.body?.clubId != null) {
        return await createClubMatch(req, res);
      }

      const result = insertMatchSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.issues });
      }

      const user = requireUser(req);
      logger.info(`Creating match for user ${user.username} (ID: ${user.id}) in league ${result.data.leagueId}`);

      const league = await leagueRepo.getLeague(result.data.leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (!isLeagueAdmin(league, user.id)) {
        return res.status(403).json({ message: "Only league creator can create matches" });
      }

      const existingMatches = await matchRepo.getMatchesByLeague(result.data.leagueId);
      if (hasActiveMatch(existingMatches)) {
        return res.status(409).json({
          message: "A league may have only one Open or Started match",
          code: "MATCH_ALREADY_ACTIVE",
        });
      }

      const creatorAsPlayer = await playerRepo.checkUserAsPlayer(user.id, result.data.leagueId);
      if (!creatorAsPlayer) {
        logger.info(`Creator missing player record, creating one for league ${result.data.leagueId}`);
        await playerRepo.createPlayer({
          name: user.username,
          leagueId: result.data.leagueId,
          userId: user.id,
          createdBy: user.id,
        });
      }

      const match = await matchRepo.createMatch({
        ...result.data,
        createdBy: user.id,
      });
      logger.info("League creator created match", {
        league: league.id,
        match: match.id,
        creator: user.username,
      });
      res.json(match);
    } catch (error) {
      logger.error("Error creating match", error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/leagues/:leagueId/matches", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;
      const matches = await matchRepo.getMatchesByLeague(leagueId);
      res.json(matches);
    } catch (error) {
      logger.error("Error fetching matches", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/matches/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;
      const participants = await matchRepo.getMatchParticipants(matchId);
      res.json({ ...access.match, participants });
    } catch (error) {
      logger.error("Error fetching match", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/matches/:id/recap", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;
      const recap = await scoreRepo.getMatchRecap(matchId);
      if (!recap) {
        return res.status(404).json({ message: "Match not found" });
      }
      res.json(recap);
    } catch (error) {
      logger.error("Error fetching match recap", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/matches/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.organisation, access.user.id, "Only league creator can delete matches")) {
        return;
      }

      await matchRepo.deleteMatch(matchId);
      logger.info("Match deleted", {
        match: matchId,
        context: access.context,
        organisation: access.organisation.id,
        creator: access.user.username,
      });
      res.json({ message: "Match deleted successfully" });
    } catch (error) {
      logger.error("Delete match error", error);
      res.status(500).json({ message: "Failed to delete match" });
    }
  });

  app.post("/api/matches/:id/start", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.organisation, access.user.id, "Only league creator can start matches")) {
        return;
      }

      if (!canStartMatch(access.match.status)) {
        return res.status(400).json({
          message: "Only an Open match can be started",
          code: "MATCH_NOT_STARTABLE",
        });
      }

      // A Club match has no Team A/B, so there is nothing to validate before kick-off.
      if (access.context === "league") {
        const participants = await matchRepo.getMatchParticipants(matchId);
        const participantIds = participants
          .filter((participant) => participant.status === "accepted")
          .map((participant) => participant.playerId);
        const teamViolations = validateMatchTeams({
          participantIds,
          teamA: access.match.matchTeams?.teamA,
          teamB: access.match.matchTeams?.teamB,
          sideSize: sideSizeOf(access.match),
          requireFullSides: true,
        });
        if (teamViolations.length > 0) {
          return res.status(400).json({
            message: teamViolations[0].message,
            code: teamViolations[0].code,
            errors: teamViolations,
          });
        }
      }

      const updatedMatch = await matchRepo.updateMatch(matchId, { status: "started" });
      if (access.context === "league") {
        await ratingRepo.snapshotMatchPlayerVm(matchId);
      }
      logger.info("Match started", {
        match: matchId,
        context: access.context,
        organisation: access.organisation.id,
        creator: access.user.username,
      });
      res.json({
        message: "Match started. Lineups and joining are locked.",
        match: updatedMatch,
      });
    } catch (error) {
      logger.error("Start match error", error);
      res.status(500).json({ message: "Failed to start match" });
    }
  });

  app.post("/api/matches/:id/end", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Only league creator can end matches")) {
        return;
      }

      if (!canEndMatch(access.match.status)) {
        return res.status(400).json({
          message: "Start the match before ending it",
          code: "MATCH_NOT_ENDABLE",
        });
      }

      const parsed = endMatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Both team scores are required", errors: parsed.error.issues });
      }

      const updatedMatch = await matchRepo.updateMatch(matchId, {
        status: "completed",
        teamAGoals: parsed.data.teamAGoals,
        teamBGoals: parsed.data.teamBGoals,
        finalScore: parsed.data.teamAGoals + parsed.data.teamBGoals,
      });
      await ratingRepo.snapshotMatchPlayerVm(matchId);
      await ratingRepo.ensureRatingAssignments(matchId);
      logger.info("Match ended", {
        match: matchId,
        league: access.league.id,
        creator: access.user.username,
        teamAGoals: parsed.data.teamAGoals,
        teamBGoals: parsed.data.teamBGoals,
        finalScore: parsed.data.teamAGoals + parsed.data.teamBGoals,
      });
      res.json({
        message: "Match ended successfully. Participants can now submit stats.",
        match: updatedMatch,
      });
    } catch (error) {
      logger.error("End match error", error);
      res.status(500).json({ message: "Failed to end match" });
    }
  });

  /**
   * A Club Match ends by recording the opponent and the score. The opponent is a name,
   * never a roster, so there is no Team A/B and no per-opponent statistics.
   */
  app.post("/api/matches/:id/club-result", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      if (access.context !== "club") {
        return res.status(400).json({
          message: "Only club matches record an opponent result",
          code: "NOT_A_CLUB_MATCH",
        });
      }
      if (rejectUnlessAdmin(res, access.organisation, access.user.id, "Only club creator can record the result")) {
        return;
      }
      if (!canEndMatch(access.match.status)) {
        return res.status(400).json({
          message: "Start the match before recording the result",
          code: "MATCH_NOT_ENDABLE",
        });
      }

      const parsed = clubResultSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }

      const updated = await matchRepo.updateMatch(matchId, {
        status: "completed",
        opponentName: parsed.data.opponentName,
        ourGoals: parsed.data.ourGoals,
        opponentGoals: parsed.data.opponentGoals,
        finalScore: parsed.data.ourGoals,
      });
      await ratingRepo.ensureRatingAssignments(matchId);
      logger.info("Club match result recorded", {
        match: matchId,
        club: access.organisation.id,
        ourGoals: parsed.data.ourGoals,
        opponentGoals: parsed.data.opponentGoals,
      });
      res.json({
        message: "Result recorded. Participants can now submit statistics and ratings.",
        match: updated,
      });
    } catch (error) {
      logger.error("Club result error", error);
      res.status(500).json({ message: "Failed to record the club match result" });
    }
  });

  /**
   * Closing is a separate, explicit administrator action after scoring. A closed match is
   * immutable: no late statistics, no late ratings, no recalculation.
   */
  app.post("/api/matches/:id/close", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      if (access.context !== "club") {
        return res.status(400).json({
          message: "Only club matches are closed explicitly",
          code: "NOT_A_CLUB_MATCH",
        });
      }
      if (rejectUnlessAdmin(res, access.organisation, access.user.id, "Only club creator can close matches")) {
        return;
      }
      if (!canCloseMatch(access.match.status)) {
        return res.status(400).json({
          message: "Score the match before closing it",
          code: "MATCH_NOT_CLOSEABLE",
        });
      }

      const updated = await matchRepo.updateMatch(matchId, { status: "closed" });
      logger.info("Club match closed", { match: matchId, club: access.organisation.id });
      res.json({ message: "Match closed", match: updated });
    } catch (error) {
      logger.error("Close match error", error);
      res.status(500).json({ message: "Failed to close the match" });
    }
  });

  app.get("/api/matches/:id/participants", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      const participants = await matchRepo.getMatchParticipants(matchId);

      const participantsWithDetails = await Promise.all(
        participants.map(async (participant) => {
          const player = await playerRepo.getPlayer(participant.playerId);
          let user = null;
          if (player?.userId) {
            user = await userRepo.getUser(player.userId);
          }

          return {
            matchId: participant.matchId,
            playerId: participant.playerId,
            status: participant.status,
            playerName: player?.name || "Unknown Player",
            userId: player?.userId,
            username: user?.username,
          };
        }),
      );

      res.json(participantsWithDetails);
    } catch (error) {
      logger.error("Error fetching match participants", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/matches/:id/add-players", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const { playerIds } = req.body;

      if (!Array.isArray(playerIds) || playerIds.length === 0) {
        return res.status(400).json({ message: "playerIds array is required" });
      }

      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.organisation, access.user.id, "Only league creator can add players to matches")) {
        return;
      }

      if (!isJoinableStatus(access.match.status)) {
        return res.status(400).json({
          message: "Joining locks when the match starts",
          code: "MATCH_NOT_JOINABLE",
        });
      }

      const existingParticipants = await matchRepo.getMatchParticipants(matchId);
      const existingPlayerIds = existingParticipants.map((participant) => participant.playerId);

      const playersToAdd = [];
      for (const playerId of playerIds) {
        const player = await playerRepo.getPlayer(playerId);
        const sameContext =
          access.context === "league"
            ? player?.leagueId === access.match.leagueId
            : player?.clubId === access.match.clubId;
        if (player && sameContext && !existingPlayerIds.includes(playerId)) {
          playersToAdd.push(player);
        }
      }

      // A Club squad is not capped: only Fantasy sides have a fixed size.
      if (access.context === "league") {
        const capacity = matchCapacity(sideSizeOf(access.match));
        if (existingPlayerIds.length + playersToAdd.length > capacity) {
          return res.status(400).json({
            message: `This match holds ${capacity} players`,
            code: "MATCH_FULL",
            capacity,
          });
        }
      }

      const newParticipants = [];
      for (const player of playersToAdd) {
        const participant = await matchRepo.addPlayerToMatch(matchId, player.id);
        newParticipants.push(participant);
      }

      res.json({
        message: `${newParticipants.length} players added to match`,
        addedCount: newParticipants.length,
        participants: newParticipants,
      });
    } catch (error) {
      logger.error("Error adding players to match", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/matches/:id/teams", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Only league creator can assign teams")) {
        return;
      }

      if (!isJoinableStatus(access.match.status)) {
        return res.status(400).json({
          message: "Teams lock when the match starts",
          code: "TEAMS_LOCKED",
        });
      }

      const parsed = saveTeamsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }

      const participants = await matchRepo.getMatchParticipants(matchId);
      const participantIds = participants
        .filter((participant) => participant.status === "accepted")
        .map((participant) => participant.playerId);
      const violations = validateMatchTeams({
        participantIds,
        teamA: parsed.data.teamA,
        teamB: parsed.data.teamB,
        sideSize: sideSizeOf(access.match),
      });
      if (violations.length > 0) {
        return res.status(400).json({
          message: violations[0].message,
          code: violations[0].code,
          errors: violations,
        });
      }

      const updated = await matchRepo.updateMatch(matchId, {
        matchTeams: { teamA: parsed.data.teamA, teamB: parsed.data.teamB },
      });
      res.json({
        message: "Teams saved",
        match: updated,
        complete: teamsAreComplete(updated?.matchTeams, participantIds, sideSizeOf(access.match)),
      });
    } catch (error) {
      logger.error("Error assigning teams", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/matches/:id/join", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      if (!isJoinableStatus(access.match.status)) {
        return res.status(400).json({
          message: "Joining locks when the match starts",
          code: "MATCH_NOT_JOINABLE",
        });
      }

      const userAsPlayer = await playerRepo.checkUserAsPlayer(access.user.id, access.match);
      if (!userAsPlayer) {
        return res.status(400).json({
          message: "You must be added as a player in this league first",
          needsPlayerRecord: true,
        });
      }

      if (access.context === "league") {
        const capacity = matchCapacity(sideSizeOf(access.match));
        const current = await matchRepo.getMatchParticipants(matchId);
        const alreadyIn = current.some((participant) => participant.playerId === userAsPlayer.id);
        if (!alreadyIn && current.length >= capacity) {
          return res.status(400).json({
            message: `This match holds ${capacity} players`,
            code: "MATCH_FULL",
            capacity,
          });
        }
      }

      const participant = await matchRepo.joinMatch(matchId, access.user.id);
      res.json(participant);
    } catch (error) {
      logger.error("Error joining match", error);
      if (error instanceof Error) {
        if (error.message.includes("not a player")) {
          return res.status(400).json({
            message: "You must be added as a player in this league first",
            needsPlayerRecord: true,
          });
        }
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
