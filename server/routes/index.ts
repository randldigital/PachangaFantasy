import type { Express } from "express";
import { registerAuthRoutes } from "./auth";
import { registerAvatarRoutes } from "./avatars";
import { registerBillingRoutes } from "./billing";
import { registerClubRoutes } from "./clubs";
import { registerLeagueRoutes } from "./leagues";
import { registerMemberRoutes } from "./members";
import { registerPlayerRoutes } from "./players";
import { registerValuationRoutes } from "./valuation";
import { registerMatchRoutes } from "./matches";
import { registerLineupRoutes } from "./lineups";
import { registerStatsRoutes } from "./stats";
import { registerScoringRoutes } from "./scoring";
import { registerRatingRoutes } from "./ratings";
import { registerLeaderboardRoutes } from "./leaderboards";

export function registerRoutes(app: Express) {
  registerAuthRoutes(app);
  registerAvatarRoutes(app);
  registerBillingRoutes(app);
  registerLeagueRoutes(app);
  registerClubRoutes(app);
  registerMemberRoutes(app);
  registerPlayerRoutes(app);
  registerValuationRoutes(app);
  registerMatchRoutes(app);
  registerLineupRoutes(app);
  registerStatsRoutes(app);
  registerRatingRoutes(app);
  registerScoringRoutes(app);
  registerLeaderboardRoutes(app);
}
