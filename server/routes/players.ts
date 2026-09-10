import type { Express, Response } from "express";
import type { MatchContext } from "@shared/domain/context";
import { aliasSchema, insertPlayerSchema, resolveClaimSchema, updateAliasSchema, type Player } from "@shared/schema";
import { logger } from "../logger";
import { isLeagueAdmin, requireAuth, requireUser } from "../middleware/auth";
import { isAdmin, loadClubMember, loadLeagueMember, type Organisation } from "../middleware/access";
import * as claimRepo from "../repos/claimRepo";
import * as clubRepo from "../repos/clubRepo";
import * as leagueRepo from "../repos/leagueRepo";
import * as playerRepo from "../repos/playerRepo";
import * as userRepo from "../repos/userRepo";
import type { AuthRequest } from "../types";

/** The League or Club that governs a Player, so alias and claim routes serve both. */
async function organisationOf(
  player: Player,
): Promise<{ context: MatchContext; organisation: Organisation } | undefined> {
  if (player.leagueId != null) {
    const league = await leagueRepo.getLeague(player.leagueId);
    return league ? { context: "league", organisation: league } : undefined;
  }
  const club = player.clubId != null ? await clubRepo.getClub(player.clubId) : undefined;
  return club ? { context: "club", organisation: club } : undefined;
}

/** Lists the pending claims of one League or Club for its administrator. */
async function listClaimRequests(res: Response, ref: { leagueId?: number; clubId?: number }) {
  const requests = await claimRepo.getPendingClaimsForContext(ref);
  const detailed = await Promise.all(
    requests.map(async (request) => {
      const [player, user] = await Promise.all([
        playerRepo.getPlayer(request.playerId),
        userRepo.getUser(request.userId),
      ]);
      return {
        id: request.id,
        playerId: request.playerId,
        playerName: player?.name ?? `#${request.playerId}`,
        userId: request.userId,
        username: user?.username ?? `#${request.userId}`,
        createdAt: request.createdAt,
      };
    }),
  );
  res.json(detailed);
}

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

      const requested = typeof req.body?.alias === "string" ? req.body.alias : user.username;
      const parsed = aliasSchema.safeParse(requested);
      if (!parsed.success) {
        return res.status(400).json({
          message: "An alias is required",
          code: "ALIAS_REQUIRED",
          errors: parsed.error.issues,
        });
      }

      const outcome = await playerRepo.resolveJoinAlias({
        leagueId,
        userId: user.id,
        alias: parsed.data,
      });

      if (outcome.kind === "alias_taken") {
        return res.status(409).json({
          message: "That alias is already used in this league",
          code: "ALIAS_TAKEN",
        });
      }
      if (outcome.kind === "claim_pending") {
        return res.status(409).json({
          message: "An administrator must confirm your claim before you can join",
          code: "CLAIM_PENDING",
          requestId: outcome.requestId,
        });
      }

      logger.info("User added themselves as player", {
        league: leagueId,
        player: outcome.player.id,
        alias: outcome.player.name,
      });
      res.json(outcome.player);
    } catch (error) {
      logger.error("Add user as player error", error);
      res.status(500).json({ message: "Failed to add user as player" });
    }
  });

  app.patch("/api/players/:id/alias", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const playerId = parseInt(req.params.id);
      const player = await playerRepo.getPlayer(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      const owner = await organisationOf(player);
      if (!owner) {
        return res.status(404).json({ message: "Player not found" });
      }
      if (!isAdmin(owner.organisation, requireUser(req).id)) {
        return res.status(403).json({
          message: "Only the administrator can change an alias",
          code: "ADMIN_ONLY",
        });
      }

      const parsed = updateAliasSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid alias", errors: parsed.error.issues });
      }

      const clash = await playerRepo.findByAlias(player, parsed.data.alias);
      if (clash && clash.id !== player.id) {
        return res.status(409).json({
          message: `That alias is already used in this ${owner.context}`,
          code: "ALIAS_TAKEN",
        });
      }

      const updated = await playerRepo.updatePlayer(playerId, { name: parsed.data.alias });
      logger.info("Administrator renamed a player", {
        context: owner.context,
        organisation: owner.organisation.id,
        player: playerId,
      });
      res.json(updated);
    } catch (error) {
      logger.error("Update alias error", error);
      res.status(500).json({ message: "Failed to update alias" });
    }
  });

  app.get("/api/leagues/:leagueId/claim-requests", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const access = await loadLeagueMember(req, res, leagueId);
      if (!access) return;
      if (!isLeagueAdmin(access.league, access.user.id)) {
        return res.status(403).json({ message: "Only the league administrator can review claims" });
      }

      await listClaimRequests(res, { leagueId });
    } catch (error) {
      logger.error("List claim requests error", error);
      res.status(500).json({ message: "Failed to list claim requests" });
    }
  });

  app.get("/api/clubs/:clubId/claim-requests", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const clubId = parseInt(req.params.clubId);
      const access = await loadClubMember(req, res, clubId);
      if (!access) return;
      if (!isAdmin(access.club, access.user.id)) {
        return res.status(403).json({ message: "Only the club administrator can review claims" });
      }

      await listClaimRequests(res, { clubId });
    } catch (error) {
      logger.error("List club claim requests error", error);
      res.status(500).json({ message: "Failed to list claim requests" });
    }
  });

  app.post("/api/claim-requests/:id/resolve", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const requestId = parseInt(req.params.id);
      const request = await claimRepo.getClaimRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Claim request not found" });
      }
      if (request.status !== "pending") {
        return res.status(400).json({
          message: "This claim has already been resolved",
          code: "CLAIM_ALREADY_RESOLVED",
        });
      }

      const player = await playerRepo.getPlayer(request.playerId);
      const owner = player ? await organisationOf(player) : undefined;
      if (!player || !owner) {
        return res.status(404).json({ message: "Claim request not found" });
      }

      const admin = requireUser(req);
      if (!isAdmin(owner.organisation, admin.id)) {
        return res.status(403).json({
          message: "Only the administrator can resolve claims",
          code: "ADMIN_ONLY",
        });
      }

      const parsed = resolveClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid decision", errors: parsed.error.issues });
      }

      if (parsed.data.decision === "reject") {
        await claimRepo.resolveClaim(requestId, "rejected", admin.id);
        logger.info("Administrator rejected a player claim", {
          context: owner.context,
          organisation: owner.organisation.id,
          player: player.id,
        });
        return res.json({ status: "rejected" });
      }

      const linked = await playerRepo.linkPlayerToUser(player.id, request.userId);
      await claimRepo.resolveClaim(requestId, "accepted", admin.id);
      const participants = owner.organisation.participants || [];
      const nextParticipants = participants.includes(request.userId)
        ? participants
        : [...participants, request.userId];
      const updated =
        owner.context === "league"
          ? await leagueRepo.updateLeague(owner.organisation.id, { participants: nextParticipants })
          : await clubRepo.updateClub(owner.organisation.id, { participants: nextParticipants });

      logger.info("Administrator accepted a player claim", {
        context: owner.context,
        organisation: owner.organisation.id,
        player: player.id,
      });
      res.json(
        owner.context === "league"
          ? { status: "accepted", player: linked, league: updated }
          : { status: "accepted", player: linked, club: updated },
      );
    } catch (error) {
      logger.error("Resolve claim request error", error);
      res.status(500).json({ message: "Failed to resolve claim request" });
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
