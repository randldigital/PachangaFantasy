import type { Express } from "express";
import { registerAuthRoutes } from "./auth";
import { registerLeagueRoutes } from "./leagues";
import { registerMemberRoutes } from "./members";
import { registerPlayerRoutes } from "./players";
import { registerValuationRoutes } from "./valuation";
import { registerMatchRoutes } from "./matches";
import { registerLineupRoutes } from "./lineups";
import { registerStatsRoutes } from "./stats";
import { registerScoringRoutes } from "./scoring";
import { registerLeaderboardRoutes } from "./leaderboards";

export function registerRoutes(app: Express) {
  registerAuthRoutes(app);
  registerLeagueRoutes(app);
  registerMemberRoutes(app);
  registerPlayerRoutes(app);
  registerValuationRoutes(app);
  registerMatchRoutes(app);
  registerLineupRoutes(app);
  registerStatsRoutes(app);
  registerScoringRoutes(app);
  registerLeaderboardRoutes(app);
}
