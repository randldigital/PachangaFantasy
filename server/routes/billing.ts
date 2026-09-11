import type { Express, Response } from "express";
import {
  billingCheckoutSchema,
  billingSubjectQuerySchema,
} from "@shared/schema";
import {
  catalogPlans,
  FEATURE_PLUS_PLACEHOLDER,
  hasEntitlement,
} from "@shared/domain/entitlements";
import { paymentsEnabled } from "../env";
import { logger } from "../logger";
import { requireEntitlement } from "../middleware/entitlements";
import { requireAuth, requireUser } from "../middleware/auth";
import * as billingRepo from "../repos/billingRepo";
import type { AuthRequest } from "../types";

async function overviewFor(userId: number) {
  const subjects = await billingRepo.listAccountsForUser(userId);
  const rows = [];
  for (const subject of subjects) {
    const detail = await billingRepo.getSubscriptionForAccount(subject.account.id);
    const planCode = detail?.plan?.code ?? "free";
    rows.push({
      billingAccountId: subject.account.id,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      name: subject.name,
      canManage: subject.canManage,
      planCode,
      planName: detail?.plan?.name ?? "Free",
      status: detail?.subscription.status ?? "active",
      currentPeriodEnd: detail?.subscription.currentPeriodEnd ?? null,
      features: catalogPlans().find((plan) => plan.code === planCode)?.features
        ?? catalogPlans()[0].features,
    });
  }
  return rows;
}

export function registerBillingRoutes(app: Express) {
  app.get("/api/billing/plans", (_req, res: Response) => {
    res.json({
      plans: catalogPlans(),
      paymentsEnabled: paymentsEnabled(),
    });
  });

  app.get("/api/billing/overview", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = requireUser(req);
      res.json({
        subjects: await overviewFor(user.id),
        paymentsEnabled: paymentsEnabled(),
      });
    } catch (error) {
      logger.error("Billing overview error", error);
      res.status(500).json({ message: "Failed to load billing" });
    }
  });

  app.get(
    "/api/billing/subject/:type/:id",
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      const parsed = billingSubjectQuerySchema.safeParse({
        type: req.params.type,
        id: req.params.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid subject", code: "VALIDATION_ERROR" });
      }
      const subject = { type: parsed.data.type, id: parsed.data.id };
      const user = requireUser(req);
      if (!(await billingRepo.isSubjectMember(user.id, subject))) {
        return res.status(404).json({ message: "Not found", code: "NOT_FOUND" });
      }
      const account = await billingRepo.ensureBillingAccount(subject);
      const detail = await billingRepo.getSubscriptionForAccount(account.id);
      const planCode = detail?.plan?.code ?? "free";
      res.json({
        billingAccountId: account.id,
        subjectType: subject.type,
        subjectId: subject.id,
        canManage: await billingRepo.canManageAccount(user.id, account),
        planCode,
        planName: detail?.plan?.name ?? "Free",
        status: detail?.subscription.status ?? "active",
        currentPeriodEnd: detail?.subscription.currentPeriodEnd ?? null,
      });
    },
  );

  app.get(
    "/api/billing/plus-preview",
    requireAuth,
    requireEntitlement(FEATURE_PLUS_PLACEHOLDER, (req) => {
      const parsed = billingSubjectQuerySchema.safeParse({
        type: req.query.type,
        id: req.query.id,
      });
      if (!parsed.success) {
        return { type: "user", id: requireUser(req).id };
      }
      return { type: parsed.data.type, id: parsed.data.id };
    }),
    (_req: AuthRequest, res: Response) => {
      res.json({ ok: true, feature: FEATURE_PLUS_PLACEHOLDER });
    },
  );

  app.post("/api/billing/checkout", requireAuth, async (req: AuthRequest, res: Response) => {
    if (!paymentsEnabled()) {
      return res.status(501).json({
        message: "Payments are not enabled",
        code: "PAYMENTS_DISABLED",
      });
    }
    const parsed = billingCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", code: "VALIDATION_ERROR" });
    }
    const account = await billingRepo.getAccount(parsed.data.billingAccountId);
    if (!account || !(await billingRepo.canManageAccount(requireUser(req).id, account))) {
      return res.status(403).json({ message: "Not authorized", code: "FORBIDDEN" });
    }
    return res.status(501).json({
      message: "No payment provider is configured",
      code: "PAYMENTS_PROVIDER_NOT_CONFIGURED",
    });
  });

  app.post("/api/billing/webhook", async (_req, res: Response) => {
    if (!paymentsEnabled()) {
      return res.status(501).json({
        message: "Payments are not enabled",
        code: "PAYMENTS_DISABLED",
      });
    }
    return res.status(501).json({
      message: "No payment provider is configured",
      code: "PAYMENTS_PROVIDER_NOT_CONFIGURED",
    });
  });
}

export { hasEntitlement };
