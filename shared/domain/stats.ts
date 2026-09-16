import { normalizeMatchStatus } from "./matchLifecycle";

export type ParticipantStatsState = "pending" | "submitted";
export type MatchStatsState = "pending" | "submitted" | "inconsistent" | "validated";

export function isStatsEditable(status: string | null | undefined): boolean {
  return normalizeMatchStatus(status) === "completed";
}

export function pickStatsMatch<T extends { status: string | null }>(matches: T[]): T | undefined {
  return (
    matches.find((match) => normalizeMatchStatus(match.status) === "completed") ??
    matches.find((match) => normalizeMatchStatus(match.status) === "scored") ??
    matches.find((match) => normalizeMatchStatus(match.status) === "closed")
  );
}

export type StatsSideInput = {
  key: string;
  playerIds: number[];
  teamGoals: number | null;
};

export type StatsStatusInput = {
  participantPlayerIds: number[];
  reports: { playerId: number; goals?: number | null; assists?: number | null }[];
  sides?: StatsSideInput[];
  expectedGoals?: number | null;
  acknowledged?: boolean;
  /**
   * Club matches compare participant goals against "our goals" as an administrator
   * warning only, so a mismatch must not withhold scoring.
   */
  consistencyIsWarning?: boolean;
};

export type StatsSideStatus = {
  key: string;
  expectedGoals: number | null;
  reportedGoals: number;
  reportedAssists: number;
  goalsOk: boolean;
  assistsOk: boolean;
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
  reportedAssists: number;
  assistsOk: boolean;
  goalsOk: boolean;
  difference: number | null;
  sides: StatsSideStatus[];
};

function sideStatus(
  side: StatsSideInput,
  reportsByPlayer: Map<number, { playerId: number; goals?: number | null; assists?: number | null }>,
): StatsSideStatus {
  const reportedGoals = side.playerIds.reduce(
    (sum, id) => sum + (reportsByPlayer.get(id)?.goals || 0),
    0,
  );
  const reportedAssists = side.playerIds.reduce(
    (sum, id) => sum + (reportsByPlayer.get(id)?.assists || 0),
    0,
  );
  const cap = side.teamGoals;
  return {
    key: side.key,
    expectedGoals: cap,
    reportedGoals,
    reportedAssists,
    goalsOk: cap === null ? false : reportedGoals <= cap,
    assistsOk: cap === null ? false : reportedAssists <= cap,
  };
}

export function statsSubmissionState(input: StatsStatusInput): StatsStatus {
  const participantSet = new Set(input.participantPlayerIds);
  const reportsByPlayer = new Map<number, { playerId: number; goals?: number | null; assists?: number | null }>();
  for (const report of input.reports) {
    if (participantSet.has(report.playerId)) {
      reportsByPlayer.set(report.playerId, report);
    }
  }

  const submittedPlayerIds = input.participantPlayerIds.filter((id) => reportsByPlayer.has(id));
  const pendingPlayerIds = input.participantPlayerIds.filter((id) => !reportsByPlayer.has(id));
  const complete = input.participantPlayerIds.length > 0 && pendingPlayerIds.length === 0;

  const sidesInput =
    input.sides && input.sides.length > 0
      ? input.sides
      : [
          {
            key: "match",
            playerIds: input.participantPlayerIds,
            teamGoals: input.expectedGoals ?? null,
          },
        ];
  const sides = sidesInput.map((side) => sideStatus(side, reportsByPlayer));

  const reportedTotal = submittedPlayerIds.reduce(
    (sum, id) => sum + (reportsByPlayer.get(id)?.goals || 0),
    0,
  );
  const reportedAssists = submittedPlayerIds.reduce(
    (sum, id) => sum + (reportsByPlayer.get(id)?.assists || 0),
    0,
  );
  const expectedParts = sides.map((side) => side.expectedGoals);
  const expectedTotal = expectedParts.every((value) => value !== null)
    ? expectedParts.reduce((sum, value) => sum + (value ?? 0), 0)
    : null;
  const goalsOk = sides.every((side) => side.goalsOk);
  const assistsOk = sides.every((side) => side.assistsOk);
  const consistent = complete && goalsOk && assistsOk;
  const difference = expectedTotal === null ? null : reportedTotal - expectedTotal;

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
    canScore: input.consistencyIsWarning ? complete : complete && goalsOk && assistsOk,
    complete,
    consistent,
    acknowledged: Boolean(input.acknowledged),
    pendingPlayerIds,
    submittedPlayerIds,
    expectedTotal,
    reportedTotal,
    reportedAssists,
    assistsOk,
    goalsOk,
    difference,
    sides,
  };
}

/** True when already-submitted reports go over a side's new score (incomplete submissions still count). */
export function submittedStatsExceedResult(input: {
  reports: { playerId: number; goals?: number | null; assists?: number | null }[];
  sides: { key?: string; playerIds: number[]; teamGoals: number }[];
}): boolean {
  const playerIds = [...new Set(input.sides.flatMap((side) => side.playerIds))];
  const status = statsSubmissionState({
    participantPlayerIds: playerIds,
    reports: input.reports,
    sides: input.sides.map((side, index) => ({
      key: side.key ?? `side-${index}`,
      playerIds: side.playerIds,
      teamGoals: side.teamGoals,
    })),
  });
  return !status.goalsOk || !status.assistsOk;
}

export function participantStatsState(
  playerId: number,
  submittedPlayerIds: number[],
): ParticipantStatsState {
  return submittedPlayerIds.includes(playerId) ? "submitted" : "pending";
}
