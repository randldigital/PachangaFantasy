import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { invalidateMatchQueries, isClubMatch, isRatingsPhase } from "@/lib/matchQueries";
import { useToast } from "@/hooks/use-toast";
import { Calculator, CheckCircle, Clock, Lock, Users, AlertTriangle } from "lucide-react";
import SubmitMyStats from "./SubmitMyStats";
import CorrectResultButton from "@/components/CorrectResultButton";
import { canCloseMatch, isClosedStatus } from "@shared/domain/matchLifecycle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import type { StatsStatus } from "@shared/domain/stats";
import type { Match, Player, StatReport } from "@shared/schema";

interface AdminStatsOverviewProps {
  match: Match;
  isLeagueCreator: boolean;
  players: Player[];
  participants: ParticipantDetail[];
  reports: StatReport[];
  status: StatsStatus;
}

export interface ParticipantDetail {
  matchId: number;
  playerId: number;
  status: string;
  playerName: string;
  userId?: number | null;
  username?: string;
}

function stateBadgeClass(state: string) {
  switch (state) {
    case "validated":
      return "bg-emerald-600 text-white";
    case "inconsistent":
      return "bg-amber-600 text-white";
    case "submitted":
      return "bg-blue-600 text-white";
    default:
      return "bg-slate-600 text-white";
  }
}

export default function AdminStatsOverview({
  match,
  isLeagueCreator,
  players,
  participants,
  reports,
  status,
}: AdminStatsOverviewProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [forceOpen, setForceOpen] = useState(false);

  const clubMatch = isClubMatch(match);

  const { data: ratingsPayload } = useQuery<{ ratingsComplete: boolean; submittedCount: number; voterCount: number }>({
    queryKey: queryKeys.matchRatings(match.id),
    queryFn: () =>
      api.get<{ ratingsComplete: boolean; submittedCount: number; voterCount: number }>(
        `/api/matches/${match.id}/ratings`,
      ),
    enabled: isRatingsPhase(match.status),
  });

  const ratingsComplete = Boolean(ratingsPayload?.ratingsComplete);

  const invalidate = async () => {
    await invalidateMatchQueries(queryClient, match);
  };

  const calculateScoresMutation = useMutation({
    mutationFn: (body?: { force?: boolean }) =>
      api.post<{ lineupIssues?: { message: string }[] }>(`/api/matches/${match.id}/calculate-scores`, body),
    onSuccess: (result) => {
      toast({
        title: t("stats.scored"),
        description: result.lineupIssues?.length
          ? t("stats.scoredWithIssues", { count: result.lineupIssues.length })
          : t("stats.scoredDescription"),
      });
      invalidate();
    },
    onError: (error: Error) => {
      toast({
        title: t("stats.scoreError"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/api/matches/${match.id}/close`),
    onSuccess: () => {
      toast({ title: t("stats.closed") });
      invalidate();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  if (!isLeagueCreator) {
    return null;
  }

  const accepted = participants.filter((participant) => participant.status === "accepted");
  const scored = match.status === "scored" || isClosedStatus(match.status);

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Users className="h-5 w-5 text-blue-400" />
          {t("stats.overview")}
          <Badge className={`ml-auto ${stateBadgeClass(status.state)}`}>
            {t(`stats.states.${status.state}`)}
          </Badge>
        </CardTitle>
        <CardDescription>
          {t("stats.submittedCount", {
            submitted: status.submittedPlayerIds.length,
            total: accepted.length,
          })}
        </CardDescription>
        {!scored && (
          <div className="pt-2">
            <CorrectResultButton match={match} className="w-full sm:w-auto" />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-slate-900/50 p-3 rounded-lg space-y-2">
          {(status.sides?.length ? status.sides : []).map((side) => (
            <div key={side.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {clubMatch
                    ? t("club.ourGoals")
                    : side.key === "b"
                      ? t("match.teamBGoals")
                      : t("match.teamAGoals")}
                </span>
                <span className="text-white font-medium">
                  {side.reportedGoals}/{side.expectedGoals ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{t("stats.reportedAssists")}</span>
                <span className="text-white font-medium">
                  {side.reportedAssists}/{side.expectedGoals ?? "—"}
                </span>
              </div>
            </div>
          ))}
          {(!status.sides || status.sides.length === 0) && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {clubMatch ? t("club.ourGoals") : t("stats.expectedGoals")}
                </span>
                <span className="text-white font-medium">{status.expectedTotal ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{t("stats.reportedGoals")}</span>
                <span className="text-white font-medium">{status.reportedTotal}</span>
              </div>
            </>
          )}
          {status.complete && !status.consistent && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{t("stats.overCap")}</span>
              <span className="text-amber-400 font-medium">{t("stats.overCapYes")}</span>
            </div>
          )}
        </div>

        {accepted.map((participant) => {
          const report = reports.find((item) => item.playerId === participant.playerId);
          const player = players.find((item) => item.id === participant.playerId);
          const accountless = participant.userId == null;
          const pending = !report;

          return (
            <div key={participant.playerId} className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-slate-900/40 rounded">
                <div>
                  <p className="text-sm text-white">
                    {participant.username || participant.playerName}
                    {accountless && (
                      <span className="ml-2 text-xs text-slate-400">{t("stats.external")}</span>
                    )}
                    {!accountless && pending && (
                      <span className="ml-2 text-xs text-slate-400">{t("stats.absentHint")}</span>
                    )}
                  </p>
                  {report && (
                    <p className="text-xs text-slate-400">
                      {clubMatch
                        ? t("stats.currentValuesClub", {
                            goals: report.goals ?? 0,
                            assists: report.assists ?? 0,
                            minutes: report.minutes ?? 0,
                          })
                        : t("stats.currentValues", { goals: report.goals ?? 0, assists: report.assists ?? 0 })}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {pending ? (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Clock className="h-3 w-3" />
                      {t("stats.states.pending")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="h-3 w-3" />
                      {t("stats.states.submitted")}
                    </span>
                  )}
                </Badge>
              </div>
              {isLeagueCreator && !scored && (
                <SubmitMyStats
                  match={match}
                  playerId={participant.playerId}
                  playerName={player?.name || participant.playerName}
                  existing={report}
                />
              )}
            </div>
          );
        })}

        {status.state === "pending" && (
          <Alert className="border-yellow-600 bg-yellow-900/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("stats.waitingOn", {
                names: accepted
                  .filter((participant) => status.pendingPlayerIds.includes(participant.playerId))
                  .map((participant) => participant.username || participant.playerName)
                  .join(", "),
              })}
            </AlertDescription>
          </Alert>
        )}

        {status.state === "inconsistent" && (
          <Alert className="border-amber-600 bg-amber-900/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {clubMatch
                ? t("stats.clubOverCapWarning")
                : t("stats.overCapDetail")}
            </AlertDescription>
          </Alert>
        )}

        {status.state === "validated" && (
          <Alert className="border-green-600 bg-green-900/20">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{t("stats.validatedDetail")}</AlertDescription>
          </Alert>
        )}

        <div className="pt-2 border-t border-slate-700">
          <Button
            onClick={() => {
              if (ratingsComplete) {
                calculateScoresMutation.mutate(undefined);
              } else {
                setForceOpen(true);
              }
            }}
            disabled={
              calculateScoresMutation.isPending || !status.canScore || scored
            }
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isClosedStatus(match.status)
              ? t("stats.alreadyClosed")
              : scored
                ? t("stats.alreadyScored")
                : calculateScoresMutation.isPending
                  ? t("stats.scoring")
                  : ratingsComplete
                    ? t("stats.calculateScores")
                    : t("stats.forceCalculate")}
          </Button>
          {!scored && !status.canScore && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              {!status.complete
                ? t("stats.scoreBlockedIncomplete")
                : !status.assistsOk
                  ? t("stats.scoreBlockedAssists")
                  : t("stats.scoreBlockedInconsistent")}
            </p>
          )}
          {!scored && status.canScore && !ratingsComplete && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              {t("stats.scoreBlockedRatings", {
                submitted: ratingsPayload?.submittedCount ?? 0,
                total: ratingsPayload?.voterCount ?? 0,
              })}
            </p>
          )}
          {clubMatch && canCloseMatch(match.status) && (
            <Button
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              variant="outline"
              className="w-full mt-2 border-slate-500 text-slate-200 hover:bg-slate-700"
            >
              <Lock className="h-4 w-4 mr-2" />
              {closeMutation.isPending ? t("common.saving") : t("stats.closeMatch")}
            </Button>
          )}
          {clubMatch && isClosedStatus(match.status) && (
            <p className="text-xs text-slate-400 mt-2 text-center">{t("stats.closedNote")}</p>
          )}
        </div>

        <AlertDialog open={forceOpen} onOpenChange={setForceOpen}>
          <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("stats.forceCalculateTitle")}</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                {t(
                  clubMatch ? "stats.forceCalculateDescriptionClub" : "stats.forceCalculateDescription",
                  {
                    submitted: ratingsPayload?.submittedCount ?? 0,
                    total: ratingsPayload?.voterCount ?? 0,
                  },
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  calculateScoresMutation.mutate({ force: true });
                  setForceOpen(false);
                }}
              >
                {t("stats.forceCalculateConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
