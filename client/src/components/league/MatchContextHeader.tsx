import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Users, Plus, UserPlus, UserMinus, Eye, Loader2, Settings, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import CreateMatchForm from "@/components/league/CreateMatchForm";
import TeamAssignmentPreview from "@/components/league/TeamAssignmentPreview";
import AddPlayersToMatchModal from "@/components/league/AddPlayersToMatchModal";
import DeleteMatchButton from "@/components/league/DeleteMatchButton";
import EndMatchButton from "@/components/league/EndMatchButton";
import {
  canStartMatch,
  isFinishedStatus,
  isJoinableStatus,
  isMatchJoinOpen,
  normalizeMatchStatus,
} from "@shared/domain/matchLifecycle";
import { matchCapacity, sideSizeOf, teamsAreComplete } from "@shared/domain/teams";
import type { Match, League, User, Player } from "@shared/schema";
import MatchJoinToggle from "@/components/MatchJoinToggle";

const actionButtonClass = "w-full sm:w-auto";

interface MatchContextHeaderProps {
  match?: Match;
  league: League;
  user?: User;
  players: Player[];
  onMatchAction?: () => void;
  createMatchOpen?: boolean;
  onCreateMatchOpenChange?: (open: boolean) => void;
  matchDetailsOpen?: boolean;
  onMatchDetailsOpenChange?: (open: boolean) => void;
}

interface ParticipantWithUser {
  matchId: number;
  playerId: number;
  status: string;
  playerName: string;
  userId?: number;
  username?: string;
  userRole?: string;
}

export default function MatchContextHeader({ 
  match, 
  league, 
  user, 
  players,
  onMatchAction,
  createMatchOpen,
  onCreateMatchOpenChange,
  matchDetailsOpen,
  onMatchDetailsOpenChange,
}: MatchContextHeaderProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [internalCreateMatch, setInternalCreateMatch] = useState(false);
  const showCreateMatch = createMatchOpen ?? internalCreateMatch;
  const setShowCreateMatch = onCreateMatchOpenChange ?? setInternalCreateMatch;
  const [internalMatchDetails, setInternalMatchDetails] = useState(false);
  const showMatchDetails = matchDetailsOpen ?? internalMatchDetails;
  const setShowMatchDetails = onMatchDetailsOpenChange ?? setInternalMatchDetails;
  const [showAddPlayers, setShowAddPlayers] = useState(false);

  // Check if user has joined the match
  const { data: participants = [], isLoading: participantsLoading } = useQuery<ParticipantWithUser[]>({
    queryKey: queryKeys.matchParticipants(match?.id || 0),
    queryFn: () => api.get<ParticipantWithUser[]>(`/api/matches/${match!.id}/participants`),
    enabled: !!match
  });

  const userHasJoined = participants.some(p => p.userId === user?.id && p.status === 'accepted');
  const ownPlayerId = participants.find((participant) => participant.userId === user?.id && participant.status === "accepted")?.playerId;
  const acceptedParticipants = participants.filter(p => p.status === 'accepted');
  const statusOpen = isJoinableStatus(match?.status);
  const canSelfJoin = statusOpen && isMatchJoinOpen(match);
  const teamsReady = Boolean(
    match &&
      teamsAreComplete(
        match.matchTeams,
        acceptedParticipants.map((participant) => participant.playerId),
        sideSizeOf(match),
      ),
  );

  const joinMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      return api.post(`/api/matches/${matchId}/join`, {});
    },
    onSuccess: () => {
      toast({
        title: t('match.joined'),
        description: t('match.joinedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(league.id) });
      if (match) {
        queryClient.invalidateQueries({ queryKey: queryKeys.matchParticipants(match.id) });
      }
      onMatchAction?.();
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: describeApiError(error, t),
        variant: 'destructive',
      });
    }
  });

  const leaveMatchMutation = useMutation({
    mutationFn: async (playerId: number) => api.delete(`/api/matches/${match!.id}/participants/${playerId}`),
    onSuccess: () => {
      toast({ title: t("match.left") });
      queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(league.id) });
      if (match) {
        queryClient.invalidateQueries({ queryKey: queryKeys.matchParticipants(match.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.matchLineup(match.id) });
      }
      onMatchAction?.();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const startMatchMutation = useMutation({
    mutationFn: async (matchId: number) => api.post(`/api/matches/${matchId}/start`),
    onSuccess: async () => {
      toast({ title: t("match.started") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(league.id) });
      onMatchAction?.();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const handleJoinMatch = () => {
    if (match) {
      joinMatchMutation.mutate(match.id);
    }
  };

  const formatDate = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (match) {
    return (
      <>
        <Card className={`mx-4 my-4 overflow-hidden ${
          isFinishedStatus(match.status)
            ? 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/50' 
            : 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border-emerald-500/30'
        }`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
                <div className="flex items-center space-x-2 text-emerald-400 min-w-0">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{formatDate(match.date)}</span>
                </div>
                <div className="flex items-center space-x-2 text-emerald-400">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{formatTime(match.date)}</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`${
                    match.status === 'scored' ? 'bg-purple-600' :
                    match.status === 'completed' ? 'bg-green-600' :
                    normalizeMatchStatus(match.status) === 'started' ? 'bg-blue-600' :
                    'bg-emerald-600'
                  } text-white font-medium`}
                >
                  {t(`match.status.${normalizeMatchStatus(match.status)}`)}
                </Badge>
                <Badge variant="secondary" className="bg-slate-700 text-white font-medium">
                  {t('match.sideSizeOption', { size: sideSizeOf(match) })}
                </Badge>
                <div className="flex items-center space-x-2 text-slate-300">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">
                    {participantsLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      `${acceptedParticipants.length}/${matchCapacity(sideSizeOf(match))}`
                    )}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-stretch gap-2 w-full sm:w-auto sm:justify-end">
                {user?.id === league.createdBy && statusOpen && match && (
                  <MatchJoinToggle
                    matchId={match.id}
                    joinOpen={isMatchJoinOpen(match)}
                    leagueId={league.id}
                  />
                )}
                {user?.id === league.createdBy && (
                  <MatchAdminActions
                    match={match}
                    leagueId={league.id}
                    statusOpen={statusOpen}
                    teamsReady={teamsReady}
                    startPending={startMatchMutation.isPending}
                    onAddPlayers={() => setShowAddPlayers(true)}
                    onEditTeams={() => setShowMatchDetails(true)}
                    onStart={() => startMatchMutation.mutate(match.id)}
                    onMatchDeleted={onMatchAction}
                  />
                )}
                {userHasJoined ? (
                  <>
                    {user?.id !== league.createdBy && (
                      <Button
                        onClick={() => setShowMatchDetails(true)}
                        size="sm"
                        variant="outline"
                        className={`border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white ${actionButtonClass}`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {t('match.view')}
                      </Button>
                    )}
                    {statusOpen && ownPlayerId != null && (
                      <Button
                        onClick={() => leaveMatchMutation.mutate(ownPlayerId)}
                        disabled={leaveMatchMutation.isPending}
                        size="sm"
                        variant="outline"
                        className={`border-red-500 text-red-400 hover:bg-red-500 hover:text-white ${actionButtonClass}`}
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        {leaveMatchMutation.isPending ? t("common.loading") : t("match.leave")}
                      </Button>
                    )}
                  </>
                ) : (
                  !isFinishedStatus(match.status) && (
                    canSelfJoin ? (
                      <Button
                        onClick={handleJoinMatch}
                        disabled={joinMatchMutation.isPending}
                        size="sm"
                        className={`bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 ${actionButtonClass}`}
                      >
                        {joinMatchMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4 mr-2" />
                        )}
                        {joinMatchMutation.isPending
                          ? t('common.joining')
                          : t('match.join')
                        }
                      </Button>
                    ) : statusOpen ? null : (
                      <Button
                        disabled
                        size="sm"
                        className={`bg-emerald-600 text-white disabled:opacity-50 ${actionButtonClass}`}
                      >
                        {t('match.joiningLocked')}
                      </Button>
                    )
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showMatchDetails} onOpenChange={setShowMatchDetails}>
          <DialogContent className="flex max-w-4xl flex-col overflow-hidden bg-slate-800 border-slate-700 p-4 sm:p-6 max-sm:h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem))]">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                {t('match.details')} - {formatDate(match.date)}
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-hidden">
              <TeamAssignmentPreview
                match={match}
                user={user}
                players={players}
                league={league}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Players Modal */}
        <AddPlayersToMatchModal
          isOpen={showAddPlayers}
          onClose={() => setShowAddPlayers(false)}
          match={match}
          players={players}
          participants={participants}
        />

        <Dialog open={showCreateMatch} onOpenChange={setShowCreateMatch}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">{t("match.createMatch")}</DialogTitle>
            </DialogHeader>
            <CreateMatchForm
              leagueId={league.id}
              onSuccess={() => {
                setShowCreateMatch(false);
                onMatchAction?.();
              }}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const createMatchDialog = (
    <Dialog open={showCreateMatch} onOpenChange={setShowCreateMatch}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">{t("match.createMatch")}</DialogTitle>
        </DialogHeader>
        <CreateMatchForm
          leagueId={league.id}
          onSuccess={() => {
            setShowCreateMatch(false);
            onMatchAction?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );

  if (league.createdBy === user?.id) {
    return (
      <>
        <Card className="mx-4 my-4 overflow-hidden bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-white font-medium">{t("match.noActiveMatch")}</h3>
                <p className="text-slate-400 text-sm">{t("match.createMatchDescription")}</p>
              </div>
              <Button
                onClick={() => setShowCreateMatch(true)}
                className={`bg-emerald-600 hover:bg-emerald-700 text-white ${actionButtonClass}`}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("match.createMatch")}
              </Button>
            </div>
          </CardContent>
        </Card>
        {createMatchDialog}
      </>
    );
  }

  return (
    <>
      <Card className="mx-4 my-4 bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="text-center">
            <h3 className="text-white font-medium mb-2">{t("match.noActiveMatch")}</h3>
            <p className="text-slate-400 text-sm">{t("match.waitingForMatch")}</p>
          </div>
        </CardContent>
      </Card>
      {createMatchDialog}
    </>
  );
}

interface MatchAdminActionsProps {
  match: Match;
  leagueId: number;
  statusOpen: boolean;
  teamsReady: boolean;
  startPending: boolean;
  onAddPlayers: () => void;
  onEditTeams: () => void;
  onStart: () => void;
  onMatchDeleted?: () => void;
}

function MatchAdminActions({
  match,
  leagueId,
  statusOpen,
  teamsReady,
  startPending,
  onAddPlayers,
  onEditTeams,
  onStart,
  onMatchDeleted,
}: MatchAdminActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      {statusOpen && (
        <Button
          onClick={onAddPlayers}
          size="sm"
          variant="outline"
          className={`border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white ${actionButtonClass}`}
        >
          <Settings className="w-4 h-4 mr-2" />
          {t("match.addPlayers")}
        </Button>
      )}
      <Button
        onClick={onEditTeams}
        size="sm"
        variant="outline"
        className={`border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white ${actionButtonClass}`}
      >
        <Users className="w-4 h-4 mr-2" />
        {statusOpen
          ? teamsReady
            ? t("match.editTeams")
            : t("match.setTeams")
          : t("match.view")}
      </Button>
      {canStartMatch(match.status) && teamsReady && (
        <Button
          onClick={onStart}
          disabled={startPending}
          size="sm"
          className={`bg-blue-600 hover:bg-blue-700 text-white ${actionButtonClass}`}
        >
          <Play className="w-4 h-4 mr-2" />
          {t("match.startMatch")}
        </Button>
      )}
      <EndMatchButton
        match={match}
        leagueId={leagueId}
        isLeagueCreator={true}
        className={actionButtonClass}
      />
      <DeleteMatchButton
        match={match}
        leagueId={leagueId}
        isLeagueCreator={true}
        onMatchDeleted={onMatchDeleted}
        className={actionButtonClass}
      />
    </>
  );
}