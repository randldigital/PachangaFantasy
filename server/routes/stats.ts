import type { Express, Response } from "express";
import { submitStatsSchema } from "@shared/schema";
import { logger } from "../logger";
import { requireAuth } from "../middleware/auth";
import { isAdmin, loadMatchAccess, loadMatchMember, rejectUnlessAdmin } from "../middleware/access";
import * as matchRepo from "../repos/matchRepo";
import * as playerRepo from "../repos/playerRepo";
import * as statsRepo from "../repos/statsRepo";
import { isClosedStatus } from "@shared/domain/matchLifecycle";
import { isStatsEditable } from "@shared/domain/stats";
import type { AuthRequest } from "../types";

async function statsPayload(matchId: number) {
  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    return undefined;
  }
  const participants = await matchRepo.getMatchParticipants(matchId);
  const reports = await statsRepo.getStatReportsForMatch(matchId);
  return {
    reports,
    status: statsRepo.matchStatsStatus(match, participants, reports),
  };
}

export function registerStatsRoutes(app: Express) {
  app.post("/api/matches/:matchId/stats", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      const parsed = submitStatsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }

      if (access.context === "league" && parsed.data.minutes != null) {
        return res.status(400).json({
          message: "Minutes are only recorded on club matches",
          code: "MINUTES_NOT_SUPPORTED",
        });
      }

      if (access.match.status === "scored" || isClosedStatus(access.match.status)) {
        return res.status(400).json({
          message: "Statistics cannot be changed after the match is scored",
          code: "STATS_LOCKED",
        });
      }

      if (!isStatsEditable(access.match.status)) {
        return res.status(400).json({
          message: "Can only submit statistics for a finished match",
          code: "STATS_NOT_EDITABLE",
        });
      }

      const ownPlayer = await playerRepo.checkUserAsPlayer(access.user.id, access.match);
      const targetPlayerId = parsed.data.playerId ?? ownPlayer?.id;
      if (!targetPlayerId) {
        return res.status(403).json({
          message: "Only match participants can submit statistics",
          code: "STATS_NOT_PARTICIPANT",
        });
      }

      const targetPlayer = await playerRepo.getPlayer(targetPlayerId);
      const sameContext =
        access.context === "league"
          ? targetPlayer?.leagueId === access.match.leagueId
          : targetPlayer?.clubId === access.match.clubId;
      if (!targetPlayer || !sameContext) {
        return res.status(404).json({ message: "Player not found" });
      }

      const userIsAdmin = isAdmin(access.organisation, access.user.id);
      const isOwnPlayer = targetPlayer.userId === access.user.id;
      if (!isOwnPlayer && !userIsAdmin) {
        return res.status(403).json({
          message: "You can only submit your own statistics",
          code: "STATS_NOT_PARTICIPANT",
        });
      }

      const participants = await matchRepo.getMatchParticipants(matchId);
      const participated = participants.some(
        (participant) =>
          participant.playerId === targetPlayerId && participant.status === "accepted",
      );
      if (!participated) {
        return res.status(403).json({
          message: "Only match participants can submit statistics",
          code: "STATS_NOT_PARTICIPANT",
        });
      }

      const existing = await statsRepo.getStatReportForPlayer(matchId, targetPlayerId);
      const payload = {
        playerId: targetPlayerId,
        matchId,
        goals: parsed.data.goals,
        assists: parsed.data.assists,
        ...(access.context === "club" ? { minutes: parsed.data.minutes ?? 0 } : {}),
      };

      const statReport = existing
        ? await statsRepo.updateStatReport(existing.id, payload)
        : await statsRepo.createStatReport(payload);

      if (access.match.statsAcknowledged) {
        await matchRepo.updateMatch(matchId, { statsAcknowledged: false });
      }

      res.json(statReport);
    } catch (error) {
      logger.error("Error creating stat report", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/matches/:matchId/stats", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;
      const reports = await statsRepo.getStatReportsForMatch(matchId);
      res.json(reports);
    } catch (error) {
      logger.error("Error fetching stat reports", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/matches/:matchId/stats-status", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;
      const payload = await statsPayload(matchId);
      res.json(payload);
    } catch (error) {
      logger.error("Error fetching stats status", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/matches/:matchId/validate-goals", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Only league creator can validate goals")) {
        return;
      }

      const payload = await statsPayload(matchId);
      if (!payload) {
        return res.status(404).json({ message: "Match not found" });
      }

      logger.info("League creator validated goals", {
        league: access.league.id,
        match: matchId,
        creator: access.user.username,
        state: payload.status.state,
      });
      res.json({
        isValid: payload.status.consistent,
        reportedTotal: payload.status.reportedTotal,
        expectedTotal: payload.status.expectedTotal,
        difference: payload.status.difference ?? 0,
        pendingPlayerIds: payload.status.pendingPlayerIds,
        state: payload.status.state,
      });
    } catch (error) {
      logger.error("Error validating match goals", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/matches/:matchId/acknowledge-stats", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Only the league administrator can acknowledge statistics")) {
        return;
      }

      if (access.match.status === "scored") {
        return res.status(400).json({
          message: "Statistics cannot be changed after the match is scored",
          code: "STATS_LOCKED",
        });
      }

      if (!isStatsEditable(access.match.status)) {
        return res.status(400).json({
          message: "Can only acknowledge statistics for a finished match",
          code: "STATS_NOT_EDITABLE",
        });
      }

      const participants = await matchRepo.getMatchParticipants(matchId);
      const reports = await statsRepo.getStatReportsForMatch(matchId);
      const status = statsRepo.matchStatsStatus(access.match, participants, reports);

      if (!status.complete) {
        return res.status(400).json({
          message: "Cannot acknowledge statistics until every participant has submitted",
          code: "STATS_INCOMPLETE",
          ...status,
        });
      }

      if (status.consistent) {
        return res.status(400).json({
          message: "Goal totals already match; acknowledgement is not needed",
          code: "STATS_ALREADY_VALID",
          ...status,
        });
      }

      if (!status.assistsOk) {
        return res.status(400).json({
          message: "Assists cannot exceed the match goal total. Correct the statistics before scoring.",
          code: "STATS_ASSISTS_EXCEED",
          ...status,
        });
      }

      const updated = await matchRepo.updateMatch(matchId, { statsAcknowledged: true });
      res.json({
        match: updated,
        status: statsRepo.matchStatsStatus(updated!, participants, reports),
        reports,
      });
    } catch (error) {
      logger.error("Error acknowledging stats", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
