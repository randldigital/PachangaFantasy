import type { Express, Response } from "express";
import { createClubSchema, insertPlayerSchema } from "@shared/schema";
import { logger } from "../logger";
import { isAdmin, isMember, loadClubMember } from "../middleware/access";
import { requireAuth, requireUser } from "../middleware/auth";
import * as clubRepo from "../repos/clubRepo";
import * as matchRepo from "../repos/matchRepo";
import * as playerRepo from "../repos/playerRepo";
import type { AuthRequest } from "../types";

export function registerClubRoutes(app: Express) {
  app.post("/api/clubs", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createClubSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }
      const { alias, ...clubData } = parsed.data;
      const user = requireUser(req);

      const club = await clubRepo.createClub(clubData, user.id);
      const creatorPlayer = await playerRepo.createPlayer({
        name: alias,
        clubId: club.id,
        userId: user.id,
        createdBy: user.id,
      });

      logger.info("Club created with creator as player", {
        club: club.id,
        player: creatorPlayer.id,
        creator: user.username,
      });

      res.json(club);
    } catch (error) {
      logger.error("Create club error", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Invalid input" });
    }
  });

  app.get("/api/clubs", requireAuth, async (req: AuthRequest, res: Response) => {
    res.json(await clubRepo.getUserClubs(requireUser(req).id));
  });

  app.get("/api/clubs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const club = await clubRepo.getClub(parseInt(req.params.id));
    if (!club || !isMember(club, requireUser(req).id)) {
      return res.status(404).json({ message: "Club not found" });
    }
    res.json(club);
  });

  app.get("/api/clubs/:id/players", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadClubMember(req, res, parseInt(req.params.id));
    if (!access) {
      return;
    }
    res.json(await playerRepo.getPlayersByClub(access.club.id));
  });

  app.post("/api/clubs/:id/players", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const club = await clubRepo.getClub(parseInt(req.params.id));
      if (!club) {
        return res.status(404).json({ message: "Club not found" });
      }
      if (!isAdmin(club, requireUser(req).id)) {
        return res.status(403).json({ message: "Only club creator can add players" });
      }

      const playerData = insertPlayerSchema.parse(req.body);
      const player = await playerRepo.createPlayer({
        ...playerData,
        clubId: club.id,
        createdBy: requireUser(req).id,
        isExternal: playerData.isExternal ?? true,
      });
      res.json(player);
    } catch (error) {
      logger.error("Add club player error", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get("/api/clubs/:id/matches", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadClubMember(req, res, parseInt(req.params.id));
    if (!access) {
      return;
    }
    res.json(await matchRepo.getMatchesByClub(access.club.id));
  });

  app.delete("/api/clubs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const clubId = parseInt(req.params.id);
      const club = await clubRepo.getClub(clubId);
      if (!club) {
        return res.status(404).json({ message: "Club not found" });
      }
      if (!isAdmin(club, requireUser(req).id)) {
        return res.status(403).json({ message: "Only club creator can delete the club" });
      }

      await clubRepo.deleteClub(clubId);
      logger.info("Club deleted", { club: clubId, creator: requireUser(req).username });
      res.json({ message: "Club deleted successfully" });
    } catch (error) {
      logger.error("Delete club error", error);
      res.status(500).json({ message: "Failed to delete club" });
    }
  });
}
