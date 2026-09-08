import type { Express, Response } from "express";
import { endMatchSchema, insertMatchSchema, saveTeamsSchema } from "@shared/schema";
import { logger } from "../logger";
import { isLeagueAdmin, requireAuth, requireUser } from "../middleware/auth";
import { loadLeagueMember, loadMatchMember, rejectUnlessAdmin } from "../middleware/access";
import * as leagueRepo from "../repos/leagueRepo";
import * as matchRepo from "../repos/matchRepo";
import * as playerRepo from "../repos/playerRepo";
import * as userRepo from "../repos/userRepo";
import {
  canEndMatch,
  canStartMatch,
  hasActiveMatch,
  isJoinableStatus,
} from "@shared/domain/matchLifecycle";
import { teamsAreComplete, validateMatchTeams } from "@shared/domain/teams";
import type { AuthRequest } from "../types";

export function registerMatchRoutes(app: Express) {
  app.post("/api/matches", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
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
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;
      const participants = await matchRepo.getMatchParticipants(matchId);
      res.json({ ...access.match, participants });
    } catch (error) {
      logger.error("Error fetching match", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/matches/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Only league creator can delete matches")) {
        return;
      }

      await matchRepo.deleteMatch(matchId);
      logger.info("Match deleted", {
        match: matchId,
        league: access.league.id,
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
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Only league creator can start matches")) {
        return;
      }

      if (!canStartMatch(access.match.status)) {
        return res.status(400).json({
          message: "Only an Open match can be started",
          code: "MATCH_NOT_STARTABLE",
        });
      }

      const participants = await matchRepo.getMatchParticipants(matchId);
      const participantIds = participants
        .filter((participant) => participant.status === "accepted")
        .map((participant) => participant.playerId);
      const teamViolations = validateMatchTeams({
        participantIds,
        teamA: access.match.matchTeams?.teamA,
        teamB: access.match.matchTeams?.teamB,
      });
      if (teamViolations.length > 0) {
        return res.status(400).json({
          message: teamViolations[0].message,
          code: teamViolations[0].code,
          errors: teamViolations,
        });
      }

      const updatedMatch = await matchRepo.updateMatch(matchId, { status: "started" });
      logger.info("Match started", {
        match: matchId,
        league: access.league.id,
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

  app.get("/api/matches/:id/participants", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchMember(req, res, matchId);
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

      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Only league creator can add players to matches")) {
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
        if (player && player.leagueId === access.match.leagueId && !existingPlayerIds.includes(playerId)) {
          playersToAdd.push(player);
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
        complete: teamsAreComplete(updated?.matchTeams, participantIds),
      });
    } catch (error) {
      logger.error("Error assigning teams", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/matches/:id/join", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (!isJoinableStatus(access.match.status)) {
        return res.status(400).json({
          message: "Joining locks when the match starts",
          code: "MATCH_NOT_JOINABLE",
        });
      }

      const userAsPlayer = await playerRepo.checkUserAsPlayer(access.user.id, access.match.leagueId);
      if (!userAsPlayer) {
        return res.status(400).json({
          message: "You must be added as a player in this league first",
          needsPlayerRecord: true,
        });
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
