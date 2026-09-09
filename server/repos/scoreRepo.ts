import {
  playerMatchPoints,
  managerMatchPoints,
  users,
  matches,
  players,
  leagues,
  playerMarketValueHistory,
  type PlayerMatchPoints,
  type ManagerMatchPoints,
  type PlayerMarketValueHistory,
} from "@shared/schema";
import { db } from "../db";
import { eq, sql, inArray, and } from "drizzle-orm";
import * as statsRepo from "./statsRepo";
import * as leagueRepo from "./leagueRepo";
import * as playerRepo from "./playerRepo";
import * as matchRepo from "./matchRepo";
import * as lineupRepo from "./lineupRepo";
import * as ratingRepo from "./ratingRepo";
import { collectedPeerScores, meanPeerScore, mvpPlayerIds, PEER_RATING_FORCE_DEFAULT, PEER_RATING_NEUTRAL, playerMatchRating, scoreManagerLineup } from "@shared/domain/scoring";
import {
  computeMatchMarketValues,
  DEFAULT_SCORING_BASELINE,
  nextScoringBaseline,
} from "@shared/domain/marketValue";

export type MatchScoreResult = {
  playerPoints: PlayerMatchPoints[];
  managerPoints: ManagerMatchPoints[];
  lineupIssues: { userId: number; codes: string[]; message: string }[];
  marketValues?: PlayerMarketValueHistory[];
};

export async function getPlayerPointsForMatch(matchId: number): Promise<PlayerMatchPoints[]> {
  return await db.select().from(playerMatchPoints).where(eq(playerMatchPoints.matchId, matchId));
}

export async function getManagerPointsForMatch(matchId: number): Promise<ManagerMatchPoints[]> {
  return await db.select().from(managerMatchPoints).where(eq(managerMatchPoints.matchId, matchId));
}

export async function getScoredMatchResult(matchId: number): Promise<MatchScoreResult> {
  const [playerPoints, managerPoints, marketValues] = await Promise.all([
    getPlayerPointsForMatch(matchId),
    getManagerPointsForMatch(matchId),
    ratingRepo.getMarketValueHistory(matchId),
  ]);
  return {
    playerPoints,
    managerPoints,
    marketValues,
    lineupIssues: managerPoints
      .filter((row) => row.lineupStatus === "invalid")
      .map((row) => ({
        userId: row.userId,
        codes: ["LINEUP_INVALID"],
        message: "Stored lineup is invalid and scored zero",
      })),
  };
}

export type ScoreMatchOptions = {
  forceIncompleteRatings?: boolean;
};

export async function scoreMatch(matchId: number, options: ScoreMatchOptions = {}): Promise<MatchScoreResult> {
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

  const [mvpVotes, peerRatings, assignments] = await Promise.all([
    ratingRepo.getMvpVotes(matchId),
    ratingRepo.getPeerRatings(matchId),
    ratingRepo.getRatingAssignments(matchId),
  ]);
  const force = Boolean(options.forceIncompleteRatings);
  const mvps = force ? new Set<number>() : mvpPlayerIds(mvpVotes);
  const peerByPlayer = collectedPeerScores({
    ratings: peerRatings,
    assignments: force ? assignments : undefined,
    missingScore: force ? PEER_RATING_FORCE_DEFAULT : undefined,
  });

  const playerPointsById = new Map<number, number>();
  const playerRows = reports
    .filter((report) => acceptedIds.includes(report.playerId))
    .map((report) => {
      const points = playerMatchRating({
        peerAverage: meanPeerScore(
          peerByPlayer.get(report.playerId) ?? [],
          force ? PEER_RATING_FORCE_DEFAULT : PEER_RATING_NEUTRAL,
        ),
        goals: force ? 0 : report.goals,
        assists: force ? 0 : report.assists,
        isMvp: mvps.has(report.playerId),
      });
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

  const vmRows = await ratingRepo.snapshotMatchPlayerVm(matchId);
  const preMatchVm = Object.fromEntries(vmRows.map((row) => [row.playerId, row.marketValue]));
  const baseline = league?.scoringBaseline ?? DEFAULT_SCORING_BASELINE;
  const teamA = match.matchTeams?.teamA ?? [];
  const teamB = match.matchTeams?.teamB ?? [];
  const marketResults =
    teamA.length > 0 && teamB.length > 0
      ? computeMatchMarketValues({
          participantIds: acceptedIds,
          teamA,
          teamB,
          teamAGoals: match.teamAGoals ?? 0,
          teamBGoals: match.teamBGoals ?? 0,
          baseline,
          preMatchVm,
          stats: reports
            .filter((report) => acceptedIds.includes(report.playerId))
            .map((report) => ({
              playerId: report.playerId,
              goals: report.goals ?? 0,
              assists: report.assists ?? 0,
            })),
          mvpVotes: mvpVotes.map((vote) => ({
            voterPlayerId: vote.voterPlayerId,
            mvpPlayerId: vote.mvpPlayerId,
          })),
          peerRatings: force
            ? assignments.map((assignment) => {
                const submitted = peerRatings.find(
                  (rating) =>
                    rating.raterPlayerId === assignment.raterPlayerId &&
                    rating.rateePlayerId === assignment.rateePlayerId,
                );
                return {
                  raterPlayerId: assignment.raterPlayerId,
                  rateePlayerId: assignment.rateePlayerId,
                  score: submitted?.score ?? PEER_RATING_FORCE_DEFAULT,
                };
              })
            : peerRatings.map((rating) => ({
                raterPlayerId: rating.raterPlayerId,
                rateePlayerId: rating.rateePlayerId,
                score: rating.score,
              })),
        })
      : [];
  const nextBaseline = nextScoringBaseline(
    baseline,
    match.teamAGoals ?? 0,
    match.teamBGoals ?? 0,
  );

  return await db.transaction(async (tx) => {
    await tx.delete(playerMatchPoints).where(eq(playerMatchPoints.matchId, matchId));
    await tx.delete(managerMatchPoints).where(eq(managerMatchPoints.matchId, matchId));
    await tx.delete(playerMarketValueHistory).where(eq(playerMarketValueHistory.matchId, matchId));
    const insertedPlayers =
      playerRows.length > 0
        ? await tx.insert(playerMatchPoints).values(playerRows).returning()
        : [];
    const insertedManagers =
      managerRows.length > 0
        ? await tx.insert(managerMatchPoints).values(managerRows).returning()
        : [];

    let insertedHistory: PlayerMarketValueHistory[] = [];
    if (marketResults.length > 0) {
      insertedHistory = await tx
        .insert(playerMarketValueHistory)
        .values(
          marketResults.map((row) => ({
            matchId,
            playerId: row.playerId,
            vmBefore: row.change.vmBefore,
            vmAfter: row.change.vmAfter,
            delta: row.change.delta,
            mvp: row.mvp,
            peer: row.peer,
            offensive: row.offensive,
            result: row.result,
            performanceScore: row.performanceScore,
            rawChange: row.change.rawChange,
            multiplier: row.change.multiplier,
            adjustedContribution: row.adjustedContribution,
            expectedContribution: row.expectedContribution,
            baseline: row.baseline,
            ownTeamAvgVm: row.ownTeamAvgVm,
            oppTeamAvgVm: row.oppTeamAvgVm,
            mvpVotes: row.mvpVotes,
            peerAverage: row.peerAverage,
            breakdown: row as unknown as Record<string, unknown>,
          })),
        )
        .returning();
      for (const row of marketResults) {
        await tx
          .update(players)
          .set({ marketValue: row.change.vmAfter })
          .where(eq(players.id, row.playerId));
      }
    }

    if (league) {
      await tx
        .update(leagues)
        .set({ scoringBaseline: nextBaseline })
        .where(eq(leagues.id, league.id));
    }

    await tx.update(matches).set({ status: "scored" }).where(eq(matches.id, matchId));
    return {
      playerPoints: insertedPlayers,
      managerPoints: insertedManagers,
      lineupIssues,
      marketValues: insertedHistory,
    };
  });
}

export type MatchRecapPlayer = {
  playerId: number;
  name: string;
  team: "A" | "B" | null;
  goals: number;
  assists: number;
  points: number | null;
  mvpVotes: number;
  isMvp: boolean;
  peerAverage: number | null;
  vmBefore: number | null;
  vmAfter: number | null;
  delta: number | null;
};

export type MatchRecap = {
  matchId: number;
  status: string | null;
  date: Date | string;
  teamAGoals: number | null;
  teamBGoals: number | null;
  players: MatchRecapPlayer[];
};

export async function getMatchRecap(matchId: number): Promise<MatchRecap | null> {
  const match = await matchRepo.getMatch(matchId);
  if (!match) {
    return null;
  }

  const [participants, roster, reports, pointRows, history, votes, peerRatings] = await Promise.all([
    matchRepo.getMatchParticipants(matchId),
    playerRepo.getPlayersByLeague(match.leagueId),
    statsRepo.getStatReportsForMatch(matchId),
    getPlayerPointsForMatch(matchId),
    ratingRepo.getMarketValueHistory(matchId),
    ratingRepo.getMvpVotes(matchId),
    ratingRepo.getPeerRatings(matchId),
  ]);

  const names = new Map(roster.map((player) => [player.id, player.name]));
  const teamA = new Set(match.matchTeams?.teamA ?? []);
  const teamB = new Set(match.matchTeams?.teamB ?? []);
  const accepted = participants.filter((participant) => participant.status === "accepted");
  const voteCounts = new Map<number, number>();
  for (const vote of votes) {
    voteCounts.set(vote.mvpPlayerId, (voteCounts.get(vote.mvpPlayerId) ?? 0) + 1);
  }
  const historyByPlayer = new Map(history.map((row) => [row.playerId, row]));
  const pointsByPlayer = new Map(pointRows.map((row) => [row.playerId, row]));
  const reportsByPlayer = new Map(reports.map((row) => [row.playerId, row]));
  const peerByPlayer = new Map<number, number[]>();
  for (const rating of peerRatings) {
    const list = peerByPlayer.get(rating.rateePlayerId) ?? [];
    list.push(rating.score);
    peerByPlayer.set(rating.rateePlayerId, list);
  }

  const maxVotes = voteCounts.size > 0 ? Math.max(...voteCounts.values()) : 0;

  const players: MatchRecapPlayer[] = accepted.map((participant) => {
    const historyRow = historyByPlayer.get(participant.playerId);
    const pointRow = pointsByPlayer.get(participant.playerId);
    const report = reportsByPlayer.get(participant.playerId);
    const received = peerByPlayer.get(participant.playerId) ?? [];
    const mvpVotes = historyRow?.mvpVotes ?? voteCounts.get(participant.playerId) ?? 0;
    const peerAverage =
      historyRow?.peerAverage ??
      (received.length === 0 ? null : received.reduce((sum, value) => sum + value, 0) / received.length);
    const team = teamA.has(participant.playerId) ? "A" : teamB.has(participant.playerId) ? "B" : null;
    return {
      playerId: participant.playerId,
      name: names.get(participant.playerId) ?? `#${participant.playerId}`,
      team,
      goals: pointRow?.goals ?? report?.goals ?? 0,
      assists: pointRow?.assists ?? report?.assists ?? 0,
      points: pointRow?.points ?? null,
      mvpVotes,
      isMvp: maxVotes > 0 && mvpVotes === maxVotes,
      peerAverage,
      vmBefore: historyRow?.vmBefore ?? null,
      vmAfter: historyRow?.vmAfter ?? null,
      delta: historyRow?.delta ?? null,
    };
  });

  players.sort((a, b) => {
    if (a.isMvp !== b.isMvp) {
      return a.isMvp ? -1 : 1;
    }
    return (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name);
  });

  return {
    matchId,
    status: match.status,
    date: match.date,
    teamAGoals: match.teamAGoals,
    teamBGoals: match.teamBGoals,
    players,
  };
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
  mvps: number;
  victories: number;
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

  const leagueMatches = await matchRepo.getMatchesByLeague(leagueId);
  const scoredMatches = leagueMatches.filter((match) => match.status === "scored");
  const scoredIds = scoredMatches.map((match) => match.id);
  const historyRows =
    scoredIds.length > 0
      ? await db
          .select()
          .from(playerMarketValueHistory)
          .where(inArray(playerMarketValueHistory.matchId, scoredIds))
      : [];
  const historyByMatch = new Map<number, PlayerMarketValueHistory[]>();
  for (const row of historyRows) {
    const list = historyByMatch.get(row.matchId) ?? [];
    list.push(row);
    historyByMatch.set(row.matchId, list);
  }

  const mvpCounts = new Map<number, number>();
  const victoryCounts = new Map<number, number>();
  for (const match of scoredMatches) {
    const rows = historyByMatch.get(match.id) ?? [];
    const maxVotes = rows.reduce((max, row) => Math.max(max, row.mvpVotes ?? 0), 0);
    if (maxVotes > 0) {
      for (const row of rows) {
        if (row.mvpVotes === maxVotes) {
          mvpCounts.set(row.playerId, (mvpCounts.get(row.playerId) ?? 0) + 1);
        }
      }
    }
    const teamAGoals = match.teamAGoals ?? 0;
    const teamBGoals = match.teamBGoals ?? 0;
    const winners =
      teamAGoals > teamBGoals
        ? match.matchTeams?.teamA ?? []
        : teamBGoals > teamAGoals
          ? match.matchTeams?.teamB ?? []
          : [];
    for (const playerId of winners) {
      victoryCounts.set(playerId, (victoryCounts.get(playerId) ?? 0) + 1);
    }
  }

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
        mvps: mvpCounts.get(player.id) ?? 0,
        victories: victoryCounts.get(player.id) ?? 0,
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
