import type { Express, Response } from "express";
import { insertUserSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@shared/schema";
import type { User } from "@shared/schema";
import {
  adsEnabled,
  adsenseClient,
  adsenseSlotHub,
  adsenseSlotOverview,
  adsTest,
  env,
  googleConfigured,
  paymentsEnabled,
  publicUrl,
} from "../env";
import { logger } from "../logger";
import { getMailer, isMailConfigured } from "../mail/mailer";
import { requireAuth, requireUser } from "../middleware/auth";
import * as userRepo from "../repos/userRepo";
import * as verifyRepo from "../repos/verifyRepo";
import * as passwordResetRepo from "../repos/passwordResetRepo";
import type { AuthRequest } from "../types";

const resendAt = new Map<number, number>();
const resetAt = new Map<number, number>();
const RESEND_COOLDOWN_MS = 60_000;

function publicUser(user: User) {
  return { ...user, password: undefined };
}

function appOrigin(): string {
  return publicUrl() || `http://localhost:${env.PORT}`;
}

function verifyLink(rawToken: string): string {
  return `${appOrigin()}/verify?token=${encodeURIComponent(rawToken)}`;
}

function resetLink(rawToken: string): string {
  return `${appOrigin()}/reset?token=${encodeURIComponent(rawToken)}`;
}

async function sendVerificationEmail(user: User, rawToken: string) {
  const link = verifyLink(rawToken);
  await getMailer().sendMail({
    to: user.email,
    subject: "Confirm your Pachanga email",
    text: `Confirm your email by opening this link:\n${link}\n`,
    html: `<p>Confirm your email by opening this link:</p><p><a href="${link}">${link}</a></p>`,
  });
}

async function sendPasswordResetEmail(user: User, rawToken: string) {
  const link = resetLink(rawToken);
  await getMailer().sendMail({
    to: user.email,
    subject: "Reset your Pachanga password",
    text: `Reset your password by opening this link:\n${link}\n`,
    html: `<p>Reset your password by opening this link:</p><p><a href="${link}">${link}</a></p>`,
  });
}

function issueToken(user: User) {
  return userRepo.signUserToken(user);
}

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/features", (_req, res: Response) => {
    const ads = adsEnabled();
    res.json({
      google: googleConfigured(),
      payments: paymentsEnabled(),
      ads,
      email: isMailConfigured(),
      adsClient: ads ? adsenseClient() : "",
      adsSlots: {
        "overview.banner": ads ? adsenseSlotOverview() : "",
        "hub.sidebar": ads ? adsenseSlotHub() : "",
      },
      adsTest: ads && adsTest(),
    });
  });

  app.post("/api/auth/register", async (req, res: Response) => {
    try {
      const incoming = { ...(req.body as Record<string, unknown>) };
      delete incoming.role;
      const userData = insertUserSchema.parse(incoming);

      if (!isMailConfigured()) {
        return res.status(503).json({
          message: "Email delivery is not configured",
          code: "EMAIL_NOT_CONFIGURED",
        });
      }

      const existingUser = await userRepo.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const user = await userRepo.createUser(userData);
      const rawToken = await verifyRepo.issueVerificationToken(user.id);
      await sendVerificationEmail(user, rawToken);
      resendAt.set(user.id, Date.now());

      res.status(201).json({
        message: "Check your email to verify the account",
        code: "EMAIL_VERIFICATION_REQUIRED",
        email: user.email,
      });
    } catch (error) {
      logger.error("Register error", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post("/api/auth/login", async (req, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const result = await userRepo.authenticateUser(email, password);
      if (!result) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (!result.user.emailVerifiedAt) {
        return res.status(403).json({
          message: "Verify your email before signing in",
          code: "EMAIL_NOT_VERIFIED",
          email: result.user.email,
        });
      }

      res.json({ user: publicUser(result.user), token: result.token });
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get("/api/auth/verify", async (req, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      return res.status(400).json({
        message: "Missing verification token",
        code: "INVALID_VERIFICATION_TOKEN",
      });
    }
    const consumed = await verifyRepo.consumeVerificationToken(token);
    if (!consumed) {
      return res.status(400).json({
        message: "Invalid or expired verification token",
        code: "INVALID_VERIFICATION_TOKEN",
      });
    }
    const user = await userRepo.markEmailVerified(consumed.userId);
    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification token",
        code: "INVALID_VERIFICATION_TOKEN",
      });
    }
    res.json({ user: publicUser(user), token: issueToken(user) });
  });

  app.post("/api/auth/resend-verification", async (req, res: Response) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email : "";
      if (!email) {
        return res.status(400).json({ message: "Invalid input" });
      }
      if (!isMailConfigured()) {
        return res.status(503).json({
          message: "Email delivery is not configured",
          code: "EMAIL_NOT_CONFIGURED",
        });
      }
      const user = await userRepo.getUserByEmail(email);
      if (!user || user.emailVerifiedAt) {
        return res.json({ ok: true });
      }
      const last = resendAt.get(user.id) ?? 0;
      if (Date.now() - last < RESEND_COOLDOWN_MS) {
        return res.json({ ok: true });
      }
      const rawToken = await verifyRepo.issueVerificationToken(user.id);
      await sendVerificationEmail(user, rawToken);
      resendAt.set(user.id, Date.now());
      res.json({ ok: true });
    } catch (error) {
      logger.error("Resend verification error", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res: Response) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      if (!isMailConfigured()) {
        return res.status(503).json({
          message: "Email delivery is not configured",
          code: "EMAIL_NOT_CONFIGURED",
        });
      }
      const user = await userRepo.getUserByEmail(email);
      if (user?.password) {
        const last = resetAt.get(user.id) ?? 0;
        if (Date.now() - last >= RESEND_COOLDOWN_MS) {
          const rawToken = await passwordResetRepo.issueResetToken(user.id);
          await sendPasswordResetEmail(user, rawToken);
          resetAt.set(user.id, Date.now());
        }
      }
      res.json({ ok: true });
    } catch (error) {
      logger.error("Forgot password error", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res: Response) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      const consumed = await passwordResetRepo.consumeResetToken(token);
      if (!consumed) {
        return res.status(400).json({
          message: "Invalid or expired reset token",
          code: "INVALID_RESET_TOKEN",
        });
      }
      const user = await userRepo.setPassword(consumed.userId, password);
      if (!user) {
        return res.status(400).json({
          message: "Invalid or expired reset token",
          code: "INVALID_RESET_TOKEN",
        });
      }
      res.json({ ok: true });
    } catch (error) {
      logger.error("Reset password error", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get("/api/auth/google", (_req, res: Response) => {
    if (!googleConfigured()) {
      return res.status(501).json({
        message: "Google sign-in is not configured",
        code: "GOOGLE_NOT_CONFIGURED",
      });
    }
    res.status(501).json({
      message: "Google sign-in is not configured",
      code: "GOOGLE_NOT_CONFIGURED",
    });
  });

  app.get("/api/auth/google/callback", (_req, res: Response) => {
    if (!googleConfigured()) {
      return res.status(501).json({
        message: "Google sign-in is not configured",
        code: "GOOGLE_NOT_CONFIGURED",
      });
    }
    res.status(501).json({
      message: "Google sign-in is not configured",
      code: "GOOGLE_NOT_CONFIGURED",
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    res.json({ user: publicUser(user) });
  });
}
