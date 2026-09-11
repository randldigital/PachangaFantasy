import type { NextFunction, Request, Response } from "express";
import { corsOrigins } from "./env";

const CAPACITOR_ORIGINS = [
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const extra = corsOrigins();
  if (extra.length === 0) {
    return next();
  }

  const allowed = new Set([...extra, ...CAPACITOR_ORIGINS]);
  const origin = req.headers.origin;
  if (origin && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
}
