import type { Request } from "express";
import type { League, Match, User } from "@shared/schema";

export interface AuthRequest extends Request {
  user?: User;
  league?: League;
  match?: Match;
}
