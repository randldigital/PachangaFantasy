import type { Express, Response } from "express";
import { logger } from "../logger";
import { requireAuth } from "../middleware/auth";
import { loadMatchMember, rejectUnlessAdmin } from "../middleware/access";
import * as matchRepo from "../repos/matchRepo";
import * as scoreRepo from "../repos/scoreRepo";
import * as statsRepo from "../repos/statsRepo";
import * as ratingRepo from "../repos/ratingRepo";
import type { AuthRequest } from "../types";

export function registerScoringRoutes(app: Express) {
  app.post("/api/matches/:matchId/calculate-scores", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchMember(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.league, access.user.id, "Only the league administrator can calculate scores")) {
        return;
      }

      if (access.match.status === "scored") {
        return res.json(await scoreRepo.getScoredMatchResult(matchId));
      }

      if (access.match.status !== "completed") {
        return res.status(400).json({
          message: "Scoring is only available after the match is finished",
          code: "MATCH_NOT_SCOREABLE",
        });
      }

      const participants = await matchRepo.getMatchParticipants(matchId);
      const reports = await statsRepo.getStatReportsForMatch(matchId);
      const status = statsRepo.matchStatsStatus(access.match, participants, reports);

      if (!status.canScore) {
        const code = !status.complete
          ? "STATS_INCOMPLETE"
          : !status.assistsOk
            ? "STATS_ASSISTS_EXCEED"
            : "STATS_INCONSISTENT";
        return res.status(400).json({
          message: !status.complete
            ? "Every participant must submit statistics before scoring"
            : !status.assistsOk
              ? "Assists cannot exceed the match goal total"
              : "Goal totals are inconsistent. Correct the statistics or acknowledge the difference.",
          code,
          ...status,
        });
      }

      const ratingsComplete = await ratingRepo.matchRatingsComplete(matchId);
      if (!ratingsComplete) {
        return res.status(400).json({
          message: "Every registered participant must vote Player of the Match and rate assigned peers",
          code: "RATINGS_INCOMPLETE",
        });
      }

      const result = await scoreRepo.scoreMatch(matchId);
      res.json(result);
    } catch (error) {
      logger.error("Error calculating match scores", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
