import type { Express, Response } from "express";
import { insertPlayerSchema } from "@shared/schema";
import { logger } from "../logger";
import { isLeagueAdmin, requireAuth, requireUser } from "../middleware/auth";
import { loadLeagueMember } from "../middleware/access";
import * as leagueRepo from "../repos/leagueRepo";
import * as playerRepo from "../repos/playerRepo";
import type { AuthRequest } from "../types";

export function registerPlayerRoutes(app: Express) {
  app.post("/api/players/:leagueId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const league = await leagueRepo.getLeague(leagueId);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (!isLeagueAdmin(league, requireUser(req).id)) {
        return res.status(403).json({ message: "Only league creator can add players" });
      }

      const playerData = insertPlayerSchema.parse(req.body);
      const isExternal = playerData.isExternal ?? false;

      const player = await playerRepo.createPlayer({
        name: playerData.name,
        emoji: playerData.emoji,
        leagueId,
        createdBy: requireUser(req).id,
        isExternal,
        userId: undefined,
      });

      logger.info("League creator added player", {
        league: leagueId,
        player: player.id,
        creator: requireUser(req).username,
        isExternal,
      });
      res.json(player);
    } catch (error) {
      logger.error("Add player error", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get("/api/players/:leagueId", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadLeagueMember(req, res, parseInt(req.params.leagueId));
    if (!access) return;

    const players = await playerRepo.getPlayersByLeague(access.league.id);
    res.json(players);
  });

  app.post("/api/leagues/:leagueId/add-me-as-player", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;
      const user = access.user;

      const existingPlayer = await playerRepo.checkUserAsPlayer(user.id, leagueId);
      if (existingPlayer) {
        return res.status(400).json({ message: "You are already a player in this league", player: existingPlayer });
      }

      const { player, claimed } = await playerRepo.claimUnlinkedOrCreatePlayer({
        leagueId,
        userId: user.id,
        username: user.username,
      });
      logger.info(claimed ? "Repaired existing player record" : "User added themselves as player", {
        league: leagueId,
        player: player.id,
        username: user.username,
      });
      res.json(player);
    } catch (error) {
      logger.error("Add user as player error", error);
      res.status(500).json({ message: "Failed to add user as player" });
    }
  });

  app.get("/api/leagues/:leagueId/check-user-player", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;
      const existingPlayer = await playerRepo.checkUserAsPlayer(access.user.id, leagueId);
      res.json({ isPlayer: !!existingPlayer, player: existingPlayer || null });
    } catch {
      res.status(500).json({ message: "Failed to check user player status" });
    }
  });
}
