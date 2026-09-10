/**
 * Club Mode Player Points. Shares the football weights of Fantasy (goals ×3, assists ×2)
 * and adds a minutes component, but has no Market Value, captain or Manager Points.
 */

import {
  POINTS_PER_ASSIST,
  POINTS_PER_GOAL,
  roundOneDecimal,
  type StatLike,
} from "./scoring";

export const MAX_MINUTES = 120;
export const FULL_MATCH_MINUTES = 90;
export const MAX_MINUTES_POINTS = 5;

/**
 * UNRESOLVED — the Club Match result must affect Player Points, but Fantasy explicitly
 * forbids a win bonus (§16.1), so the Club weight cannot be inferred from it. Awaiting
 * product confirmation; until then `resultContribution` is always 0 and the W/D/L outcome
 * is persisted for history and ranking filters only.
 */
export const CLUB_RESULT_POINTS_PENDING = true;

/**
 * UNRESOLVED — the MVP must affect Player Points. Fantasy uses +2, but whether Club
 * reuses that value needs product confirmation, so `mvpContribution` is always 0 and the
 * MVP flag is persisted for history only.
 */
export const CLUB_MVP_POINTS_PENDING = true;

export type ClubMatchResult = "win" | "draw" | "loss";

export function clubResultOf(ourGoals: number, opponentGoals: number): ClubMatchResult {
  if (ourGoals > opponentGoals) return "win";
  if (ourGoals < opponentGoals) return "loss";
  return "draw";
}

/** Minutes are worth up to 5 points, reached at a full 90; 120 does not earn more. */
export function minutesComponent(minutes: number | null | undefined): number {
  if (minutes == null || minutes <= 0) {
    return 0;
  }
  const capped = Math.min(minutes, MAX_MINUTES);
  return Math.min(
    MAX_MINUTES_POINTS,
    roundOneDecimal((capped * MAX_MINUTES_POINTS) / FULL_MATCH_MINUTES),
  );
}

export interface ClubPlayerPointsInput extends StatLike {
  peerAverage: number;
  minutes?: number | null;
  result: ClubMatchResult;
  isMvp: boolean;
}

export interface ClubPlayerPointsBreakdown {
  peerAverage: number;
  offensive: number;
  minutes: number;
  /** Always 0 until the Club result weight is confirmed. */
  resultContribution: number;
  /** Always 0 until the Club MVP weight is confirmed. */
  mvpContribution: number;
  points: number;
}

/**
 * The two bonuses below are deliberately zero: adding an invented coefficient would
 * silently define product rules that have not been agreed.
 */
export function clubPlayerPoints(input: ClubPlayerPointsInput): ClubPlayerPointsBreakdown {
  const offensive = (input.goals || 0) * POINTS_PER_GOAL + (input.assists || 0) * POINTS_PER_ASSIST;
  const minutes = minutesComponent(input.minutes);
  const resultContribution = 0;
  const mvpContribution = 0;

  return {
    peerAverage: input.peerAverage,
    offensive,
    minutes,
    resultContribution,
    mvpContribution,
    points: roundOneDecimal(
      input.peerAverage + offensive + minutes + resultContribution + mvpContribution,
    ),
  };
}
