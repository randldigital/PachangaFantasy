import type { Express, Response } from "express";
import { joinOrganisationSchema, membershipSchema } from "@shared/schema";
import { parseInviteCode } from "@shared/domain/inviteCodes";
import type { ContextRef, MatchContext } from "@shared/domain/context";
import { logger } from "../logger";
import { isAdmin, isMember, type Organisation } from "../middleware/access";
import { requireAuth, requireUser } from "../middleware/auth";
import * as claimRepo from "../repos/claimRepo";
import * as clubRepo from "../repos/clubRepo";
import * as leagueRepo from "../repos/leagueRepo";
import * as playerRepo from "../repos/playerRepo";
import type { AuthRequest } from "../types";

const WORDING = {
  league: { noun: "league", alreadyCode: "ALREADY_IN_LEAGUE", idKey: "leagueId" },
  club: { noun: "club", alreadyCode: "ALREADY_IN_CLUB", idKey: "clubId" },
} as const;

function refFor(context: MatchContext, organisationId: number): ContextRef {
  return context === "league" ? { leagueId: organisationId } : { clubId: organisationId };
}

async function loadOrganisationByInvite(
  inviteCode: string,
  expected: MatchContext,
  res: Response,
): Promise<{ context: MatchContext; organisation: Organisation } | undefined> {
  const parsedCode = parseInviteCode(inviteCode);
  if (!parsedCode) {
    res.status(404).json({ message: "Invite code not found", code: "INVALID_INVITE_CODE" });
    return;
  }
  if (parsedCode.context !== expected) {
    res.status(404).json({
      message:
        parsedCode.context === "club"
          ? "That invite code belongs to a club"
          : "That invite code belongs to a league",
      code: "WRONG_INVITE_CONTEXT",
    });
    return;
  }

  const organisation =
    parsedCode.context === "league"
      ? await leagueRepo.getLeagueByInviteCode(parsedCode.code)
      : await clubRepo.getClubByInviteCode(parsedCode.code);
  if (!organisation) {
    res.status(404).json({ message: "Invite code not found", code: "INVALID_INVITE_CODE" });
    return;
  }
  return { context: parsedCode.context, organisation };
}

function publicUnlinkedPlayers(
  players: Awaited<ReturnType<typeof playerRepo.getUnlinkedPlayers>>,
) {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    isExternal: player.isExternal ?? true,
  }));
}

/**
 * Joining a League and joining a Club follow the same rules: an alias or an unlinked
 * Player pick, and an unresolved claim anywhere in that context blocks membership.
 */
async function joinOrganisation(
  req: AuthRequest,
  res: Response,
  context: MatchContext,
  organisation: Organisation,
) {
  const user = requireUser(req);
  const words = WORDING[context];
  const ref = refFor(context, organisation.id);

  if (isMember(organisation, user.id)) {
    return res.status(409).json({
      message: `You are already a member of this ${words.noun}`,
      code: words.alreadyCode,
      [words.idKey]: organisation.id,
    });
  }

  if (organisation.joinOpen === false) {
    return res.status(403).json({
      message: `This ${words.noun} is not accepting new members`,
      code: "MEMBERSHIP_CLOSED",
      [words.idKey]: organisation.id,
    });
  }

  const parsed = joinOrganisationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Send either an alias or a playerId",
      code: "JOIN_IDENTITY_REQUIRED",
      errors: parsed.error.issues,
    });
  }

  const blocking = await claimRepo.getPendingClaimsForUserInContext(user.id, ref);
  if (blocking.length > 0) {
    return res.status(409).json({
      message: "An administrator must confirm your claim before you can join",
      code: "CLAIM_PENDING",
      requestId: blocking[0].id,
      [words.idKey]: organisation.id,
    });
  }

  if (parsed.data.playerId != null) {
    const outcome = await playerRepo.claimUnlinkedPlayer({
      ...ref,
      userId: user.id,
      playerId: parsed.data.playerId,
    });
    if (outcome.kind === "not_found" || outcome.kind === "wrong_context") {
      return res.status(400).json({
        message: "That player is not in this group",
        code: "PLAYER_NOT_IN_CONTEXT",
      });
    }
    if (outcome.kind === "already_linked") {
      return res.status(409).json({
        message: `That alias is already used in this ${words.noun}`,
        code: "ALIAS_TAKEN",
      });
    }
    if (outcome.kind === "already_has_player") {
      return res.status(409).json({
        message: `You already have a player in this ${words.noun}`,
        code: "ALREADY_HAS_PLAYER",
        [words.idKey]: organisation.id,
      });
    }
    logger.info("Join claimed an unlinked player", {
      context,
      organisation: organisation.id,
      player: outcome.player.id,
      user: user.id,
      request: outcome.requestId,
    });
    return res.status(409).json({
      message: "An administrator must confirm your claim before you can join",
      code: "CLAIM_PENDING",
      requestId: outcome.requestId,
      [words.idKey]: organisation.id,
    });
  }

  const alias = parsed.data.alias!.trim();
  const outcome = await playerRepo.resolveJoinAlias({
    ...ref,
    userId: user.id,
    alias,
  });

  if (outcome.kind === "alias_taken") {
    return res.status(409).json({
      message: `That alias is already used in this ${words.noun}`,
      code: "ALIAS_TAKEN",
    });
  }

  if (outcome.kind === "claim_pending") {
    logger.info("Join raised a player claim request", {
      context,
      organisation: organisation.id,
      player: outcome.player.id,
      user: user.id,
      request: outcome.requestId,
    });
    return res.status(409).json({
      message: "An administrator must confirm your claim before you can join",
      code: "CLAIM_PENDING",
      requestId: outcome.requestId,
      [words.idKey]: organisation.id,
    });
  }

  const participants = [...(organisation.participants || []), user.id];
  const updated =
    context === "league"
      ? await leagueRepo.updateLeague(organisation.id, { participants })
      : await clubRepo.updateClub(organisation.id, { participants });
  if (!updated) {
    throw new Error(`Failed to update ${words.noun}`);
  }

  logger.info(`User joined ${words.noun}`, {
    [words.idKey]: organisation.id,
    player: outcome.player.id,
    user: user.id,
    alias: outcome.player.name,
  });
  return res.json(
    context === "league"
      ? { league: updated, player: outcome.player }
      : { club: updated, player: outcome.player },
  );
}

async function listUnlinkedByInvite(
  req: AuthRequest,
  res: Response,
  expected: MatchContext,
) {
  const loaded = await loadOrganisationByInvite(req.params.inviteCode, expected, res);
  if (!loaded) return;
  const players = await playerRepo.getUnlinkedPlayers(refFor(loaded.context, loaded.organisation.id));
  res.json(publicUnlinkedPlayers(players));
}

async function joinByInviteCode(req: AuthRequest, res: Response, expected: MatchContext) {
  const loaded = await loadOrganisationByInvite(req.params.inviteCode, expected, res);
  if (!loaded) return;
  await joinOrganisation(req, res, loaded.context, loaded.organisation);
}

async function persistParticipants(
  context: MatchContext,
  organisationId: number,
  participants: number[],
) {
  return context === "league"
    ? leagueRepo.updateLeague(organisationId, { participants })
    : clubRepo.updateClub(organisationId, { participants });
}

/**
 * Drops membership and unlinks the Player. History, rankings and match rows stay on
 * that Player so another account can claim it later.
 */
async function releaseMembership(
  organisation: Organisation,
  context: MatchContext,
  targetUserId: number,
  resolvedBy: number,
): Promise<{ organisation: Organisation; player: Awaited<ReturnType<typeof playerRepo.unlinkPlayerFromUser>> | undefined }> {
  const ref = refFor(context, organisation.id);
  await claimRepo.rejectPendingClaimsForUserInContext(targetUserId, ref, resolvedBy);

  const player = await playerRepo.checkUserAsPlayer(targetUserId, ref);
  const unlinked = player ? await playerRepo.unlinkPlayerFromUser(player.id) : undefined;

  const participants = (organisation.participants || []).filter((id) => id !== targetUserId);
  const updated = await persistParticipants(context, organisation.id, participants);
  if (!updated) {
    throw new Error(`Failed to update ${context}`);
  }
  return { organisation: updated, player: unlinked };
}

async function leaveOrganisation(
  req: AuthRequest,
  res: Response,
  context: MatchContext,
  organisation: Organisation,
) {
  const user = requireUser(req);
  const words = WORDING[context];

  if (!isMember(organisation, user.id)) {
    return res.status(404).json({
      message: `You are not a member of this ${words.noun}`,
      code: "NOT_A_MEMBER",
    });
  }
  if (isAdmin(organisation, user.id)) {
    return res.status(409).json({
      message: `The administrator cannot leave this ${words.noun}`,
      code: "ADMIN_CANNOT_LEAVE",
      [words.idKey]: organisation.id,
    });
  }

  const released = await releaseMembership(organisation, context, user.id, user.id);
  logger.info(`User left ${words.noun}`, {
    [words.idKey]: organisation.id,
    user: user.id,
    player: released.player?.id,
  });
  return res.json(
    context === "league"
      ? { league: released.organisation, player: released.player }
      : { club: released.organisation, player: released.player },
  );
}

async function removeMember(
  req: AuthRequest,
  res: Response,
  context: MatchContext,
  organisation: Organisation,
  targetUserId: number,
) {
  const admin = requireUser(req);
  const words = WORDING[context];

  if (!isAdmin(organisation, admin.id)) {
    return res.status(403).json({
      message: "Only the administrator can remove members",
      code: "ADMIN_ONLY",
    });
  }
  if (targetUserId === organisation.createdBy) {
    return res.status(409).json({
      message: `The administrator cannot be removed from this ${words.noun}`,
      code: "CANNOT_REMOVE_ADMIN",
      [words.idKey]: organisation.id,
    });
  }
  if (!isMember(organisation, targetUserId)) {
    return res.status(404).json({
      message: `That user is not a member of this ${words.noun}`,
      code: "NOT_A_MEMBER",
    });
  }

  const released = await releaseMembership(organisation, context, targetUserId, admin.id);
  logger.info(`Administrator removed a member from ${words.noun}`, {
    [words.idKey]: organisation.id,
    user: targetUserId,
    player: released.player?.id,
    admin: admin.id,
  });
  return res.json(
    context === "league"
      ? { league: released.organisation, player: released.player }
      : { club: released.organisation, player: released.player },
  );
}

async function loadOrganisationById(
  organisationId: number,
  expected: MatchContext,
  res: Response,
): Promise<{ context: MatchContext; organisation: Organisation } | undefined> {
  const organisation =
    expected === "league"
      ? await leagueRepo.getLeague(organisationId)
      : await clubRepo.getClub(organisationId);
  if (!organisation) {
    res.status(404).json({
      message: expected === "league" ? "League not found" : "Club not found",
    });
    return;
  }
  return { context: expected, organisation };
}

async function setMembershipOpen(
  req: AuthRequest,
  res: Response,
  context: MatchContext,
) {
  const loaded = await loadOrganisationById(parseInt(req.params.id), context, res);
  if (!loaded) return;
  const admin = requireUser(req);
  if (!isAdmin(loaded.organisation, admin.id)) {
    return res.status(403).json({
      message: "Only the administrator can change membership",
      code: "ADMIN_ONLY",
    });
  }
  const parsed = membershipSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", code: "VALIDATION_ERROR" });
  }
  const updated =
    context === "league"
      ? await leagueRepo.updateLeague(loaded.organisation.id, { joinOpen: parsed.data.joinOpen })
      : await clubRepo.updateClub(loaded.organisation.id, { joinOpen: parsed.data.joinOpen });
  if (!updated) {
    return res.status(404).json({
      message: context === "league" ? "League not found" : "Club not found",
    });
  }
  return res.json(context === "league" ? { league: updated } : { club: updated });
}

export function registerMemberRoutes(app: Express) {
  app.get(
    "/api/leagues/:inviteCode/unlinked-players",
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await listUnlinkedByInvite(req, res, "league");
      } catch (error) {
        logger.error("List unlinked league players error", error);
        res.status(500).json({ message: "Failed to list unlinked players" });
      }
    },
  );

  app.get(
    "/api/clubs/:inviteCode/unlinked-players",
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await listUnlinkedByInvite(req, res, "club");
      } catch (error) {
        logger.error("List unlinked club players error", error);
        res.status(500).json({ message: "Failed to list unlinked players" });
      }
    },
  );

  app.post("/api/leagues/:inviteCode/join", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await joinByInviteCode(req, res, "league");
    } catch (error) {
      logger.error("Join league by invite code error", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to join league",
      });
    }
  });

  app.post("/api/clubs/:inviteCode/join", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await joinByInviteCode(req, res, "club");
    } catch (error) {
      logger.error("Join club by invite code error", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to join club",
      });
    }
  });

  app.post("/api/leagues/:id/leave", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const loaded = await loadOrganisationById(parseInt(req.params.id), "league", res);
      if (!loaded) return;
      await leaveOrganisation(req, res, loaded.context, loaded.organisation);
    } catch (error) {
      logger.error("Leave league error", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to leave league",
      });
    }
  });

  app.post("/api/clubs/:id/leave", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const loaded = await loadOrganisationById(parseInt(req.params.id), "club", res);
      if (!loaded) return;
      await leaveOrganisation(req, res, loaded.context, loaded.organisation);
    } catch (error) {
      logger.error("Leave club error", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to leave club",
      });
    }
  });

  app.post("/api/leagues/:id/members/:userId/remove", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const loaded = await loadOrganisationById(parseInt(req.params.id), "league", res);
      if (!loaded) return;
      await removeMember(req, res, loaded.context, loaded.organisation, parseInt(req.params.userId));
    } catch (error) {
      logger.error("Remove league member error", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to remove member",
      });
    }
  });

  app.post("/api/clubs/:id/members/:userId/remove", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const loaded = await loadOrganisationById(parseInt(req.params.id), "club", res);
      if (!loaded) return;
      await removeMember(req, res, loaded.context, loaded.organisation, parseInt(req.params.userId));
    } catch (error) {
      logger.error("Remove club member error", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to remove member",
      });
    }
  });

  app.post("/api/leagues/:id/membership", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await setMembershipOpen(req, res, "league");
    } catch (error) {
      logger.error("League membership toggle error", error);
      res.status(500).json({ message: "Failed to update membership" });
    }
  });

  app.post("/api/clubs/:id/membership", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await setMembershipOpen(req, res, "club");
    } catch (error) {
      logger.error("Club membership toggle error", error);
      res.status(500).json({ message: "Failed to update membership" });
    }
  });
}
