import { normalizeMatchStatus } from "./matchLifecycle";

export type HubTab = "lineup" | "clasificacion" | "historial" | "tierlist" | "stats";

export type PrimaryActionId =
  | "add_myself"
  | "add_players"
  | "open_valuation"
  | "submit_valuation"
  | "wait_for_valuation"
  | "create_match"
  | "join_match"
  | "build_lineup"
  | "assign_teams"
  | "start_match"
  | "wait_for_start"
  | "end_match"
  | "wait_for_end"
  | "submit_stats"
  | "score_match"
  | "wait_for_stats"
  | "wait_for_match"
  | "view_leaderboard";

export type PrimaryActionInput = {
  isAdmin: boolean;
  leagueStatus: string | null;
  playerCount: number;
  userIsPlayer: boolean;
  activeMatchStatus?: string | null;
  userJoinedActiveMatch: boolean;
  hasSavedLineup: boolean;
  teamsAssigned: boolean;
  statsMatchStatus?: string | null;
  userPlayedStatsMatch: boolean;
  userSubmittedStats: boolean;
  statsCanScore: boolean;
};

export type PrimaryAction = {
  id: PrimaryActionId;
  tab: HubTab;
};

export function nextPrimaryAction(input: PrimaryActionInput): PrimaryAction {
  if (!input.userIsPlayer) {
    return { id: "add_myself", tab: "tierlist" };
  }

  if (input.isAdmin && input.playerCount === 0) {
    return { id: "add_players", tab: "tierlist" };
  }

  if (input.leagueStatus === "open") {
    if (input.isAdmin) {
      return { id: "open_valuation", tab: "tierlist" };
    }
    return { id: "wait_for_valuation", tab: "tierlist" };
  }

  if (input.leagueStatus === "voting") {
    return { id: "submit_valuation", tab: "tierlist" };
  }

  const active = input.activeMatchStatus
    ? normalizeMatchStatus(input.activeMatchStatus)
    : null;

  if (active === "open") {
    if (!input.userJoinedActiveMatch) {
      return { id: "join_match", tab: "lineup" };
    }
    if (!input.hasSavedLineup) {
      return { id: "build_lineup", tab: "lineup" };
    }
    if (input.isAdmin && !input.teamsAssigned) {
      return { id: "assign_teams", tab: "lineup" };
    }
    if (input.isAdmin) {
      return { id: "start_match", tab: "lineup" };
    }
    return { id: "wait_for_start", tab: "lineup" };
  }

  if (active === "started") {
    if (input.isAdmin) {
      return { id: "end_match", tab: "lineup" };
    }
    return { id: "wait_for_end", tab: "lineup" };
  }

  const stats = input.statsMatchStatus
    ? normalizeMatchStatus(input.statsMatchStatus)
    : null;

  if (stats === "completed") {
    if (input.userPlayedStatsMatch && !input.userSubmittedStats) {
      return { id: "submit_stats", tab: "stats" };
    }
    if (input.isAdmin) {
      return { id: "score_match", tab: "stats" };
    }
    return { id: "wait_for_stats", tab: "stats" };
  }

  if (!active) {
    if (input.isAdmin) {
      return { id: "create_match", tab: "lineup" };
    }
    if (stats === "scored") {
      return { id: "view_leaderboard", tab: "clasificacion" };
    }
    return { id: "wait_for_match", tab: "lineup" };
  }

  return { id: "view_leaderboard", tab: "clasificacion" };
}
