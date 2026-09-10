import type { Express, Response } from "express";
import { joinWithAliasSchema } from "@shared/schema";
import { parseInviteCode } from "@shared/domain/inviteCodes";
import type { ContextRef, MatchContext } from "@shared/domain/context";
import { logger } from "../logger";
import { isMember, type Organisation } from "../middleware/access";
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

/**
 * Joining a League and joining a Club follow the same rules: an alias is mandatory, the
 * alias must be free, and an unresolved claim anywhere in that context blocks membership.
 */
async function joinOrganisation(
  req: AuthRequest,
  res: Response,
  context: MatchContext,
  organisation: Organisation,
) {
  const user = requireUser(req);
  const words = WORDING[context];
  const ref: ContextRef =
    context === "league" ? { leagueId: organisation.id } : { clubId: organisation.id };

  if (isMember(organisation, user.id)) {
    return res.status(409).json({
      message: `You are already a member of this ${words.noun}`,
      code: words.alreadyCode,
      [words.idKey]: organisation.id,
    });
  }

  const parsed = joinWithAliasSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "An alias is required to join",
      code: "ALIAS_REQUIRED",
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

  const outcome = await playerRepo.resolveJoinAlias({
    ...ref,
    userId: user.id,
    alias: parsed.data.alias,
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

/** Routes a code to its context by the code itself; never League-first-then-Club. */
async function joinByInviteCode(req: AuthRequest, res: Response, expected: MatchContext) {
  const parsedCode = parseInviteCode(req.params.inviteCode);
  if (!parsedCode) {
    return res.status(404).json({ message: "Invite code not found", code: "INVALID_INVITE_CODE" });
  }
  if (parsedCode.context !== expected) {
    return res.status(404).json({
      message:
        parsedCode.context === "club"
          ? "That invite code belongs to a club"
          : "That invite code belongs to a league",
      code: "WRONG_INVITE_CONTEXT",
    });
  }

  const organisation =
    parsedCode.context === "league"
      ? await leagueRepo.getLeagueByInviteCode(parsedCode.code)
      : await clubRepo.getClubByInviteCode(parsedCode.code);
  if (!organisation) {
    return res.status(404).json({ message: "Invite code not found", code: "INVALID_INVITE_CODE" });
  }

  await joinOrganisation(req, res, parsedCode.context, organisation);
}

export function registerMemberRoutes(app: Express) {
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
}
