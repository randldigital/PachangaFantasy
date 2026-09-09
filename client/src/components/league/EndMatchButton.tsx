import { useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { CircleStop, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match } from "@shared/schema";

interface EndMatchButtonProps {
  match: Match;
  leagueId: number;
  isLeagueCreator: boolean;
  className?: string;
}

export default function EndMatchButton({ match, leagueId, isLeagueCreator, className }: EndMatchButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [teamAGoals, setTeamAGoals] = useState("");
  const [teamBGoals, setTeamBGoals] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const endMatchMutation = useMutation({
    mutationFn: async () => {
      const scoreA = parseInt(teamAGoals, 10);
      const scoreB = parseInt(teamBGoals, 10);
      if (Number.isNaN(scoreA) || scoreA < 0 || Number.isNaN(scoreB) || scoreB < 0) {
        throw new Error(t("match.finalScoreInvalid"));
      }

      const endResponse = await apiRequest("POST", `/api/matches/${match.id}/end`, {
        teamAGoals: scoreA,
        teamBGoals: scoreB,
      });
      return endResponse.json();
    },
    onSuccess: async () => {
      toast({
        title: t("match.ended"),
        description: t("match.endedDescription", {
          scoreA: teamAGoals,
          scoreB: teamBGoals,
          total: Number(teamAGoals) + Number(teamBGoals),
        }),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(leagueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.match(match.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matchStats(match.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matchStatsStatus(match.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matchParticipants(match.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.league(leagueId) }),
      ]);

      setOpen(false);
      setTeamAGoals("");
      setTeamBGoals("");
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

  if (match.status === "scored") {
    return (
      <div className={cn("flex items-center justify-center gap-2 px-3 py-1 bg-purple-600/20 border border-purple-500/50 rounded-md", className)}>
        <Trophy className="h-4 w-4 text-purple-400" />
        <span className="text-sm text-purple-400 font-medium">{t("match.status.scored")}</span>
      </div>
    );
  }

  if (match.status === "completed") {
    return (
      <div className={cn("flex items-center justify-center gap-2 px-3 py-1 bg-green-600/20 border border-green-500/50 rounded-md", className)}>
        <Trophy className="h-4 w-4 text-green-400" />
        <span className="text-sm text-green-400 font-medium">{t("match.status.completed")}</span>
      </div>
    );
  }

  if (match.status !== "started") {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("text-orange-600 hover:text-orange-700", className)}>
          <CircleStop className="h-4 w-4 mr-1" />
          {t("match.end")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            {t("match.endTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {t("match.endDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="teamAGoals">{t("match.teamAGoals")}</Label>
              <Input
                id="teamAGoals"
                type="number"
                min="0"
                value={teamAGoals}
                onChange={(e) => setTeamAGoals(e.target.value)}
                className="w-full bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamBGoals">{t("match.teamBGoals")}</Label>
              <Input
                id="teamBGoals"
                type="number"
                min="0"
                value={teamBGoals}
                onChange={(e) => setTeamBGoals(e.target.value)}
                className="w-full bg-slate-900 border-slate-600 text-white"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">{t("match.finalScoreInvalid")}</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              setTeamAGoals("");
              setTeamBGoals("");
            }}
          >
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => endMatchMutation.mutate()}
            disabled={endMatchMutation.isPending || teamAGoals.trim() === "" || teamBGoals.trim() === ""}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {endMatchMutation.isPending ? t("match.ending") : t("match.end")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
