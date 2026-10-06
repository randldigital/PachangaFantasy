export type MatchTeamSide = "A" | "B";

/** Team A = red, Team B = blue — display only; API still uses A/B. */
export function teamSideTextClass(side: MatchTeamSide | "none" | null | undefined): string {
  if (side === "A") {
    return "text-red-400";
  }
  if (side === "B") {
    return "text-sky-400";
  }
  return "text-slate-400";
}

export function teamSideLabelKey(side: MatchTeamSide): "match.teamA" | "match.teamB" {
  return side === "A" ? "match.teamA" : "match.teamB";
}

export function teamSideShortKey(side: MatchTeamSide): "match.teamAShort" | "match.teamBShort" {
  return side === "A" ? "match.teamAShort" : "match.teamBShort";
}

export function teamSideGoalsKey(side: MatchTeamSide): "match.teamAGoals" | "match.teamBGoals" {
  return side === "A" ? "match.teamAGoals" : "match.teamBGoals";
}
