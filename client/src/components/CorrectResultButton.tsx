import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { invalidateMatchQueries, isClubMatch } from "@/lib/matchQueries";
import { useToast } from "@/hooks/use-toast";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match } from "@shared/schema";
import { normalizeMatchStatus } from "@shared/domain/matchLifecycle";

export default function CorrectResultButton({
  match,
  className,
}: {
  match: Match;
  className?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const club = isClubMatch(match);
  const scored =
    normalizeMatchStatus(match.status) === "scored" ||
    normalizeMatchStatus(match.status) === "closed";
  const [teamAGoals, setTeamAGoals] = useState(String(match.teamAGoals ?? ""));
  const [teamBGoals, setTeamBGoals] = useState(String(match.teamBGoals ?? ""));
  const [opponentName, setOpponentName] = useState(match.opponentName ?? "");
  const [ourGoals, setOurGoals] = useState(String(match.ourGoals ?? ""));
  const [opponentGoals, setOpponentGoals] = useState(String(match.opponentGoals ?? ""));

  const mutation = useMutation({
    mutationFn: async () => {
      if (club) {
        const ours = parseInt(ourGoals, 10);
        const theirs = parseInt(opponentGoals, 10);
        const name = opponentName.trim();
        if (Number.isNaN(ours) || ours < 0 || Number.isNaN(theirs) || theirs < 0 || !name) {
          throw new Error(t("club.scoreInvalid"));
        }
        return api.patch(`/api/matches/${match.id}/result`, {
          opponentName: name,
          ourGoals: ours,
          opponentGoals: theirs,
        });
      }
      const scoreA = parseInt(teamAGoals, 10);
      const scoreB = parseInt(teamBGoals, 10);
      if (Number.isNaN(scoreA) || scoreA < 0 || Number.isNaN(scoreB) || scoreB < 0) {
        throw new Error(t("match.finalScoreInvalid"));
      }
      return api.patch(`/api/matches/${match.id}/result`, {
        teamAGoals: scoreA,
        teamBGoals: scoreB,
      });
    },
    onSuccess: async () => {
      toast({
        title: t("match.correctResultDone"),
        description: scored ? t("match.recalculateDoneDescription") : t("match.correctResultDoneCompleted"),
      });
      await invalidateMatchQueries(queryClient, match);
      await queryClient.invalidateQueries({ queryKey: queryKeys.matchRecap(match.id) });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const status = normalizeMatchStatus(match.status);
  if (status !== "completed" && status !== "scored" && status !== "closed") {
    return null;
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setTeamAGoals(String(match.teamAGoals ?? ""));
          setTeamBGoals(String(match.teamBGoals ?? ""));
          setOpponentName(match.opponentName ?? "");
          setOurGoals(String(match.ourGoals ?? ""));
          setOpponentGoals(String(match.opponentGoals ?? ""));
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("text-amber-300 border-amber-500 hover:bg-amber-500/10", className)}
        >
          <Target className="h-4 w-4 mr-1" />
          {t("match.correctResult")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("match.correctResultTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {scored ? t("match.recalculateConfirm") : t("match.correctResultDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          {club ? (
            <>
              <div className="space-y-2">
                <Label htmlFor={`correct-opponent-${match.id}`}>{t("club.opponentName")} *</Label>
                <Input
                  id={`correct-opponent-${match.id}`}
                  value={opponentName}
                  onChange={(event) => setOpponentName(event.target.value)}
                  maxLength={40}
                  className="bg-slate-900 border-slate-600 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`correct-ours-${match.id}`}>{t("club.ourGoals")}</Label>
                  <Input
                    id={`correct-ours-${match.id}`}
                    type="number"
                    min="0"
                    value={ourGoals}
                    onChange={(event) => setOurGoals(event.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`correct-theirs-${match.id}`}>{t("club.opponentGoals")}</Label>
                  <Input
                    id={`correct-theirs-${match.id}`}
                    type="number"
                    min="0"
                    value={opponentGoals}
                    onChange={(event) => setOpponentGoals(event.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`correct-a-${match.id}`}>{t("match.teamAGoals")}</Label>
                <Input
                  id={`correct-a-${match.id}`}
                  type="number"
                  min="0"
                  value={teamAGoals}
                  onChange={(event) => setTeamAGoals(event.target.value)}
                  className="bg-slate-900 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`correct-b-${match.id}`}>{t("match.teamBGoals")}</Label>
                <Input
                  id={`correct-b-${match.id}`}
                  type="number"
                  min="0"
                  value={teamBGoals}
                  onChange={(event) => setTeamBGoals(event.target.value)}
                  className="bg-slate-900 border-slate-600 text-white"
                />
              </div>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {mutation.isPending ? t("common.saving") : t("match.correctResult")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
