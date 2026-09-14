import { and, count, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  clubs,
  leagues,
  lineups,
  matchMvpVotes,
  matchPeerRatings,
  matches,
  players,
  statReports,
  tierLists,
  users,
} from "@shared/schema";
import { db } from "../db";

const PLAYED_STATUSES = ["completed", "scored", "closed"] as const;
const IN_PROGRESS_STATUSES = ["open", "started"] as const;
const VALUATION_STATUSES = ["voting", "closed"] as const;

export type AnalyticsPulseKind =
  | "fantasy_competition"
  | "club_competition"
  | "fantasy_match"
  | "club_match"
  | "valuation";

export type AnalyticsPulseItem = {
  kind: AnalyticsPulseKind;
  at: string;
  memberCount?: number;
  status?: string;
};

export type AnalyticsOverview = {
  generatedAt: string;
  hero: {
    accounts: { total: number; pending: number; last30Days: number };
    competitions: { total: number; valuating: number; last30Days: number };
    matchesPlayed: { total: number; inProgress: number; last30Days: number };
    ratings: { total: number };
  };
  engagement: {
    valuations: { total: number; last7Days: number; last30Days: number };
    lineups: { total: number };
    statReports: { total: number };
    activeGroups: { total: number };
    accounts: { last7Days: number; last30Days: number };
    competitions: { last7Days: number; last30Days: number };
    matches: { last7Days: number; last30Days: number };
  };
  mix: {
    competitions: { fantasy: number; club: number };
    matches: { fantasy: number; club: number };
    players: { linked: number; guests: number };
  };
  pulse: AnalyticsPulseItem[];
};

async function scalar(query: Promise<{ n: number | string }[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function memberCount(participants: number[] | null | undefined): number {
  return Array.isArray(participants) ? participants.length : 0;
}

export async function getOverview(): Promise<AnalyticsOverview> {
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);

  const [
    verifiedAccounts,
    pendingAccounts,
    accounts7,
    accounts30,
    leagueTotal,
    clubTotal,
    leaguesValuating,
    clubsValuating,
    leagues7,
    clubs7,
    leagues30,
    clubs30,
    matchesPlayed,
    matchesInProgress,
    matchesPlayed30,
    matches7,
    matches30,
    peerRatings,
    mvpVotes,
    valuations,
    valuations7,
    valuations30,
    lineupTotal,
    statTotal,
    activeLeagues,
    activeClubs,
    fantasyMatches,
    clubMatches,
    linkedPlayers,
    guestPlayers,
    recentLeagues,
    recentClubs,
    recentMatches,
    recentValuations,
  ] = await Promise.all([
    scalar(db.select({ n: count() }).from(users).where(isNotNull(users.emailVerifiedAt))),
    scalar(db.select({ n: count() }).from(users).where(isNull(users.emailVerifiedAt))),
    scalar(
      db
        .select({ n: count() })
        .from(users)
        .where(and(isNotNull(users.emailVerifiedAt), gte(users.emailVerifiedAt, since7))),
    ),
    scalar(
      db
        .select({ n: count() })
        .from(users)
        .where(and(isNotNull(users.emailVerifiedAt), gte(users.emailVerifiedAt, since30))),
    ),
    scalar(db.select({ n: count() }).from(leagues)),
    scalar(db.select({ n: count() }).from(clubs)),
    scalar(db.select({ n: count() }).from(leagues).where(inArray(leagues.status, [...VALUATION_STATUSES]))),
    scalar(db.select({ n: count() }).from(clubs).where(inArray(clubs.status, [...VALUATION_STATUSES]))),
    scalar(db.select({ n: count() }).from(leagues).where(gte(leagues.createdAt, since7))),
    scalar(db.select({ n: count() }).from(clubs).where(gte(clubs.createdAt, since7))),
    scalar(db.select({ n: count() }).from(leagues).where(gte(leagues.createdAt, since30))),
    scalar(db.select({ n: count() }).from(clubs).where(gte(clubs.createdAt, since30))),
    scalar(db.select({ n: count() }).from(matches).where(inArray(matches.status, [...PLAYED_STATUSES]))),
    scalar(db.select({ n: count() }).from(matches).where(inArray(matches.status, [...IN_PROGRESS_STATUSES]))),
    scalar(
      db
        .select({ n: count() })
        .from(matches)
        .where(and(inArray(matches.status, [...PLAYED_STATUSES]), gte(matches.createdAt, since30))),
    ),
    scalar(db.select({ n: count() }).from(matches).where(gte(matches.createdAt, since7))),
    scalar(db.select({ n: count() }).from(matches).where(gte(matches.createdAt, since30))),
    scalar(db.select({ n: count() }).from(matchPeerRatings)),
    scalar(db.select({ n: count() }).from(matchMvpVotes)),
    scalar(db.select({ n: count() }).from(tierLists).where(eq(tierLists.submitted, true))),
    scalar(
      db
        .select({ n: count() })
        .from(tierLists)
        .where(and(eq(tierLists.submitted, true), gte(tierLists.createdAt, since7))),
    ),
    scalar(
      db
        .select({ n: count() })
        .from(tierLists)
        .where(and(eq(tierLists.submitted, true), gte(tierLists.createdAt, since30))),
    ),
    scalar(db.select({ n: count() }).from(lineups)),
    scalar(db.select({ n: count() }).from(statReports)),
    scalar(
      db
        .select({ n: sql<number>`cast(count(distinct ${matches.leagueId}) as int)` })
        .from(matches)
        .where(isNotNull(matches.leagueId)),
    ),
    scalar(
      db
        .select({ n: sql<number>`cast(count(distinct ${matches.clubId}) as int)` })
        .from(matches)
        .where(isNotNull(matches.clubId)),
    ),
    scalar(db.select({ n: count() }).from(matches).where(isNotNull(matches.leagueId))),
    scalar(db.select({ n: count() }).from(matches).where(isNotNull(matches.clubId))),
    scalar(db.select({ n: count() }).from(players).where(isNotNull(players.userId))),
    scalar(db.select({ n: count() }).from(players).where(isNull(players.userId))),
    db
      .select({ createdAt: leagues.createdAt, participants: leagues.participants })
      .from(leagues)
      .orderBy(desc(leagues.createdAt))
      .limit(10),
    db
      .select({ createdAt: clubs.createdAt, participants: clubs.participants })
      .from(clubs)
      .orderBy(desc(clubs.createdAt))
      .limit(10),
    db
      .select({
        createdAt: matches.createdAt,
        status: matches.status,
        leagueId: matches.leagueId,
        clubId: matches.clubId,
      })
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(10),
    db
      .select({
        createdAt: tierLists.createdAt,
      })
      .from(tierLists)
      .where(eq(tierLists.submitted, true))
      .orderBy(desc(tierLists.createdAt))
      .limit(10),
  ]);

  const pulse: AnalyticsPulseItem[] = [];

  for (const row of recentLeagues) {
    const at = iso(row.createdAt);
    if (!at) continue;
    pulse.push({
      kind: "fantasy_competition",
      at,
      memberCount: memberCount(row.participants),
    });
  }
  for (const row of recentClubs) {
    const at = iso(row.createdAt);
    if (!at) continue;
    pulse.push({
      kind: "club_competition",
      at,
      memberCount: memberCount(row.participants),
    });
  }
  for (const row of recentMatches) {
    const at = iso(row.createdAt);
    if (!at) continue;
    pulse.push({
      kind: row.clubId != null ? "club_match" : "fantasy_match",
      at,
      status: row.status ?? undefined,
    });
  }
  for (const row of recentValuations) {
    const at = iso(row.createdAt);
    if (!at) continue;
    pulse.push({
      kind: "valuation",
      at,
    });
  }

  pulse.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return {
    generatedAt: new Date().toISOString(),
    hero: {
      accounts: {
        total: verifiedAccounts,
        pending: pendingAccounts,
        last30Days: accounts30,
      },
      competitions: {
        total: leagueTotal + clubTotal,
        valuating: leaguesValuating + clubsValuating,
        last30Days: leagues30 + clubs30,
      },
      matchesPlayed: {
        total: matchesPlayed,
        inProgress: matchesInProgress,
        last30Days: matchesPlayed30,
      },
      ratings: {
        total: peerRatings + mvpVotes,
      },
    },
    engagement: {
      valuations: {
        total: valuations,
        last7Days: valuations7,
        last30Days: valuations30,
      },
      lineups: { total: lineupTotal },
      statReports: { total: statTotal },
      activeGroups: { total: activeLeagues + activeClubs },
      accounts: { last7Days: accounts7, last30Days: accounts30 },
      competitions: { last7Days: leagues7 + clubs7, last30Days: leagues30 + clubs30 },
      matches: { last7Days: matches7, last30Days: matches30 },
    },
    mix: {
      competitions: { fantasy: leagueTotal, club: clubTotal },
      matches: { fantasy: fantasyMatches, club: clubMatches },
      players: { linked: linkedPlayers, guests: guestPlayers },
    },
    pulse: pulse.slice(0, 10),
  };
}
