import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import type { League, User } from "@shared/schema";
import { env } from "../env";
import * as userRepo from "../repos/userRepo";
import type { AuthRequest } from "../types";

export function isLeagueMember(league: League, userId: number): boolean {
  return (
    league.createdBy === userId ||
    Boolean(league.participants && league.participants.includes(userId))
  );
}

export function isLeagueAdmin(league: League, userId: number): boolean {
  return league.createdBy === userId;
}

export function requireLeagueMember(league: League, userId: number): boolean {
  return isLeagueMember(league, userId);
}

export function requireLeagueAdmin(league: League, userId: number): boolean {
  return isLeagueAdmin(league, userId);
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: number; email?: string };
    const user = await userRepo.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
}

export function requireUser(req: AuthRequest): User {
  if (!req.user) {
    throw new Error("requireAuth must run first");
  }
  return req.user;
}
