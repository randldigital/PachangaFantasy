import type { Express, Response } from "express";
import jwt from "jsonwebtoken";
import { insertUserSchema, loginSchema } from "@shared/schema";
import { env } from "../env";
import { requireAuth, requireUser } from "../middleware/auth";
import * as userRepo from "../repos/userRepo";
import type { AuthRequest } from "../types";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res: Response) => {
    try {
      const incoming = { ...(req.body as Record<string, unknown>) };
      delete incoming.role;
      const userData = insertUserSchema.parse(incoming);

      const existingUser = await userRepo.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const user = await userRepo.createUser(userData);
      const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "7d" });

      res.json({ user: { ...user, password: undefined }, token });
    } catch {
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

      res.json({ user: { ...result.user, password: undefined }, token: result.token });
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    res.json({ user: { ...user, password: undefined } });
  });
}
