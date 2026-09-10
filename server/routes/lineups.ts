import type { Express, Response } from "express";
import { saveLineupSchema } from "@shared/schema";
import { logger } from "../logger";
import { isLeagueMember, requireAuth, requireUser } from "../middleware/auth";
import { loadMatchMember } from "../middleware/access";
import * as leagueRepo from "../repos/leagueRepo";
import * as lineupRepo from "../repos/lineupRepo";
import * as matchRepo from "../repos/matchRepo";
import * as playerRepo from "../repos/playerRepo";
import { lineupTotalCost, validateLineup } from "@shared/domain/lineup";
import { isLineupEditable } from "@shared/domain/matchLifecycle";
import { requireLeagueId } from "@shared/domain/context";
import type { AuthRequest } from "../types";

export function registerLineupRoutes(app: Express) {
  app.post("/api/matches/:matchId/lineup", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const userId = requireUser(req).id;

      const match = await matchRepo.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      const league = await leagueRepo.getLeague(requireLeagueId(match));
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (!isLeagueMember(league, userId)) {
        return res.status(403).json({ message: "You must be a member of this league to create a lineup" });
      }

      if (!isLineupEditable(match.status)) {
        return res.status(400).json({
          message: "Lineups lock when the match starts",
          code: "LINEUP_LOCKED",
        });
      }

      const parsed = saveLineupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }

      const participants = await matchRepo.getMatchParticipants(matchId);
      const participantIds = participants.map((participant) => participant.playerId);
      const players = await playerRepo.getRosterFor(match);
      const violations = validateLineup({
        playerIds: parsed.data.playerIds,
        captainId: parsed.data.captainId,
        budget: match.lineupBudget ?? 100,
        players,
        participantIds,
        matchStatus: match.status,
      });

      if (violations.length > 0) {
        return res.status(400).json({
          message: violations[0].message,
          code: violations[0].code,
          errors: violations,
        });
      }

      const totalCost = lineupTotalCost(parsed.data.playerIds, players);
      const existingLineup = await lineupRepo.getLineup(matchId, userId);
      const payload = {
        matchId,
        userId,
        playerIds: parsed.data.playerIds,
        captainId: parsed.data.captainId,
        totalCost,
      };

      if (existingLineup) {
        const updated = await lineupRepo.updateLineup(existingLineup.id, payload);
        return res.json(updated);
      }

      const lineup = await lineupRepo.createLineup(payload);
      res.json(lineup);
    } catch (error) {
      logger.error("Error creating/updating lineup", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/matches/:matchId/lineup", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;
      const lineup = await lineupRepo.getLineup(matchId, access.user.id);
      res.json(lineup || null);
    } catch (error) {
      logger.error("Error fetching lineup", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
