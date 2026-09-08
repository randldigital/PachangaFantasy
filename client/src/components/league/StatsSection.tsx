import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import SubmitMyStats from "./SubmitMyStats";
import MatchRatings from "./MatchRatings";
import AdminStatsOverview, { type ParticipantDetail } from "./AdminStatsOverview";
import type { StatsStatus } from "@shared/domain/stats";
import type { League, Match, Player, StatReport, User } from "@shared/schema";

interface StatsSectionProps {
  match?: Match;
  league: League;
  players: Player[];
  user?: User;
  onGoToMatch?: () => void;
}

interface StatsStatusResponse {
  reports: StatReport[];
  status: StatsStatus;
}

export default function StatsSection({ match, league, players, user, onGoToMatch }: StatsSectionProps) {
  const { t } = useTranslation();
  const isAdmin = Boolean(user && league.createdBy === user.id);

  const { data: participants = [] } = useQuery<ParticipantDetail[]>({
    queryKey: queryKeys.matchParticipants(match?.id || 0),
    queryFn: () => api.get<ParticipantDetail[]>(`/api/matches/${match!.id}/participants`),
    enabled: Boolean(match?.id),
  });

  const { data: payload } = useQuery<StatsStatusResponse>({
    queryKey: queryKeys.matchStatsStatus(match?.id || 0),
    queryFn: () => api.get<StatsStatusResponse>(`/api/matches/${match!.id}/stats-status`),
    enabled: Boolean(match?.id),
  });

  if (!match) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{t("league.tabs.stats")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 mb-4">{t("stats.noMatch")}</p>
          {onGoToMatch && (
            <Button onClick={onGoToMatch} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {t("stats.noMatchCta")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const reports = payload?.reports ?? [];
  const status = payload?.status;
  const ownPlayer = players.find((player) => player.userId === user?.id);
  const ownParticipant = participants.find(
    (participant) => participant.playerId === ownPlayer?.id && participant.status === "accepted",
  );
  const ownReport = reports.find((report) => report.playerId === ownPlayer?.id);

  return (
    <div className="space-y-4">
      {status && (
        <div className="flex items-center justify-between">
          <p className="text-slate-300 text-sm">{t("stats.matchState")}</p>
          <Badge className="bg-slate-700 text-white">{t(`stats.states.${status.state}`)}</Badge>
        </div>
      )}

      {ownParticipant && ownPlayer && (
        <SubmitMyStats
          match={match}
          playerId={ownPlayer.id}
          existing={ownReport}
        />
      )}

      <MatchRatings match={match} participants={participants} />

      {!ownParticipant && !isAdmin && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-slate-400 text-sm">
            {t("stats.notParticipant")}
          </CardContent>
        </Card>
      )}

      {isAdmin && status && (
        <AdminStatsOverview
          match={match}
          isLeagueCreator={isAdmin}
          players={players}
          participants={participants}
          reports={reports}
          status={status}
        />
      )}
    </div>
  );
}
