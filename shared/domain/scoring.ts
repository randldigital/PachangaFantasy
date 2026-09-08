/**
 * Player Points from real-match statistics.
 * Manager Points are a separate calculation — captain multiplier never applies here.
 */

import { scoringLineupViolations, type LineupViolation } from "./lineup";

export interface StatLike {
  goals?: number | null;
  assists?: number | null;
}

export const POINTS_PER_GOAL = 3;
export const POINTS_PER_ASSIST = 2;

export function playerPointsFromStats(stats: StatLike): number {
  return (stats.goals || 0) * POINTS_PER_GOAL + (stats.assists || 0) * POINTS_PER_ASSIST;
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
  return base + pointsOf(input.captainId, input.playerPointsById);
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
