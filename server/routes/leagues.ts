import type { Express, Response } from "express";
import { createLeagueSchema } from "@shared/schema";
import { logger } from "../logger";
import { isLeagueAdmin, isLeagueMember, requireAuth, requireUser } from "../middleware/auth";
import * as leagueRepo from "../repos/leagueRepo";
import * as playerRepo from "../repos/playerRepo";
import type { AuthRequest } from "../types";

export function registerLeagueRoutes(app: Express) {
  app.post("/api/leagues", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createLeagueSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }
      const { alias, ...leagueData } = parsed.data;
      const user = requireUser(req);

      logger.info(`Creating league for user ${user.username} (ID: ${user.id})`);
      const league = await leagueRepo.createLeague(leagueData, user.id);
      logger.info(`League created: ${league.id}, now creating player record...`);

      const creatorPlayer = await playerRepo.createPlayer({
        name: alias,
        leagueId: league.id,
        userId: user.id,
        createdBy: user.id,
      });

      logger.info("League created with creator as player", {
        league: league.id,
        player: creatorPlayer.id,
        creator: user.username,
        playerUserId: creatorPlayer.userId,
      });

      res.json(league);
    } catch (error) {
      logger.error("Create league error", error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid input" });
      }
    }
  });

  app.get("/api/leagues", requireAuth, async (req: AuthRequest, res: Response) => {
    const leagues = await leagueRepo.getUserLeagues(requireUser(req).id);
    res.json(leagues);
  });

  app.get("/api/leagues/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const league = await leagueRepo.getLeague(parseInt(req.params.id));

    if (!league) {
      return res.status(404).json({ message: "League not found" });
    }

    if (!isLeagueMember(league, requireUser(req).id)) {
      return res.status(404).json({ message: "League not found" });
    }

    res.json(league);
  });

  app.delete("/api/leagues/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.id);
      const league = await leagueRepo.getLeague(leagueId);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (!isLeagueAdmin(league, requireUser(req).id)) {
        return res.status(403).json({ message: "Only league creator can delete the league" });
      }

      await leagueRepo.deleteLeague(leagueId);
      logger.info("League deleted", { league: leagueId, creator: requireUser(req).username });
      res.json({ message: "League deleted successfully" });
    } catch (error) {
      logger.error("Delete league error", error);
      res.status(500).json({ message: "Failed to delete league" });
    }
  });
}
