import { timingSafeEqual, createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { analyticsPasscode } from "../env";

export function analyticsPasscodeMatches(provided: string): boolean {
  const expectedHash = createHash("sha256").update(analyticsPasscode()).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

export function requireAnalyticsPasscode(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-analytics-passcode") ?? "";
  if (!analyticsPasscodeMatches(provided)) {
    return res.status(403).json({
      message: "Analytics is locked",
      code: "ANALYTICS_LOCKED",
    });
  }
  next();
}
