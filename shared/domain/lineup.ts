export interface PricedPlayer {
  id: number;
  marketValue?: number | null;
}

export const LINEUP_SIZE = 5;

export type LineupRuleCode =
  | "LINEUP_SIZE"
  | "LINEUP_UNIQUE"
  | "LINEUP_CAPTAIN_REQUIRED"
  | "LINEUP_CAPTAIN_NOT_IN_LINEUP"
  | "LINEUP_NOT_PARTICIPANT"
  | "LINEUP_OVER_BUDGET"
  | "LINEUP_LOCKED";

export interface LineupViolation {
  code: LineupRuleCode;
  message: string;
}

export function lineupTotalCost(
  playerIds: number[],
  players: PricedPlayer[],
): number {
  return playerIds.reduce((total, playerId) => {
    const player = players.find((item) => item.id === playerId);
    return total + (player?.marketValue || 0);
  }, 0);
}

export function validateLineup(input: {
  playerIds: number[];
  captainId: number | null;
  budget: number;
  players: PricedPlayer[];
  participantIds: number[];
  matchStatus?: string | null;
}): LineupViolation[] {
  const violations: LineupViolation[] = [];

  if (input.matchStatus && input.matchStatus !== "open") {
    violations.push({
      code: "LINEUP_LOCKED",
      message: "Lineups lock when the match starts",
    });
  }

  if (input.playerIds.length !== LINEUP_SIZE) {
    violations.push({
      code: "LINEUP_SIZE",
      message: `A lineup must contain exactly ${LINEUP_SIZE} players`,
    });
  }

  if (new Set(input.playerIds).size !== input.playerIds.length) {
    violations.push({
      code: "LINEUP_UNIQUE",
      message: "Every selected player must be unique",
    });
  }

  if (input.captainId === null) {
    violations.push({
      code: "LINEUP_CAPTAIN_REQUIRED",
      message: "A lineup must have a captain",
    });
  } else if (!input.playerIds.includes(input.captainId)) {
    violations.push({
      code: "LINEUP_CAPTAIN_NOT_IN_LINEUP",
      message: "The captain must be one of the selected players",
    });
  }

  const participantSet = new Set(input.participantIds);
  if (input.playerIds.some((playerId) => !participantSet.has(playerId))) {
    violations.push({
      code: "LINEUP_NOT_PARTICIPANT",
      message: "Every selected player must be a participant in this match",
    });
  }

  if (lineupTotalCost(input.playerIds, input.players) > input.budget) {
    violations.push({
      code: "LINEUP_OVER_BUDGET",
      message: "Total lineup cost exceeds the match budget",
    });
  }

  return violations;
}

export function lineupCanSave(input: {
  playerIds: number[];
  captainId: number | null;
  budget: number;
  players: PricedPlayer[];
  participantIds?: number[];
  matchStatus?: string | null;
}): boolean {
  return (
    validateLineup({
      ...input,
      participantIds: input.participantIds ?? input.playerIds,
    }).length === 0
  );
}

/** Structural checks at scoring time. Skip lock (match is finished) and budget (already enforced at save). */
export function scoringLineupViolations(input: {
  playerIds: number[];
  captainId: number | null;
  participantIds: number[];
}): LineupViolation[] {
  return validateLineup({
    playerIds: input.playerIds,
    captainId: input.captainId,
    budget: Number.MAX_SAFE_INTEGER,
    players: [],
    participantIds: input.participantIds,
  }).filter((violation) => violation.code !== "LINEUP_OVER_BUDGET" && violation.code !== "LINEUP_LOCKED");
}
