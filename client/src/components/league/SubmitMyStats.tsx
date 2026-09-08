import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import StatCounters from "./StatCounters";
import { isStatsEditable } from "@shared/domain/stats";
import type { Match, StatReport } from "@shared/schema";

interface SubmitMyStatsProps {
  match: Match;
  playerId: number;
  playerName?: string;
  existing?: StatReport;
  locked?: boolean;
}

export default function SubmitMyStats({
  match,
  playerId,
  playerName,
  existing,
  locked = false,
}: SubmitMyStatsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [goals, setGoals] = useState(existing?.goals ?? 0);
  const [assists, setAssists] = useState(existing?.assists ?? 0);

  useEffect(() => {
    setGoals(existing?.goals ?? 0);
    setAssists(existing?.assists ?? 0);
  }, [existing?.goals, existing?.assists]);

  const editable = isStatsEditable(match.status) && !locked;
  const hasSubmitted = Boolean(existing);

  const submitStatsMutation = useMutation({
    mutationFn: () =>
      api.post<StatReport>(`/api/matches/${match.id}/stats`, {
        goals,
        assists,
        playerId,
      }),
    onSuccess: async () => {
      toast({
        title: hasSubmitted ? t("stats.updated") : t("stats.submitted"),
        description: t("stats.submittedDescription", { goals, assists }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.matchStats(match.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matchStatsStatus(match.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(match.leagueId) }),
      ]);
    },
    onError: (error: Error) => {
      toast({
        title: t("stats.submitError"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white text-lg">
          {playerName ? t("stats.submitFor", { name: playerName }) : t("stats.submitMine")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasSubmitted && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle className="h-4 w-4" />
            {t("stats.currentValues", { goals: existing?.goals ?? 0, assists: existing?.assists ?? 0 })}
          </div>
        )}
        <StatCounters
          goals={goals}
          assists={assists}
          onGoalsChange={setGoals}
          onAssistsChange={setAssists}
          disabled={!editable || submitStatsMutation.isPending}
        />
        {editable ? (
          <Button
            onClick={() => submitStatsMutation.mutate()}
            disabled={submitStatsMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitStatsMutation.isPending
              ? t("common.submitting")
              : hasSubmitted
                ? t("stats.update")
                : t("stats.submit")}
          </Button>
        ) : (
          <p className="text-sm text-slate-400">
            {match.status === "scored" ? t("stats.lockedAfterScore") : t("stats.notYet")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
