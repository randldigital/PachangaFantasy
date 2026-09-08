import type { Express, Response } from "express";
import { logger } from "../logger";
import { requireAuth } from "../middleware/auth";
import { loadLeagueMember } from "../middleware/access";
import * as scoreRepo from "../repos/scoreRepo";
import type { AuthRequest } from "../types";

export function registerLeaderboardRoutes(app: Express) {
  app.get("/api/leagues/:leagueId/rankings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;
      const rankings = await scoreRepo.getPlayerLeaderboard(leagueId);
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
      const rankings = await scoreRepo.getManagerLeaderboard(leagueId);
      res.json(rankings);
    } catch (error) {
      logger.error("Error fetching manager rankings", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
