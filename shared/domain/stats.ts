import { validateGoalTotal } from "./scoring";
import { normalizeMatchStatus } from "./matchLifecycle";

export type ParticipantStatsState = "pending" | "submitted";
export type MatchStatsState = "pending" | "submitted" | "inconsistent" | "validated";

export function isStatsEditable(status: string | null | undefined): boolean {
  return normalizeMatchStatus(status) === "completed";
}

export function pickStatsMatch<T extends { status: string | null }>(matches: T[]): T | undefined {
  return (
    matches.find((match) => normalizeMatchStatus(match.status) === "completed") ??
    matches.find((match) => normalizeMatchStatus(match.status) === "scored")
  );
}

export type StatsStatusInput = {
  participantPlayerIds: number[];
  reports: { playerId: number; goals?: number | null; assists?: number | null }[];
  expectedGoals: number | null;
  acknowledged: boolean;
};

export type StatsStatus = {
  state: MatchStatsState;
  canScore: boolean;
  complete: boolean;
  consistent: boolean;
  acknowledged: boolean;
  pendingPlayerIds: number[];
  submittedPlayerIds: number[];
  expectedTotal: number | null;
  reportedTotal: number;
  difference: number | null;
};

export function statsSubmissionState(input: StatsStatusInput): StatsStatus {
  const participantSet = new Set(input.participantPlayerIds);
  const reportsByPlayer = new Map<number, { playerId: number; goals?: number | null }>();
  for (const report of input.reports) {
    if (participantSet.has(report.playerId)) {
      reportsByPlayer.set(report.playerId, report);
    }
  }

  const submittedPlayerIds = input.participantPlayerIds.filter((id) => reportsByPlayer.has(id));
  const pendingPlayerIds = input.participantPlayerIds.filter((id) => !reportsByPlayer.has(id));
  const complete = input.participantPlayerIds.length > 0 && pendingPlayerIds.length === 0;

  const reportedGoals = submittedPlayerIds.map((id) => reportsByPlayer.get(id)?.goals || 0);
  const expectedTotal = input.expectedGoals;
  const check =
    expectedTotal === null
      ? {
          isValid: false,
          reportedTotal: reportedGoals.reduce((sum, goals) => sum + goals, 0),
          difference: 0,
        }
      : validateGoalTotal(reportedGoals, expectedTotal);

  const reportedTotal = check.reportedTotal;
  const consistent = complete && expectedTotal !== null && check.isValid;
  const difference = expectedTotal === null ? null : check.difference;

  let state: MatchStatsState = "pending";
  if (complete && expectedTotal === null) {
    state = "submitted";
  } else if (complete && consistent) {
    state = "validated";
  } else if (complete) {
    state = "inconsistent";
  }

  return {
    state,
    canScore: complete && (consistent || input.acknowledged),
    complete,
    consistent,
    acknowledged: input.acknowledged,
    pendingPlayerIds,
    submittedPlayerIds,
    expectedTotal,
    reportedTotal,
    difference,
  };
}

export function participantStatsState(
  playerId: number,
  submittedPlayerIds: number[],
): ParticipantStatsState {
  return submittedPlayerIds.includes(playerId) ? "submitted" : "pending";
}
