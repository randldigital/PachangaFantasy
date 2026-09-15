import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Loader2, Play, Plus, Target, UserMinus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import CreateClubMatchForm from "@/components/club/CreateClubMatchForm";
import AddPlayersToMatchModal from "@/components/league/AddPlayersToMatchModal";
import DeleteMatchButton from "@/components/league/DeleteMatchButton";
import {
  canEndMatch,
  canStartMatch,
  isJoinableStatus,
  isMatchJoinOpen,
  normalizeMatchStatus,
} from "@shared/domain/matchLifecycle";
import type { Club, Match, Player, User } from "@shared/schema";
import MatchJoinToggle from "@/components/MatchJoinToggle";

const actionButtonClass = "w-full sm:w-auto";

interface ParticipantWithUser {
  matchId: number;
  playerId: number;
  status: string;
  playerName: string;
  userId?: number;
  username?: string;
  userRole?: string;
}

interface ClubMatchBannerProps {
  club: Club;
  match?: Match;
  user?: User;
  players: Player[];
  createMatchOpen: boolean;
  onCreateMatchOpenChange: (open: boolean) => void;
  onOpenStats?: () => void;
}

export default function ClubMatchBanner({
  club,
  match,
  user,
  players,
  createMatchOpen,
  onCreateMatchOpenChange,
  onOpenStats,
}: ClubMatchBannerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const isAdmin = Boolean(user && user.id === club.createdBy);

  const { data: participants = [], isLoading: participantsLoading } = useQuery<ParticipantWithUser[]>({
    queryKey: queryKeys.matchParticipants(match?.id || 0),
    queryFn: () => api.get<ParticipantWithUser[]>(`/api/matches/${match!.id}/participants`),
    enabled: !!match,
  });

  const acceptedParticipants = participants.filter((participant) => participant.status === "accepted");
  const userHasJoined = acceptedParticipants.some((participant) => participant.userId === user?.id);
  const ownPlayerId = acceptedParticipants.find((participant) => participant.userId === user?.id)?.playerId;
  const statusOpen = isJoinableStatus(match?.status);
  const canSelfJoin = statusOpen && isMatchJoinOpen(match);

  const invalidateClubMatch = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.clubMatches(club.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.club(club.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.clubAggregates(club.id) }),
      match
        ? queryClient.invalidateQueries({ queryKey: queryKeys.matchParticipants(match.id) })
        : Promise.resolve(),
    ]);
  };

  const joinMatchMutation = useMutation({
    mutationFn: async (matchId: number) => api.post(`/api/matches/${matchId}/join`, {}),
    onSuccess: async () => {
      toast({
        title: t("match.joined"),
        description: t("club.matchJoinedDescription"),
      });
      await invalidateClubMatch();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const leaveMatchMutation = useMutation({
    mutationFn: async (playerId: number) => api.delete(`/api/matches/${match!.id}/participants/${playerId}`),
    onSuccess: async () => {
      toast({ title: t("match.left") });
      await invalidateClubMatch();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (playerId: number) => api.delete(`/api/matches/${match!.id}/participants/${playerId}`),
    onSuccess: async () => {
      toast({ title: t("match.participantRemoved") });
      await invalidateClubMatch();
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
      await invalidateClubMatch();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const createMatchDialog = (
    <Dialog open={createMatchOpen} onOpenChange={onCreateMatchOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">{t("match.createMatch")}</DialogTitle>
        </DialogHeader>
        <CreateClubMatchForm clubId={club.id} onSuccess={() => onCreateMatchOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );

  const formatDate = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (match) {
    return (
      <>
        <Card className="overflow-hidden bg-gradient-to-r from-sky-500/20 to-sky-600/20 border-sky-500/30">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
                <div className="flex items-center space-x-2 text-sky-400 min-w-0">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{formatDate(match.date)}</span>
                </div>
                <div className="flex items-center space-x-2 text-sky-400">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{formatTime(match.date)}</span>
                </div>
                <span className="text-white font-medium">
                  {match.opponentName ?? t("club.opponentPending")}
                </span>
                <Badge
                  variant="secondary"
                  className={`${
                    match.status === "scored"
                      ? "bg-purple-600"
                      : match.status === "completed"
                        ? "bg-green-600"
                        : normalizeMatchStatus(match.status) === "started"
                          ? "bg-blue-600"
                          : "bg-sky-600"
                  } text-white font-medium`}
                >
                  {t(`match.status.${normalizeMatchStatus(match.status)}`)}
                </Badge>
                <div className="flex items-center space-x-2 text-slate-300">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">
                    {participantsLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      acceptedParticipants.length
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-stretch gap-2 w-full sm:w-auto sm:justify-end">
                {isAdmin && statusOpen && (
                  <MatchJoinToggle
                    matchId={match.id}
                    joinOpen={isMatchJoinOpen(match)}
                    clubId={club.id}
                  />
                )}
                {isAdmin && statusOpen && (
                  <Button
                    onClick={() => setShowAddPlayers(true)}
                    size="sm"
                    variant="outline"
                    className={`border-sky-500 text-sky-400 hover:bg-sky-500 hover:text-white ${actionButtonClass}`}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t("match.addPlayers")}
                  </Button>
                )}
                {isAdmin && canStartMatch(match.status) && (
                  <Button
                    onClick={() => startMatchMutation.mutate(match.id)}
                    disabled={startMatchMutation.isPending}
                    size="sm"
                    className={`bg-sky-600 hover:bg-sky-700 text-white ${actionButtonClass}`}
                  >
                    {startMatchMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {t("match.startMatch")}
                  </Button>
                )}
                {isAdmin && canEndMatch(match.status) && (
                  <RecordClubResultButton clubId={club.id} match={match} onRecorded={onOpenStats} />
                )}
                {onOpenStats &&
                  (normalizeMatchStatus(match.status) === "completed" ||
                    normalizeMatchStatus(match.status) === "scored") && (
                    <Button
                      onClick={onOpenStats}
                      size="sm"
                      className={`bg-sky-600 hover:bg-sky-700 text-white ${actionButtonClass}`}
                    >
                      <Target className="h-4 w-4 mr-1" />
                      {t("club.tabs.stats")}
                    </Button>
                  )}
                {isAdmin && (
                  <DeleteMatchButton
                    match={match}
                    clubId={club.id}
                    isLeagueCreator={isAdmin}
                    className={actionButtonClass}
                  />
                )}
                {userHasJoined && statusOpen && ownPlayerId != null && (
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
                {!userHasJoined && canSelfJoin && (
                  <Button
                    onClick={() => joinMatchMutation.mutate(match.id)}
                    disabled={joinMatchMutation.isPending}
                    size="sm"
                    className={`bg-sky-600 hover:bg-sky-700 text-white ${actionButtonClass}`}
                  >
                    {joinMatchMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    {joinMatchMutation.isPending ? t("common.joining") : t("match.join")}
                  </Button>
                )}
              </div>
            </div>
            {statusOpen && acceptedParticipants.length > 0 && (
              <ul className="mt-3 space-y-1">
                {acceptedParticipants.map((participant) => (
                  <li
                    key={participant.playerId}
                    className="flex items-center justify-between gap-2 rounded-md bg-slate-900/40 px-2 py-1"
                  >
                    <span className="text-sm text-slate-200 truncate">
                      {participant.username || participant.playerName}
                    </span>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-400"
                        aria-label={t("match.removeParticipant")}
                        disabled={removeParticipantMutation.isPending}
                        onClick={() => removeParticipantMutation.mutate(participant.playerId)}
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <AddPlayersToMatchModal
          isOpen={showAddPlayers}
          onClose={() => setShowAddPlayers(false)}
          match={match}
          players={players}
          participants={participants}
        />
        {createMatchDialog}
      </>
    );
  }

  if (isAdmin) {
    return (
      <>
        <Card className="overflow-hidden bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-white font-medium">{t("match.noActiveMatch")}</h3>
                <p className="text-slate-400 text-sm">{t("club.createMatchDescription")}</p>
              </div>
              <Button
                onClick={() => onCreateMatchOpenChange(true)}
                className={`bg-sky-600 hover:bg-sky-700 text-white ${actionButtonClass}`}
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
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="text-center">
            <h3 className="text-white font-medium mb-2">{t("match.noActiveMatch")}</h3>
            <p className="text-slate-400 text-sm">{t("club.waitingForMatch")}</p>
          </div>
        </CardContent>
      </Card>
      {createMatchDialog}
    </>
  );
}

function RecordClubResultButton({
  clubId,
  match,
  onRecorded,
}: {
  clubId: number;
  match: Match;
  onRecorded?: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [opponentName, setOpponentName] = useState(match.opponentName ?? "");
  const [ourGoals, setOurGoals] = useState("");
  const [opponentGoals, setOpponentGoals] = useState("");

  const recordResultMutation = useMutation({
    mutationFn: async () => {
      const ours = parseInt(ourGoals, 10);
      const theirs = parseInt(opponentGoals, 10);
      if (Number.isNaN(ours) || ours < 0 || Number.isNaN(theirs) || theirs < 0) {
        throw new Error(t("club.scoreInvalid"));
      }
      const name = opponentName.trim();
      if (!name) {
        throw new Error(t("club.opponentRequired"));
      }
      const response = await api.post(`/api/matches/${match.id}/club-result`, {
        opponentName: name,
        ourGoals: ours,
        opponentGoals: theirs,
      });
      return response;
    },
    onSuccess: async () => {
      toast({
        title: t("club.resultRecorded"),
        description: t("club.resultRecordedDescription", {
          ourGoals,
          opponentGoals,
        }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.clubMatches(clubId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.match(match.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clubAggregates(clubId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clubRankingsPrefix(clubId) }),
      ]);
      setOpen(false);
      onRecorded?.();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setOpponentName(match.opponentName ?? "");
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`text-orange-400 border-orange-500 hover:bg-orange-500 hover:text-white ${actionButtonClass}`}
        >
          <Target className="h-4 w-4 mr-1" />
          {t("club.recordResult")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            {t("club.recordResultTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {t("club.recordResultDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="club-result-opponent">{t("club.opponentName")} *</Label>
            <Input
              id="club-result-opponent"
              value={opponentName}
              onChange={(event) => setOpponentName(event.target.value)}
              maxLength={40}
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="club-our-goals">{t("club.ourGoals")}</Label>
              <Input
                id="club-our-goals"
                type="number"
                min="0"
                value={ourGoals}
                onChange={(event) => setOurGoals(event.target.value)}
                className="w-full bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="club-opponent-goals">{t("club.opponentGoals")}</Label>
              <Input
                id="club-opponent-goals"
                type="number"
                min="0"
                value={opponentGoals}
                onChange={(event) => setOpponentGoals(event.target.value)}
                className="w-full bg-slate-900 border-slate-600 text-white"
              />
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => recordResultMutation.mutate()}
            disabled={
              recordResultMutation.isPending ||
              opponentName.trim() === "" ||
              ourGoals.trim() === "" ||
              opponentGoals.trim() === ""
            }
            className="bg-orange-600 hover:bg-orange-700"
          >
            {recordResultMutation.isPending ? t("common.saving") : t("club.recordResult")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
