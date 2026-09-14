import type { Express, Response } from "express";
import { logger } from "../logger";
import { requireAnalyticsPasscode } from "../middleware/analytics";
import * as analyticsRepo from "../repos/analyticsRepo";

export function registerAnalyticsRoutes(app: Express) {
  app.get("/api/analytics/overview", requireAnalyticsPasscode, async (_req, res: Response) => {
    try {
      const overview = await analyticsRepo.getOverview();
      res.json(overview);
    } catch (error) {
      logger.error("Analytics overview error", error);
      res.status(500).json({ message: "Failed to load analytics" });
    }
  });
}
