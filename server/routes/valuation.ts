import type { Express, Response } from "express";
import { insertTierListSchema } from "@shared/schema";
import { logger } from "../logger";
import { requireAuth } from "../middleware/auth";
import { loadClubMember, loadLeagueMember, rejectUnlessAdmin } from "../middleware/access";
import * as clubRepo from "../repos/clubRepo";
import * as leagueRepo from "../repos/leagueRepo";
import * as playerRepo from "../repos/playerRepo";
import * as valuationRepo from "../repos/valuationRepo";
import {
  marketValuesFromTierSubmissions,
  normalizeTierPlacements,
  type PlayerTierPlacement,
} from "@shared/domain/valuation";
import type { AuthRequest } from "../types";

export function registerValuationRoutes(app: Express) {
  app.post("/api/tierlist/:leagueId/open", requireAuth, async (req: AuthRequest, res: Response) => {
    const leagueId = parseInt(req.params.leagueId);
    const access = await loadLeagueMember(req, res, leagueId);
    if (!access) return;

    if (rejectUnlessAdmin(res, access.league, access.user.id, "Not authorized")) {
      return;
    }

    if (access.league.status !== "voting") {
      await leagueRepo.updateLeague(leagueId, { status: "voting" });
    }

    res.json({ message: "Valuation opened", status: "voting" });
  });

  app.post("/api/tierlist/:leagueId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;

      if (access.league.status !== "voting") {
        return res.status(400).json({ message: "Valuation is not open" });
      }

      const tierListData = insertTierListSchema.parse(req.body);
      const players = await playerRepo.getPlayersByLeague(leagueId);
      const playerIds = players.map((player) => player.id);
      const playerTiers = normalizeTierPlacements(
        tierListData.playerTiers as PlayerTierPlacement[],
        playerIds,
      );
      const submitted = tierListData.submitted ?? false;

      if (submitted && playerIds.length === 0) {
        return res.status(400).json({ message: "Add players before submitting" });
      }

      const existing = await valuationRepo.getTierList(leagueId, access.user.id);
      if (existing) {
        const updated = await valuationRepo.updateTierList(existing.id, {
          playerTiers,
          submitted: submitted || existing.submitted,
        });
        return res.json(updated);
      }

      const tierList = await valuationRepo.createTierList({
        playerTiers,
        submitted,
        leagueId,
        userId: access.user.id,
      });

      res.json(tierList);
    } catch (error) {
      logger.error("Tier list validation error", error);
      res.status(400).json({
        message: "Invalid input",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/tierlist/:leagueId/all", requireAuth, async (req: AuthRequest, res: Response) => {
    const leagueId = parseInt(req.params.leagueId);
    const access = await loadLeagueMember(req, res, leagueId);
    if (!access) return;

    const tierLists = await valuationRepo.getSubmittedTierListsByLeague(leagueId);
    res.json(tierLists);
  });

  app.get("/api/tierlist/:leagueId", requireAuth, async (req: AuthRequest, res: Response) => {
    const leagueId = parseInt(req.params.leagueId);
    const access = await loadLeagueMember(req, res, leagueId);
    if (!access) return;

    const tierList = await valuationRepo.getTierList(leagueId, access.user.id);
    res.json(tierList || null);
  });

  app.post("/api/tierlist/:leagueId/close", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Not authorized")) {
        return;
      }

      if (access.league.status !== "voting") {
        return res.status(400).json({ message: "Valuation is not open" });
      }

      const submittedLists = await valuationRepo.getSubmittedTierListsByLeague(leagueId);
      const players = await playerRepo.getPlayersByLeague(leagueId);
      const values = marketValuesFromTierSubmissions(
        players.map((player) => player.id),
        submittedLists.map((tierList) => (tierList.playerTiers ?? []) as PlayerTierPlacement[]),
      );

      await Promise.all(
        [...values.entries()].map(([playerId, marketValue]) =>
          playerRepo.updatePlayer(playerId, { marketValue }),
        ),
      );

      await leagueRepo.updateLeague(leagueId, { status: "closed" });
      res.json({ message: "League closed and values calculated" });
    } catch {
      res.status(400).json({ message: "Error closing league" });
    }
  });

  app.post("/api/clubs/:clubId/tierlist/open", requireAuth, async (req: AuthRequest, res: Response) => {
    const clubId = parseInt(req.params.clubId);
    const access = await loadClubMember(req, res, clubId);
    if (!access) return;

    if (rejectUnlessAdmin(res, access.club, access.user.id, "Not authorized")) {
      return;
    }

    if (access.club.status !== "voting") {
      await clubRepo.updateClub(clubId, { status: "voting" });
    }

    res.json({ message: "Valuation opened", status: "voting" });
  });

  app.post("/api/clubs/:clubId/tierlist", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const clubId = parseInt(req.params.clubId);
      const access = await loadClubMember(req, res, clubId);
      if (!access) return;

      if (access.club.status !== "voting") {
        return res.status(400).json({ message: "Valuation is not open" });
      }

      const tierListData = insertTierListSchema.parse(req.body);
      const players = await playerRepo.getPlayersByClub(clubId);
      const playerIds = players.map((player) => player.id);
      const playerTiers = normalizeTierPlacements(
        tierListData.playerTiers as PlayerTierPlacement[],
        playerIds,
      );
      const submitted = tierListData.submitted ?? false;

      if (submitted && playerIds.length === 0) {
        return res.status(400).json({ message: "Add players before submitting" });
      }

      const existing = await valuationRepo.getContextTierList({ clubId }, access.user.id);
      if (existing) {
        const updated = await valuationRepo.updateTierList(existing.id, {
          playerTiers,
          submitted: submitted || existing.submitted,
        });
        return res.json(updated);
      }

      const tierList = await valuationRepo.createTierList({
        playerTiers,
        submitted,
        clubId,
        userId: access.user.id,
      });

      res.json(tierList);
    } catch (error) {
      logger.error("Club tier list validation error", error);
      res.status(400).json({
        message: "Invalid input",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/clubs/:clubId/tierlist/all", requireAuth, async (req: AuthRequest, res: Response) => {
    const clubId = parseInt(req.params.clubId);
    const access = await loadClubMember(req, res, clubId);
    if (!access) return;

    const lists = await valuationRepo.getSubmittedTierLists({ clubId });
    res.json(lists);
  });

  app.get("/api/clubs/:clubId/tierlist", requireAuth, async (req: AuthRequest, res: Response) => {
    const clubId = parseInt(req.params.clubId);
    const access = await loadClubMember(req, res, clubId);
    if (!access) return;

    const tierList = await valuationRepo.getContextTierList({ clubId }, access.user.id);
    res.json(tierList || null);
  });

  app.post("/api/clubs/:clubId/tierlist/close", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const clubId = parseInt(req.params.clubId);
      const access = await loadClubMember(req, res, clubId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.club, access.user.id, "Not authorized")) {
        return;
      }

      if (access.club.status !== "voting") {
        return res.status(400).json({ message: "Valuation is not open" });
      }

      const submittedLists = await valuationRepo.getSubmittedTierLists({ clubId });
      const players = await playerRepo.getPlayersByClub(clubId);
      const values = marketValuesFromTierSubmissions(
        players.map((player) => player.id),
        submittedLists.map((tierList) => (tierList.playerTiers ?? []) as PlayerTierPlacement[]),
      );

      await Promise.all(
        [...values.entries()].map(([playerId, marketValue]) =>
          playerRepo.updatePlayer(playerId, { marketValue }),
        ),
      );

      await clubRepo.updateClub(clubId, { status: "closed" });
      res.json({ message: "Club closed and values calculated" });
    } catch {
      res.status(400).json({ message: "Error closing club" });
    }
  });
}
