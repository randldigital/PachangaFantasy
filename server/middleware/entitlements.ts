import type { NextFunction, Response } from "express";
import { hasEntitlement } from "@shared/domain/entitlements";
import * as billingRepo from "../repos/billingRepo";
import type { AuthRequest } from "../types";
import { requireUser } from "./auth";

export function requireEntitlement(
  feature: string,
  getSubject: (
    req: AuthRequest,
  ) => billingRepo.BillingSubject | Promise<billingRepo.BillingSubject>,
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      const subject = await getSubject(req);
      const plan = await billingRepo.resolvePlan(subject);
      if (!hasEntitlement(plan, feature)) {
        return res.status(403).json({
          message: "This plan does not include that feature",
          code: "ENTITLEMENT_REQUIRED",
          feature,
          plan,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
