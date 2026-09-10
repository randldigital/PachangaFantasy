import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Users, Plus, UserPlus, Eye, Loader2, Settings, Play } from "lucide-react";
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
  normalizeMatchStatus,
} from "@shared/domain/matchLifecycle";
import { matchCapacity, sideSizeOf, teamsAreComplete } from "@shared/domain/teams";
import type { Match, League, User, Player } from "@shared/schema";

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
  const acceptedParticipants = participants.filter(p => p.status === 'accepted');
  const joiningOpen = isJoinableStatus(match?.status);
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
                {user?.id === league.createdBy && (
                  <MatchAdminActions
                    match={match}
                    leagueId={league.id}
                    joiningOpen={joiningOpen}
                    teamsReady={teamsReady}
                    startPending={startMatchMutation.isPending}
                    onAddPlayers={() => setShowAddPlayers(true)}
                    onStartOrSetTeams={() =>
                      teamsReady
                        ? startMatchMutation.mutate(match.id)
                        : setShowMatchDetails(true)
                    }
                    onMatchDeleted={onMatchAction}
                  />
                )}
                {userHasJoined ? (
                  <Button
                    onClick={() => setShowMatchDetails(true)}
                    size="sm"
                    variant="outline"
                    className={`border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white ${actionButtonClass}`}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t('match.view')}
                  </Button>
                ) : (
                  !isFinishedStatus(match.status) && (
                    <Button
                      onClick={handleJoinMatch}
                      disabled={joinMatchMutation.isPending || !joiningOpen}
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
                        : joiningOpen 
                          ? t('match.join')
                          : t('match.joiningLocked')
                      }
                    </Button>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showMatchDetails} onOpenChange={setShowMatchDetails}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                {t('match.details')} - {formatDate(match.date)}
              </DialogTitle>
            </DialogHeader>
            <TeamAssignmentPreview 
              match={match} 
              user={user}
              players={players}
              league={league}
            />
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
  joiningOpen: boolean;
  teamsReady: boolean;
  startPending: boolean;
  onAddPlayers: () => void;
  onStartOrSetTeams: () => void;
  onMatchDeleted?: () => void;
}

function MatchAdminActions({
  match,
  leagueId,
  joiningOpen,
  teamsReady,
  startPending,
  onAddPlayers,
  onStartOrSetTeams,
  onMatchDeleted,
}: MatchAdminActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      {joiningOpen && (
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
      {canStartMatch(match.status) && (
        <Button
          onClick={onStartOrSetTeams}
          disabled={startPending}
          size="sm"
          className={`bg-blue-600 hover:bg-blue-700 text-white ${actionButtonClass}`}
        >
          <Play className="w-4 h-4 mr-2" />
          {teamsReady ? t("match.startMatch") : t("match.setTeams")}
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