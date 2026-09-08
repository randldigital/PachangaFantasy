import {
  playerMatchPoints,
  managerMatchPoints,
  users,
  matches,
  type PlayerMatchPoints,
  type ManagerMatchPoints,
} from "@shared/schema";
import { db } from "../db";
import { eq, sql, inArray, and } from "drizzle-orm";
import * as statsRepo from "./statsRepo";
import * as leagueRepo from "./leagueRepo";
import * as playerRepo from "./playerRepo";
import * as matchRepo from "./matchRepo";
import * as lineupRepo from "./lineupRepo";
import { playerPointsFromStats, scoreManagerLineup } from "@shared/domain/scoring";

export type MatchScoreResult = {
  playerPoints: PlayerMatchPoints[];
  managerPoints: ManagerMatchPoints[];
  lineupIssues: { userId: number; codes: string[]; message: string }[];
};

export async function getPlayerPointsForMatch(matchId: number): Promise<PlayerMatchPoints[]> {
  return await db.select().from(playerMatchPoints).where(eq(playerMatchPoints.matchId, matchId));
}

export async function getManagerPointsForMatch(matchId: number): Promise<ManagerMatchPoints[]> {
  return await db.select().from(managerMatchPoints).where(eq(managerMatchPoints.matchId, matchId));
}

export async function getScoredMatchResult(matchId: number): Promise<MatchScoreResult> {
  const [playerPoints, managerPoints] = await Promise.all([
    getPlayerPointsForMatch(matchId),
    getManagerPointsForMatch(matchId),
  ]);
  return {
    playerPoints,
    managerPoints,
    lineupIssues: managerPoints
      .filter((row) => row.lineupStatus === "invalid")
      .map((row) => ({
        userId: row.userId,
        codes: ["LINEUP_INVALID"],
        message: "Stored lineup is invalid and scored zero",
      })),
  };
}

export async function scoreMatch(matchId: number): Promise<MatchScoreResult> {
  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    throw new Error("Match not found");
  }

  const [reports, participants, lineups, league] = await Promise.all([
    statsRepo.getStatReportsForMatch(matchId),
    matchRepo.getMatchParticipants(matchId),
    lineupRepo.getLineupsForMatch(matchId),
    leagueRepo.getLeague(match.leagueId),
  ]);

  const acceptedIds = participants
    .filter((participant) => participant.status === "accepted")
    .map((participant) => participant.playerId);

  const playerPointsById = new Map<number, number>();
  const playerRows = reports
    .filter((report) => acceptedIds.includes(report.playerId))
    .map((report) => {
      const points = playerPointsFromStats(report);
      playerPointsById.set(report.playerId, points);
      return {
        playerId: report.playerId,
        matchId,
        goals: report.goals ?? 0,
        assists: report.assists ?? 0,
        points,
      };
    });

  const lineupByUser = new Map(lineups.map((lineup) => [lineup.userId, lineup]));
  const memberIds = league
    ? [...new Set([league.createdBy, ...(league.participants || [])])]
    : [];

  const lineupIssues: MatchScoreResult["lineupIssues"] = [];
  const managerRows = memberIds.map((userId) => {
    const lineup = lineupByUser.get(userId) ?? null;
    const scored = scoreManagerLineup({
      lineup: lineup ? { playerIds: lineup.playerIds, captainId: lineup.captainId } : null,
      participantIds: acceptedIds,
      playerPointsById,
    });
    if (scored.status === "invalid") {
      lineupIssues.push({
        userId,
        codes: scored.violations.map((violation) => violation.code),
        message: scored.violations[0]?.message ?? "Stored lineup is invalid and scored zero",
      });
    }
    return {
      userId,
      matchId,
      playerIds: lineup?.playerIds ?? null,
      captainId: lineup?.captainId ?? null,
      points: scored.points,
      lineupStatus: scored.status,
    };
  });

  return await db.transaction(async (tx) => {
    await tx.delete(playerMatchPoints).where(eq(playerMatchPoints.matchId, matchId));
    await tx.delete(managerMatchPoints).where(eq(managerMatchPoints.matchId, matchId));
    const insertedPlayers =
      playerRows.length > 0
        ? await tx.insert(playerMatchPoints).values(playerRows).returning()
        : [];
    const insertedManagers =
      managerRows.length > 0
        ? await tx.insert(managerMatchPoints).values(managerRows).returning()
        : [];
    await tx.update(matches).set({ status: "scored" }).where(eq(matches.id, matchId));
    return {
      playerPoints: insertedPlayers,
      managerPoints: insertedManagers,
      lineupIssues,
    };
  });
}

export async function getPlayerLeaderboard(leagueId: number): Promise<{
  playerId: number;
  name: string;
  userId: number | null;
  username: string;
  totalPoints: number;
  goals: number;
  assists: number;
  matchesPlayed: number;
}[]> {
  const leaguePlayers = await playerRepo.getPlayersByLeague(leagueId);
  if (leaguePlayers.length === 0) {
    return [];
  }

  const playerIds = leaguePlayers.map((player) => player.id);
  const totals = await db
    .select({
      playerId: playerMatchPoints.playerId,
      totalPoints: sql<number>`COALESCE(SUM(${playerMatchPoints.points}), 0)`,
      goals: sql<number>`COALESCE(SUM(${playerMatchPoints.goals}), 0)`,
      assists: sql<number>`COALESCE(SUM(${playerMatchPoints.assists}), 0)`,
      matchesPlayed: sql<number>`COUNT(${playerMatchPoints.id})`,
    })
    .from(playerMatchPoints)
    .innerJoin(matches, and(eq(playerMatchPoints.matchId, matches.id), eq(matches.leagueId, leagueId)))
    .where(inArray(playerMatchPoints.playerId, playerIds))
    .groupBy(playerMatchPoints.playerId);

  const byPlayer = new Map(
    totals.map((row) => [
      row.playerId,
      {
        totalPoints: Number(row.totalPoints),
        goals: Number(row.goals),
        assists: Number(row.assists),
        matchesPlayed: Number(row.matchesPlayed),
      },
    ]),
  );

  return leaguePlayers
    .map((player) => {
      const row = byPlayer.get(player.id);
      return {
        playerId: player.id,
        name: player.name,
        userId: player.userId ?? null,
        username: player.name,
        totalPoints: row?.totalPoints ?? 0,
        goals: row?.goals ?? 0,
        assists: row?.assists ?? 0,
        matchesPlayed: row?.matchesPlayed ?? 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
}

export async function getManagerLeaderboard(
  leagueId: number,
): Promise<{ userId: number; username: string; totalPoints: number }[]> {
  const league = await leagueRepo.getLeague(leagueId);
  if (!league) {
    return [];
  }

  const memberIds = [...new Set([league.createdBy, ...(league.participants || [])])];
  if (memberIds.length === 0) {
    return [];
  }

  const members = await db
    .select({
      userId: users.id,
      username: users.username,
    })
    .from(users)
    .where(inArray(users.id, memberIds));

  const pointsRows = await db
    .select({
      userId: managerMatchPoints.userId,
      totalPoints: sql<number>`COALESCE(SUM(${managerMatchPoints.points}), 0)`,
    })
    .from(managerMatchPoints)
    .innerJoin(matches, and(eq(managerMatchPoints.matchId, matches.id), eq(matches.leagueId, leagueId)))
    .where(inArray(managerMatchPoints.userId, memberIds))
    .groupBy(managerMatchPoints.userId);

  const pointsByUser = new Map(
    pointsRows.map((row) => [row.userId, Number(row.totalPoints)]),
  );

  return members
    .map((member) => ({
      userId: member.userId,
      username: member.username,
      totalPoints: pointsByUser.get(member.userId) ?? 0,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.username.localeCompare(b.username));
}

export async function getLeagueRankings(leagueId: number) {
  return getPlayerLeaderboard(leagueId);
}
