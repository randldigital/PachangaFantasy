import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Settings, UserMinus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import AddPlayersToMatchModal from "./AddPlayersToMatchModal";
import { isJoinableStatus } from "@shared/domain/matchLifecycle";
import { formatDisplayMarketValue } from "@shared/domain/displayValue";
import {
  recommendMatchTeams,
  sideSizeOf,
  teamsAreComplete,
  type MatchTeams,
} from "@shared/domain/teams";
import type { Match, User, Player } from "@shared/schema";
import { requireLeagueId } from "@shared/domain/context";

interface ParticipantWithUser {
  matchId: number;
  playerId: number;
  status: string;
  playerName: string;
  userId?: number;
  username?: string;
}

interface TeamAssignmentPreviewProps {
  match: Match;
  user?: User;
  players?: Player[];
  league?: { createdBy: number };
}

function initials(name: string) {
  return name.substring(0, 2).toUpperCase();
}

export default function TeamAssignmentPreview({
  match,
  user,
  players = [],
  league,
}: TeamAssignmentPreviewProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [teamA, setTeamA] = useState<number[]>(match.matchTeams?.teamA ?? []);
  const [teamB, setTeamB] = useState<number[]>(match.matchTeams?.teamB ?? []);

  const { data: participants = [], isLoading } = useQuery<ParticipantWithUser[]>({
    queryKey: queryKeys.matchParticipants(match.id),
    queryFn: () => api.get<ParticipantWithUser[]>(`/api/matches/${match.id}/participants`),
  });

  const accepted = participants.filter((participant) => participant.status === "accepted");
  const acceptedIds = accepted.map((participant) => participant.playerId);
  const acceptedKey = acceptedIds.join(",");
  const canEdit = Boolean(user && league && user.id === league.createdBy && isJoinableStatus(match.status));
  const sideSize = sideSizeOf(match);
  const complete = teamsAreComplete({ teamA, teamB }, acceptedIds, sideSize);
  const valueOf = (playerId: number) => players.find((player) => player.id === playerId)?.marketValue ?? 0;
  const sumA = teamA.reduce((total, playerId) => total + valueOf(playerId), 0);
  const sumB = teamB.reduce((total, playerId) => total + valueOf(playerId), 0);

  useEffect(() => {
    const allowed = new Set(acceptedIds);
    const fromMatchA = (match.matchTeams?.teamA ?? []).filter((id) => allowed.has(id));
    const fromMatchB = (match.matchTeams?.teamB ?? []).filter((id) => allowed.has(id));
    setTeamA(fromMatchA);
    setTeamB(fromMatchB);
    // acceptedKey tracks roster membership without resetting on local A/B moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, match.matchTeams?.teamA, match.matchTeams?.teamB, acceptedKey]);

  const invalidateMatch = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.match(match.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(requireLeagueId(match)) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.matchParticipants(match.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.matchLineup(match.id) }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (teams: MatchTeams) => api.post(`/api/matches/${match.id}/teams`, teams),
    onSuccess: async () => {
      toast({ title: t("match.teamsSaved") });
      await invalidateMatch();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (playerId: number) => api.delete(`/api/matches/${match.id}/participants/${playerId}`),
    onSuccess: async () => {
      toast({ title: t("match.participantRemoved") });
      await invalidateMatch();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const moveTo = (playerId: number, side: "A" | "B" | "none") => {
    const target = side === "A" ? teamA : side === "B" ? teamB : [];
    if (side !== "none" && !target.includes(playerId) && target.length >= sideSize) {
      toast({
        title: t("common.error"),
        description: t("match.sideFull", { size: sideSize }),
        variant: "destructive",
      });
      return;
    }
    setTeamA((current) => current.filter((id) => id !== playerId));
    setTeamB((current) => current.filter((id) => id !== playerId));
    if (side === "A") setTeamA((current) => [...current, playerId]);
    if (side === "B") setTeamB((current) => [...current, playerId]);
  };

  const applyRecommend = () => {
    const marketValue = Object.fromEntries(players.map((player) => [player.id, player.marketValue ?? 0]));
    const recommended = recommendMatchTeams({
      participantIds: acceptedIds,
      marketValue,
      sideSize,
    });
    setTeamA(recommended.teamA);
    setTeamB(recommended.teamB);
  };

  const unassigned = accepted.filter(
    (participant) => !teamA.includes(participant.playerId) && !teamB.includes(participant.playerId),
  );

  const renderPlayer = (participant: ParticipantWithUser, side: "A" | "B" | "none") => {
    const displayName = participant.username || participant.playerName;
    return (
      <div key={participant.playerId} className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/40">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-emerald-600 text-white text-xs">
            {initials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-emerald-400">{formatDisplayMarketValue(valueOf(participant.playerId))}</p>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            {side !== "A" && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => moveTo(participant.playerId, "A")}>
                A
              </Button>
            )}
            {side !== "B" && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => moveTo(participant.playerId, "B")}>
                B
              </Button>
            )}
            {side !== "none" && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-400" onClick={() => moveTo(participant.playerId, "none")}>
                ×
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-red-400"
              aria-label={t("match.removeParticipant")}
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate(participant.playerId)}
            >
              <UserMinus className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            <div className="h-5 w-32 bg-slate-600 animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-800/50 border-slate-700">
      <CardHeader className="shrink-0 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            {t("match.teamAssignment")}
          </CardTitle>
          {canEdit && (
            <Button
              onClick={() => setShowAddPlayers(true)}
              size="sm"
              variant="outline"
              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              {t("match.addPlayers")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
        {accepted.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t("match.noParticipants")}</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">{t("match.unassigned")} ({unassigned.length})</p>
              {unassigned.map((participant) => renderPlayer(participant, "none"))}
            </div>
            <div className="space-y-2">
              <p className="text-emerald-400 text-sm font-medium">
                {t("match.teamA")} ({teamA.length}/{sideSize}) · {formatDisplayMarketValue(sumA)}
              </p>
              {accepted.filter((participant) => teamA.includes(participant.playerId)).map((participant) => renderPlayer(participant, "A"))}
            </div>
            <div className="space-y-2">
              <p className="text-sky-400 text-sm font-medium">
                {t("match.teamB")} ({teamB.length}/{sideSize}) · {formatDisplayMarketValue(sumB)}
              </p>
              {accepted.filter((participant) => teamB.includes(participant.playerId)).map((participant) => renderPlayer(participant, "B"))}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="shrink-0 space-y-2">
            <p className="text-xs text-slate-400 text-center">{t("match.teamsEditableUntilStart")}</p>
            {accepted.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={applyRecommend}
                className="w-full border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
              >
                {t("match.recommendTeams")}
              </Button>
            )}
            <Button
              onClick={() => saveMutation.mutate({ teamA, teamB })}
              disabled={saveMutation.isPending || !complete}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saveMutation.isPending ? t("common.saving") : t("match.saveTeams")}
            </Button>
            {!complete && (
              <p className="text-xs text-amber-400 text-center">
                {t("match.teamsExactHint", { size: sideSize })}
              </p>
            )}
          </div>
        )}

        {!canEdit && complete && (
          <Badge className="bg-emerald-700 text-white">{t("match.teamsLocked")}</Badge>
        )}
      </CardContent>
      <AddPlayersToMatchModal
        isOpen={showAddPlayers}
        onClose={() => setShowAddPlayers(false)}
        match={match}
        players={players}
        participants={participants}
      />
    </Card>
  );
}
