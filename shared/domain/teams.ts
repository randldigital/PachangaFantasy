export type TeamRuleCode =
  | "TEAMS_REQUIRED"
  | "TEAMS_EMPTY"
  | "TEAMS_OVERLAP"
  | "TEAMS_NOT_PARTITION"
  | "SIDE_OVER_CAPACITY"
  | "SIDE_INCOMPLETE";

export interface TeamViolation {
  code: TeamRuleCode;
  message: string;
}

export type MatchTeams = {
  teamA: number[];
  teamB: number[];
};

/** Real-world Fantasy Match formats. Chosen at creation and never changed afterwards. */
export const SIDE_SIZES = [5, 7, 11] as const;
export type SideSize = (typeof SIDE_SIZES)[number];
export const DEFAULT_SIDE_SIZE: SideSize = 5;

export function isSideSize(value: unknown): value is SideSize {
  return SIDE_SIZES.includes(value as SideSize);
}

/** Old Matches predate `sideSize` and behave as 5v5. */
export function sideSizeOf(match: { sideSize?: number | null } | null | undefined): SideSize {
  const value = match?.sideSize;
  return isSideSize(value) ? value : DEFAULT_SIDE_SIZE;
}

export function matchCapacity(sideSize: SideSize): number {
  return sideSize * 2;
}

export function validateMatchTeams(input: {
  participantIds: number[];
  teamA: number[] | null | undefined;
  teamB: number[] | null | undefined;
  sideSize?: SideSize;
  /** Start also demands each side be exactly `sideSize`; saving only caps the maximum. */
  requireFullSides?: boolean;
}): TeamViolation[] {
  const teamA = input.teamA ?? [];
  const teamB = input.teamB ?? [];
  const violations: TeamViolation[] = [];

  if (teamA.length === 0 || teamB.length === 0) {
    violations.push({
      code: teamA.length === 0 && teamB.length === 0 ? "TEAMS_REQUIRED" : "TEAMS_EMPTY",
      message: "The administrator must put every participant into two non-empty teams",
    });
    return violations;
  }

  const combined = [...teamA, ...teamB];
  if (new Set(combined).size !== combined.length) {
    violations.push({
      code: "TEAMS_OVERLAP",
      message: "A player cannot be on both teams",
    });
  }

  const participantSet = new Set(input.participantIds);
  const teamSet = new Set(combined);
  const sameSize = teamSet.size === participantSet.size;
  const allParticipantsPlaced = input.participantIds.every((id) => teamSet.has(id));
  const noExtras = combined.every((id) => participantSet.has(id));
  if (!sameSize || !allParticipantsPlaced || !noExtras) {
    violations.push({
      code: "TEAMS_NOT_PARTITION",
      message: "Every participant must be on exactly one team",
    });
  }

  const sideSize = input.sideSize;
  if (sideSize != null) {
    if (teamA.length > sideSize || teamB.length > sideSize) {
      violations.push({
        code: "SIDE_OVER_CAPACITY",
        message: `A side cannot hold more than ${sideSize} players in a ${sideSize} vs ${sideSize} match`,
      });
    } else if (input.requireFullSides && (teamA.length !== sideSize || teamB.length !== sideSize)) {
      violations.push({
        code: "SIDE_INCOMPLETE",
        message: `Both sides need exactly ${sideSize} players before the match can start`,
      });
    }
  }

  return violations;
}

export function teamsAreComplete(
  teams: MatchTeams | null | undefined,
  participantIds: number[],
  sideSize?: SideSize,
): boolean {
  return (
    validateMatchTeams({
      participantIds,
      teamA: teams?.teamA,
      teamB: teams?.teamB,
      sideSize,
      requireFullSides: sideSize != null,
    }).length === 0
  );
}

export function matchGoalTotal(teamAGoals: number | null | undefined, teamBGoals: number | null | undefined): number | null {
  if (teamAGoals == null || teamBGoals == null) {
    return null;
  }
  return teamAGoals + teamBGoals;
}
