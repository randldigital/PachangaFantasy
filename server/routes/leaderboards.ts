import type { Express, Response } from "express";
import { logger } from "../logger";
import { requireAuth } from "../middleware/auth";
import { loadClubMember, loadLeagueMember } from "../middleware/access";
import * as scoreRepo from "../repos/scoreRepo";
import { isSeasonKey } from "@shared/domain/season";
import type { AuthRequest } from "../types";

/** `?season=2026/27`; omitted or malformed means every season. */
function seasonParam(req: AuthRequest): string | undefined {
  const raw = req.query.season;
  return typeof raw === "string" && isSeasonKey(raw) ? raw : undefined;
}

export function registerLeaderboardRoutes(app: Express) {
  app.get("/api/leagues/:leagueId/rankings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;
      const rankings = await scoreRepo.getPlayerLeaderboard(leagueId, seasonParam(req));
      res.json(rankings);
    } catch (error) {
      logger.error("Error fetching player rankings", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/leagues/:leagueId/manager-rankings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;
      const rankings = await scoreRepo.getManagerLeaderboard(leagueId, seasonParam(req));
      res.json(rankings);
    } catch (error) {
      logger.error("Error fetching manager rankings", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/leagues/:leagueId/seasons", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;
      res.json(await scoreRepo.getLeagueSeasons(leagueId));
    } catch (error) {
      logger.error("Error fetching league seasons", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/clubs/:clubId/rankings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const clubId = parseInt(req.params.clubId);
      const access = await loadClubMember(req, res, clubId);
      if (!access) return;
      res.json(await scoreRepo.getClubPlayerLeaderboard(clubId, seasonParam(req)));
    } catch (error) {
      logger.error("Error fetching club rankings", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/clubs/:clubId/seasons", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const clubId = parseInt(req.params.clubId);
      const access = await loadClubMember(req, res, clubId);
      if (!access) return;
      res.json(await scoreRepo.getClubSeasons(clubId));
    } catch (error) {
      logger.error("Error fetching club seasons", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/clubs/:clubId/aggregates", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const clubId = parseInt(req.params.clubId);
      const access = await loadClubMember(req, res, clubId);
      if (!access) return;
      res.json(await scoreRepo.getClubSeasonAggregates(clubId));
    } catch (error) {
      logger.error("Error fetching club aggregates", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
