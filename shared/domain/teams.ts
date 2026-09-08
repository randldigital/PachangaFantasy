export type TeamRuleCode =
  | "TEAMS_REQUIRED"
  | "TEAMS_EMPTY"
  | "TEAMS_OVERLAP"
  | "TEAMS_NOT_PARTITION";

export interface TeamViolation {
  code: TeamRuleCode;
  message: string;
}

export type MatchTeams = {
  teamA: number[];
  teamB: number[];
};

export function validateMatchTeams(input: {
  participantIds: number[];
  teamA: number[] | null | undefined;
  teamB: number[] | null | undefined;
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

  return violations;
}

export function teamsAreComplete(
  teams: MatchTeams | null | undefined,
  participantIds: number[],
): boolean {
  return (
    validateMatchTeams({
      participantIds,
      teamA: teams?.teamA,
      teamB: teams?.teamB,
    }).length === 0
  );
}

export function matchGoalTotal(teamAGoals: number | null | undefined, teamBGoals: number | null | undefined): number | null {
  if (teamAGoals == null || teamBGoals == null) {
    return null;
  }
  return teamAGoals + teamBGoals;
}
