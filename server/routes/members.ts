import type { Express, Response } from "express";
import { logger } from "../logger";
import { requireAuth, requireUser } from "../middleware/auth";
import * as leagueRepo from "../repos/leagueRepo";
import * as playerRepo from "../repos/playerRepo";
import type { AuthRequest } from "../types";

async function joinLeague(req: AuthRequest, res: Response, league: NonNullable<Awaited<ReturnType<typeof leagueRepo.getLeague>>>) {
  const user = requireUser(req);

  if (league.participants && league.participants.includes(user.id)) {
    return res.status(409).json({
      message: "You are already a member of this league",
      code: "ALREADY_IN_LEAGUE",
      leagueId: league.id,
    });
  }

  const existingPlayer = await playerRepo.checkUserAsPlayer(user.id, league.id);

  const currentParticipants = league.participants || [];
  const updatedLeague = await leagueRepo.updateLeague(league.id, {
    participants: [...currentParticipants, user.id],
  });

  if (updatedLeague && !existingPlayer) {
    const { player, claimed } = await playerRepo.claimUnlinkedOrCreatePlayer({
      leagueId: league.id,
      userId: user.id,
      username: user.username,
    });

    logger.info(
      claimed
        ? "User joined league and claimed unlinked player"
        : "User joined league and created as player",
      {
        league: updatedLeague.id,
        player: player.id,
        username: user.username,
        claimed,
      },
    );
    return res.json({ league: updatedLeague, player });
  }

  if (updatedLeague && existingPlayer) {
    logger.info("User joined league with existing player record", {
      league: updatedLeague.id,
      player: existingPlayer.id,
      username: user.username,
    });
    return res.json({ league: updatedLeague, player: existingPlayer });
  }

  throw new Error("Failed to update league");
}

export function registerMemberRoutes(app: Express) {
  app.post("/api/leagues/:inviteCode/join", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const league = await leagueRepo.getLeagueByInviteCode(req.params.inviteCode);

      if (!league) {
        return res.status(404).json({ message: "Invite code not found", code: "INVALID_INVITE_CODE" });
      }

      await joinLeague(req, res, league);
    } catch (error) {
      logger.error("Join league by invite code error", error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to join league" });
      }
    }
  });
}
