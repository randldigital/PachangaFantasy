import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { nextPrimaryAction, type HubTab, type PrimaryActionId } from "@shared/domain/primaryAction";
import { pickActiveMatch } from "@shared/domain/matchLifecycle";
import { pickStatsMatch } from "@shared/domain/stats";
import { teamsAreComplete } from "@shared/domain/teams";
import type { League, Lineup, Match, Player, StatReport, User } from "@shared/schema";

interface Participant {
  playerId: number;
  status: string;
  userId?: number | null;
}

interface StatsStatusResponse {
  reports: StatReport[];
  status: { canScore: boolean };
}

interface PrimaryActionBannerProps {
  league: League;
  matches: Match[];
  players: Player[];
  user?: User;
  onTabChange: (tab: HubTab) => void;
  onOpenAddPlayer: () => void;
  onOpenCreateMatch: () => void;
  onOpenMatchDetails?: () => void;
}

export default function PrimaryActionBanner({
  league,
  matches,
  players,
  user,
  onTabChange,
  onOpenAddPlayer,
  onOpenCreateMatch,
  onOpenMatchDetails,
}: PrimaryActionBannerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = Boolean(user && league.createdBy === user.id);
  const activeMatch = pickActiveMatch(matches);
  const statsMatch = pickStatsMatch(matches);
  const ownPlayer = players.find((player) => player.userId === user?.id);

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: queryKeys.matchParticipants(activeMatch?.id || 0),
    queryFn: () => api.get<Participant[]>(`/api/matches/${activeMatch!.id}/participants`),
    enabled: Boolean(activeMatch?.id),
  });

  const { data: lineup } = useQuery<Lineup | null>({
    queryKey: queryKeys.matchLineup(activeMatch?.id || 0),
    queryFn: () => api.get<Lineup | null>(`/api/matches/${activeMatch!.id}/lineup`),
    enabled: Boolean(activeMatch?.id),
  });

  const { data: statsParticipants = [] } = useQuery<Participant[]>({
    queryKey: queryKeys.matchParticipants(statsMatch?.id || 0),
    queryFn: () => api.get<Participant[]>(`/api/matches/${statsMatch!.id}/participants`),
    enabled: Boolean(statsMatch?.id && statsMatch?.id !== activeMatch?.id),
  });

  const { data: statsPayload } = useQuery<StatsStatusResponse>({
    queryKey: queryKeys.matchStatsStatus(statsMatch?.id || 0),
    queryFn: () => api.get<StatsStatusResponse>(`/api/matches/${statsMatch!.id}/stats-status`),
    enabled: Boolean(statsMatch?.id),
  });

  const statsPeople = statsMatch?.id === activeMatch?.id ? participants : statsParticipants;
  const playedStatsMatch = Boolean(
    ownPlayer &&
      statsPeople.some(
        (participant) => participant.playerId === ownPlayer.id && participant.status === "accepted",
      ),
  );

  const action = nextPrimaryAction({
    isAdmin,
    leagueStatus: league.status,
    playerCount: players.length,
    userIsPlayer: Boolean(ownPlayer),
    activeMatchStatus: activeMatch?.status,
    userJoinedActiveMatch: participants.some(
      (participant) => participant.userId === user?.id && participant.status === "accepted",
    ),
    hasSavedLineup: Boolean(lineup?.playerIds?.length),
    teamsAssigned: teamsAreComplete(
      activeMatch?.matchTeams,
      participants
        .filter((participant) => participant.status === "accepted")
        .map((participant) => participant.playerId),
    ),
    statsMatchStatus: statsMatch?.status,
    userPlayedStatsMatch: playedStatsMatch,
    userSubmittedStats: Boolean(
      ownPlayer && statsPayload?.reports.some((report) => report.playerId === ownPlayer.id),
    ),
    statsCanScore: Boolean(statsPayload?.status.canScore),
  });

  const joinMutation = useMutation({
    mutationFn: () => api.post(`/api/matches/${activeMatch!.id}/join`, {}),
    onSuccess: () => {
      toast({ title: t("match.joined"), description: t("match.joinedDescription") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(league.id) });
      if (activeMatch) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.matchParticipants(activeMatch.id) });
      }
      onTabChange("lineup");
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: describeApiError(error, t), variant: "destructive" });
    },
  });

  const addMyselfMutation = useMutation({
    mutationFn: () => api.post(`/api/leagues/${league.id}/add-me-as-player`),
    onSuccess: () => {
      toast({ title: t("league.playerAdded"), description: t("nextAction.add_myself.title") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.leaguePlayers(league.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.league(league.id) });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: describeApiError(error, t), variant: "destructive" });
    },
  });

  const pending = joinMutation.isPending || addMyselfMutation.isPending;

  const handleClick = (id: PrimaryActionId) => {
    switch (id) {
      case "add_players":
        onOpenAddPlayer();
        onTabChange("tierlist");
        return;
      case "add_myself":
        addMyselfMutation.mutate();
        return;
      case "join_match":
        if (activeMatch) joinMutation.mutate();
        return;
      case "create_match":
        onOpenCreateMatch();
        onTabChange("lineup");
        return;
      case "assign_teams":
      case "start_match":
      case "end_match":
        onOpenMatchDetails?.();
        onTabChange("lineup");
        return;
      default:
        onTabChange(action.tab);
    }
  };

  return (
    <Card className="mx-4 mt-4 border-emerald-500/40 bg-slate-800">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
            {t("nextAction.label")}
          </p>
          <h2 className="text-white font-semibold text-lg">{t(`nextAction.${action.id}.title`)}</h2>
          <p className="text-slate-400 text-sm">{t(`nextAction.${action.id}.description`)}</p>
        </div>
        <Button
          onClick={() => handleClick(action.id)}
          disabled={pending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          {t(`nextAction.${action.id}.cta`)}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
