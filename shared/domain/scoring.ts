/**
 * Player match rating from peer votes plus on-pitch extras.
 * Manager Points are a separate calculation — captain multiplier never applies here.
 */

import { scoringLineupViolations, type LineupViolation } from "./lineup";

export interface StatLike {
  goals?: number | null;
  assists?: number | null;
}

export const POINTS_PER_GOAL = 3;
export const POINTS_PER_ASSIST = 2;
export const POINTS_PER_MVP = 2;
export const PEER_RATING_MIN = 0;
export const PEER_RATING_MAX = 10;
export const PEER_RATING_NEUTRAL = 5;
export const PEER_RATING_FORCE_DEFAULT = 6.5;

export function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function meanPeerScore(scores: number[], empty = PEER_RATING_NEUTRAL): number {
  if (scores.length === 0) {
    return empty;
  }
  return roundOneDecimal(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export type PeerRatingLike = {
  raterPlayerId: number;
  rateePlayerId: number;
  score: number;
};

export type PeerAssignmentLike = {
  raterPlayerId: number;
  rateePlayerId: number;
};

/** Incoming scores per player. When `missingScore` is set, unfilled assignment slots use that value. */
export function collectedPeerScores(input: {
  ratings: PeerRatingLike[];
  assignments?: PeerAssignmentLike[];
  missingScore?: number;
}): Map<number, number[]> {
  const byRatee = new Map<number, number[]>();

  if (input.missingScore == null || !input.assignments) {
    for (const rating of input.ratings) {
      const list = byRatee.get(rating.rateePlayerId) ?? [];
      list.push(rating.score);
      byRatee.set(rating.rateePlayerId, list);
    }
    return byRatee;
  }

  const submitted = new Map(
    input.ratings.map((rating) => [`${rating.raterPlayerId}:${rating.rateePlayerId}`, rating.score]),
  );
  for (const assignment of input.assignments) {
    const key = `${assignment.raterPlayerId}:${assignment.rateePlayerId}`;
    const score = submitted.get(key) ?? input.missingScore;
    const list = byRatee.get(assignment.rateePlayerId) ?? [];
    list.push(score);
    byRatee.set(assignment.rateePlayerId, list);
  }
  return byRatee;
}

export function mvpPlayerIds(votes: { mvpPlayerId: number }[]): Set<number> {
  if (votes.length === 0) {
    return new Set();
  }
  const counts = new Map<number, number>();
  for (const vote of votes) {
    counts.set(vote.mvpPlayerId, (counts.get(vote.mvpPlayerId) ?? 0) + 1);
  }
  const maxVotes = Math.max(...counts.values());
  if (maxVotes <= 0) {
    return new Set();
  }
  return new Set(
    [...counts.entries()].filter(([, count]) => count === maxVotes).map(([playerId]) => playerId),
  );
}

export function statExtras(stats: StatLike): number {
  return (stats.goals || 0) * POINTS_PER_GOAL + (stats.assists || 0) * POINTS_PER_ASSIST;
}

export function playerPointsFromStats(stats: StatLike): number {
  return statExtras(stats);
}

export function playerMatchRating(input: {
  peerAverage: number;
  goals?: number | null;
  assists?: number | null;
  isMvp: boolean;
}): number {
  return roundOneDecimal(
    input.peerAverage +
      statExtras(input) +
      (input.isMvp ? POINTS_PER_MVP : 0),
  );
}

export function validateGoalTotal(
  reportedGoals: number[],
  expectedTotal: number,
): { isValid: boolean; reportedTotal: number; difference: number } {
  const reportedTotal = reportedGoals.reduce((sum, goals) => sum + goals, 0);
  return {
    isValid: reportedTotal === expectedTotal,
    reportedTotal,
    difference: reportedTotal - expectedTotal,
  };
}

export type LineupScoringStatus = "ok" | "missing" | "invalid";

function pointsOf(playerId: number, playerPointsById: Map<number, number> | Record<number, number>): number {
  if (playerPointsById instanceof Map) {
    return playerPointsById.get(playerId) ?? 0;
  }
  return playerPointsById[playerId] ?? 0;
}

export function managerMatchPoints(input: {
  playerIds: number[];
  captainId: number;
  playerPointsById: Map<number, number> | Record<number, number>;
}): number {
  const base = input.playerIds.reduce((sum, playerId) => sum + pointsOf(playerId, input.playerPointsById), 0);
  return roundOneDecimal(base + pointsOf(input.captainId, input.playerPointsById));
}

export function scoreManagerLineup(input: {
  lineup: { playerIds: number[]; captainId: number } | null;
  participantIds: number[];
  playerPointsById: Map<number, number> | Record<number, number>;
}): { points: number; status: LineupScoringStatus; violations: LineupViolation[] } {
  if (!input.lineup) {
    return { points: 0, status: "missing", violations: [] };
  }

  const violations = scoringLineupViolations({
    playerIds: input.lineup.playerIds,
    captainId: input.lineup.captainId,
    participantIds: input.participantIds,
  });

  if (violations.length > 0) {
    return { points: 0, status: "invalid", violations };
  }

  return {
    points: managerMatchPoints({
      playerIds: input.lineup.playerIds,
      captainId: input.lineup.captainId,
      playerPointsById: input.playerPointsById,
    }),
    status: "ok",
    violations: [],
  };
}
