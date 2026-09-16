import type { Express, Response } from "express";
import { logger } from "../logger";
import { requireAuth } from "../middleware/auth";
import { loadMatchAccess, rejectUnlessAdmin } from "../middleware/access";
import { isClosedStatus } from "@shared/domain/matchLifecycle";
import * as matchRepo from "../repos/matchRepo";
import * as scoreRepo from "../repos/scoreRepo";
import * as statsRepo from "../repos/statsRepo";
import * as ratingRepo from "../repos/ratingRepo";
import type { AuthRequest } from "../types";

export function registerScoringRoutes(app: Express) {
  app.post("/api/matches/:matchId/calculate-scores", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const access = await loadMatchAccess(req, res, matchId);
      if (!access) return;

      if (rejectUnlessAdmin(res, access.organisation, access.user.id, "Only the league administrator can calculate scores")) {
        return;
      }

      const isClub = access.context === "club";

      if (isClosedStatus(access.match.status)) {
        return res.status(400).json({
          message: "This match is closed and can no longer be scored",
          code: "MATCH_CLOSED",
        });
      }

      if (access.match.status === "scored") {
        return res.json(
          isClub
            ? await scoreRepo.getScoredClubMatchResult(matchId)
            : await scoreRepo.getScoredMatchResult(matchId),
        );
      }

      if (access.match.status !== "completed") {
        return res.status(400).json({
          message: isClub
            ? "Record the club match result before scoring"
            : "Scoring is only available after the match is finished",
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
              ? "Assists cannot exceed that side's goal total"
              : "Reported goals or assists exceed that side's score",
          code,
          ...status,
        });
      }

      const ratingsComplete = await ratingRepo.matchRatingsComplete(matchId);
      const force = req.body?.force === true;
      if (!ratingsComplete && !force) {
        return res.status(400).json({
          message: "Every registered participant must vote Player of the Match and rate assigned peers",
          code: "RATINGS_INCOMPLETE",
        });
      }

      const options = { forceIncompleteRatings: Boolean(force && !ratingsComplete) };
      const result = isClub
        ? await scoreRepo.scoreClubMatch(matchId, options)
        : await scoreRepo.scoreMatch(matchId, options);
      res.json(result);
    } catch (error) {
      logger.error("Error calculating match scores", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
