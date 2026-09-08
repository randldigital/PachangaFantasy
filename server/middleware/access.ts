import type { Response } from "express";
import type { League, Match, User } from "@shared/schema";
import { isLeagueAdmin, isLeagueMember, requireUser } from "./auth";
import * as leagueRepo from "../repos/leagueRepo";
import * as matchRepo from "../repos/matchRepo";
import type { AuthRequest } from "../types";

export async function loadLeagueMember(
  req: AuthRequest,
  res: Response,
  leagueId: number,
): Promise<{ league: League; user: User } | undefined> {
  const user = requireUser(req);
  const league = await leagueRepo.getLeague(leagueId);
  if (!league || !isLeagueMember(league, user.id)) {
    res.status(404).json({ message: "League not found" });
    return;
  }
  return { league, user };
}

export async function loadMatchMember(
  req: AuthRequest,
  res: Response,
  matchId: number,
): Promise<{ match: Match; league: League; user: User } | undefined> {
  const user = requireUser(req);
  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    res.status(404).json({ message: "Match not found" });
    return;
  }
  const league = await leagueRepo.getLeague(match.leagueId);
  if (!league || !isLeagueMember(league, user.id)) {
    res.status(404).json({ message: "Match not found" });
    return;
  }
  return { match, league, user };
}

export function rejectUnlessAdmin(
  res: Response,
  league: League,
  userId: number,
  message: string,
): boolean {
  if (!isLeagueAdmin(league, userId)) {
    res.status(403).json({ message });
    return true;
  }
  return false;
}
