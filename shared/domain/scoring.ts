/**
 * Player match rating from peer votes plus on-pitch extras.
 * Manager Points are a separate calculation — captain multiplier never applies here.
 */

import { scoringLineupViolations, type LineupViolation } from "./lineup";

export interface StatLike {
  goals?: number | null;
  assists?: number | null;
}

export const POINTS_PER_GOAL = 2;
export const POINTS_PER_ASSIST = 1;
export const POINTS_PER_MVP = 3;
export const POINTS_PER_WIN = 1;
export const PEER_RATING_MIN = 0;
export const PEER_RATING_MAX = 10;
export const PEER_RATING_NEUTRAL = 5;
export const PEER_RATING_FORCE_DEFAULT = 6.5;
export const WEAKER_OPPONENT_RATIO = 1.15;
export const STRONGER_OPPONENT_RATIO = 0.85;
export const EXPECTANCY_WEAKER = 0.9;
export const EXPECTANCY_STRONGER = 1.15;
export const QUALITY_PENALTY = 0.85;
export const PARTICIPATION_BONUS = 0.15;
export const MAX_DIFFICULTY_PENALTY = 0.2;
export const DIFFICULTY_PER_EXTRA_GOAL = 0.05;

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

export type FantasyRatingFactors = {
  difficulty: number;
  expectancy: number;
  quality: number;
  goals: number;
};

export function isTopQuartileVm(playerVm: number, participantVms: number[]): boolean {
  if (participantVms.length === 0) {
    return false;
  }
  const sorted = [...participantVms].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75));
  return playerVm >= sorted[index];
}

export function fantasyRatingFactors(input: {
  won: boolean;
  ownGoals: number;
  oppGoals: number;
  ownAvgVm: number;
  oppAvgVm: number;
  playerVm: number;
  participantVms: number[];
  goals: number;
  assists: number;
}): FantasyRatingFactors {
  const oppAvg = Math.max(input.oppAvgVm, Number.EPSILON);
  const ratio = input.ownAvgVm / oppAvg;

  let expectancy = 1;
  if (ratio >= WEAKER_OPPONENT_RATIO) {
    expectancy = EXPECTANCY_WEAKER;
  } else if (ratio <= STRONGER_OPPONENT_RATIO) {
    expectancy = EXPECTANCY_STRONGER;
  }

  let difficulty = 1;
  if (input.won) {
    const goalDiff = input.ownGoals - input.oppGoals;
    const penalty = Math.min(
      MAX_DIFFICULTY_PENALTY,
      Math.max(0, (goalDiff - 1) * DIFFICULTY_PER_EXTRA_GOAL),
    );
    if (ratio >= WEAKER_OPPONENT_RATIO) {
      difficulty = 1 - penalty;
    } else if (ratio > STRONGER_OPPONENT_RATIO) {
      difficulty = 1 - penalty / 2;
    }
  }

  const quality =
    isTopQuartileVm(input.playerVm, input.participantVms) && input.goals + input.assists <= 1
      ? QUALITY_PENALTY
      : 1;

  const participation = Math.min(1, (input.goals + input.assists) / Math.max(1, input.ownGoals));
  return {
    difficulty,
    expectancy,
    quality,
    goals: 1 + participation * PARTICIPATION_BONUS,
  };
}

export function playerMatchRating(input: {
  peerAverage: number;
  goals?: number | null;
  assists?: number | null;
  isMvp: boolean;
  won?: boolean;
  factors?: FantasyRatingFactors;
}): number {
  const base =
    input.peerAverage +
    statExtras(input) +
    (input.isMvp ? POINTS_PER_MVP : 0) +
    (input.won ? POINTS_PER_WIN : 0);
  const factors = input.factors;
  const scaled = factors
    ? base * factors.difficulty * factors.expectancy * factors.quality * factors.goals
    : base;
  return roundOneDecimal(scaled);
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
