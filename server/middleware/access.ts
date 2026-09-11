import type { Response } from "express";
import type { Club, League, Match, User } from "@shared/schema";
import { contextOf, type ContextRef, type MatchContext } from "@shared/domain/context";
import { isLeagueAdmin, isLeagueMember, requireUser } from "./auth";
import * as clubRepo from "../repos/clubRepo";
import * as leagueRepo from "../repos/leagueRepo";
import * as matchRepo from "../repos/matchRepo";
import type { AuthRequest } from "../types";

/**
 * A League and a Club are governed identically: a creator who administrates and a
 * participant list. Routes work against this shape so they need not know which one they hold.
 */
export interface Organisation {
  id: number;
  name: string;
  createdBy: number;
  participants: number[] | null;
  joinOpen?: boolean;
}

export function isMember(organisation: Organisation, userId: number): boolean {
  return (
    organisation.createdBy === userId ||
    Boolean(organisation.participants && organisation.participants.includes(userId))
  );
}

export function isAdmin(organisation: Organisation, userId: number): boolean {
  return organisation.createdBy === userId;
}

export function contextRefOf(organisation: Organisation, context: MatchContext): ContextRef {
  return context === "league" ? { leagueId: organisation.id } : { clubId: organisation.id };
}

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

export async function loadClubMember(
  req: AuthRequest,
  res: Response,
  clubId: number,
): Promise<{ club: Club; user: User } | undefined> {
  const user = requireUser(req);
  const club = await clubRepo.getClub(clubId);
  if (!club || !isMember(club, user.id)) {
    res.status(404).json({ message: "Club not found" });
    return;
  }
  return { club, user };
}

export interface MatchAccess {
  match: Match;
  user: User;
  context: MatchContext;
  organisation: Organisation;
  /** Present only on Fantasy matches, so existing League routes keep their narrow type. */
  league: League;
}

/**
 * Resolves the organisation a match belongs to and checks membership. Fantasy routes read
 * `league`; Club-aware routes read `context` and `organisation`.
 */
export async function loadMatchAccess(
  req: AuthRequest,
  res: Response,
  matchId: number,
): Promise<Omit<MatchAccess, "league"> | undefined> {
  const user = requireUser(req);
  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    res.status(404).json({ message: "Match not found" });
    return;
  }
  const context = contextOf(match);
  const organisation =
    context === "league"
      ? await leagueRepo.getLeague(match.leagueId!)
      : await clubRepo.getClub(match.clubId!);
  if (!organisation || !isMember(organisation, user.id)) {
    res.status(404).json({ message: "Match not found" });
    return;
  }
  return { match, user, context, organisation };
}

/** Fantasy-only variant: a Club match is not found here. */
export async function loadMatchMember(
  req: AuthRequest,
  res: Response,
  matchId: number,
): Promise<{ match: Match; league: League; user: User } | undefined> {
  const access = await loadMatchAccess(req, res, matchId);
  if (!access) {
    return;
  }
  if (access.context !== "league") {
    res.status(404).json({ message: "Match not found" });
    return;
  }
  return { match: access.match, league: access.organisation as League, user: access.user };
}

export function rejectUnlessAdmin(
  res: Response,
  organisation: Organisation,
  userId: number,
  message: string,
): boolean {
  if (!isAdmin(organisation, userId)) {
    res.status(403).json({ message });
    return true;
  }
  return false;
}

export { isLeagueAdmin, isLeagueMember };
