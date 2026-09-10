import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import type { Match } from "@shared/schema";

/** Invalidate the match itself and the League or Club lists that display it. */
export async function invalidateMatchQueries(queryClient: QueryClient, match: Match) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.match(match.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matchStats(match.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matchStatsStatus(match.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matchRatings(match.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matchParticipants(match.id) }),
  ];

  if (match.clubId != null) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.clubMatches(match.clubId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.club(match.clubId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.clubRankingsPrefix(match.clubId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.clubAggregates(match.clubId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.clubPlayers(match.clubId) }),
    );
  } else if (match.leagueId != null) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(match.leagueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.leaguePlayers(match.leagueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.leagueRankingsPrefix(match.leagueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.leagueManagerRankingsPrefix(match.leagueId) }),
    );
  }

  await Promise.all(tasks);
}

export function isClubMatch(match: { clubId?: number | null }): boolean {
  return match.clubId != null;
}

export function isRatingsPhase(status: string | null | undefined): boolean {
  return status === "completed" || status === "scored" || status === "closed";
}
