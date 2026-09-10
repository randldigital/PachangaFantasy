export const queryKeys = {
  me: ["/api/auth/me"] as const,
  leagues: ["/api/leagues"] as const,
  league: (id: number) => [`/api/leagues/${id}`] as const,
  leagueMatches: (leagueId: number) => [`/api/leagues/${leagueId}/matches`] as const,
  leaguePlayers: (leagueId: number) => [`/api/players/${leagueId}`] as const,
  // Season is part of the key; invalidate with the prefix helpers below to hit every season.
  leagueRankings: (leagueId: number, season?: string) =>
    [`/api/leagues/${leagueId}/rankings`, season ?? "all"] as const,
  leagueRankingsPrefix: (leagueId: number) => [`/api/leagues/${leagueId}/rankings`] as const,
  leagueManagerRankingsPrefix: (leagueId: number) =>
    [`/api/leagues/${leagueId}/manager-rankings`] as const,
  tierList: (leagueId: number) => [`/api/tierlist/${leagueId}`] as const,
  tierListsAll: (leagueId: number) => [`/api/tierlist/${leagueId}/all`] as const,
  match: (id: number) => [`/api/matches/${id}`] as const,
  matchParticipants: (id: number) => [`/api/matches/${id}/participants`] as const,
  matchLineup: (id: number) => [`/api/matches/${id}/lineup`] as const,
  matchStats: (id: number) => [`/api/matches/${id}/stats`] as const,
  matchStatsStatus: (id: number) => [`/api/matches/${id}/stats-status`] as const,
  matchRatings: (id: number) => [`/api/matches/${id}/ratings`] as const,
  matchRecap: (id: number) => [`/api/matches/${id}/recap`] as const,
  leagueManagerRankings: (leagueId: number, season?: string) =>
    [`/api/leagues/${leagueId}/manager-rankings`, season ?? "all"] as const,
  userPlayerStatus: (leagueId: number) => ["userPlayerStatus", leagueId] as const,
  leagueSeasons: (leagueId: number) => [`/api/leagues/${leagueId}/seasons`] as const,
  leagueClaimRequests: (leagueId: number) => [`/api/leagues/${leagueId}/claim-requests`] as const,
  clubs: ["/api/clubs"] as const,
  club: (id: number) => [`/api/clubs/${id}`] as const,
  clubPlayers: (clubId: number) => [`/api/clubs/${clubId}/players`] as const,
  clubMatches: (clubId: number) => [`/api/clubs/${clubId}/matches`] as const,
  clubRankings: (clubId: number, season?: string) =>
    [`/api/clubs/${clubId}/rankings`, season ?? "all"] as const,
  clubRankingsPrefix: (clubId: number) => [`/api/clubs/${clubId}/rankings`] as const,
  clubSeasons: (clubId: number) => [`/api/clubs/${clubId}/seasons`] as const,
  clubClaimRequests: (clubId: number) => [`/api/clubs/${clubId}/claim-requests`] as const,
};
