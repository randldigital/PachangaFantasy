import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { invalidateMatchQueries, isClubMatch, isRatingsPhase } from "@/lib/matchQueries";
import { useToast } from "@/hooks/use-toast";
import type { Match } from "@shared/schema";
import { formatDisplayMarketValue, formatDisplayMarketValueDelta } from "@shared/domain/displayValue";

export interface RatingsPayload {
  ratingsComplete: boolean;
  voterCount: number;
  submittedCount: number;
  submittedVoterIds: number[];
  assignments: { playerId: number; name: string; kind: "teammate" | "rival" | "club"; score: number | null }[];
  myBallot: { voterPlayerId: number; submitted: boolean; mvpPlayerId: number | null } | null;
  history: {
    playerId: number;
    name: string;
    vmBefore: number;
    vmAfter: number;
    delta: number;
    performanceScore: number;
  }[];
}

interface MatchRatingsProps {
  match: Match;
  participants: { playerId: number; playerName: string; status: string }[];
}

export default function MatchRatings({ match, participants }: MatchRatingsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery<RatingsPayload>({
    queryKey: queryKeys.matchRatings(match.id),
    queryFn: () => api.get<RatingsPayload>(`/api/matches/${match.id}/ratings`),
    enabled: isRatingsPhase(match.status),
  });

  const [mvpPlayerId, setMvpPlayerId] = useState<number | "">("");
  const [scores, setScores] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!data) {
      return;
    }
    setMvpPlayerId(data.myBallot?.mvpPlayerId ?? "");
    setScores(
      Object.fromEntries(
        data.assignments.map((row) => [row.playerId, row.score ?? 5]),
      ),
    );
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<RatingsPayload>(`/api/matches/${match.id}/ratings`, {
        mvpPlayerId,
        ratings: data?.assignments.map((row) => ({
          playerId: row.playerId,
          score: scores[row.playerId] ?? 5,
        })),
      }),
    onSuccess: async () => {
      toast({ title: t("ratings.submitted") });
      await invalidateMatchQueries(queryClient, match);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  if (!isRatingsPhase(match.status)) {
    return null;
  }

  if ((match.status === "scored" || match.status === "closed") && !isClubMatch(match) && data?.history.length) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">{t("ratings.historyTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.history.map((row) => (
            <div key={row.playerId} className="flex items-center justify-between text-sm">
              <span className="text-white">{row.name}</span>
              <span className="text-slate-300">
                {formatDisplayMarketValue(row.vmBefore)} → {formatDisplayMarketValue(row.vmAfter)}{" "}
                <span className={row.delta >= 0 ? "text-emerald-400" : "text-amber-400"}>
                  ({formatDisplayMarketValueDelta(row.delta)})
                </span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data?.myBallot) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4 text-slate-400 text-sm">
          {t("ratings.waiting", { submitted: data?.submittedCount ?? 0, total: data?.voterCount ?? 0 })}
        </CardContent>
      </Card>
    );
  }

  const mvpOptions = participants.filter(
    (participant) =>
      participant.status === "accepted" &&
      participant.playerId !== data.myBallot?.voterPlayerId,
  );

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white text-lg">{t("ratings.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-slate-400 text-sm">
          {t("ratings.progress", { submitted: data.submittedCount, total: data.voterCount })}
        </p>
        <div className="space-y-2">
          <Label className="text-slate-200">{t("ratings.mvp")}</Label>
          <select
            className="w-full rounded-md bg-slate-900 border border-slate-600 text-white p-2"
            value={mvpPlayerId}
            onChange={(event) => setMvpPlayerId(event.target.value ? Number(event.target.value) : "")}
            disabled={match.status !== "completed"}
          >
            <option value="">{t("ratings.chooseMvp")}</option>
            {mvpOptions.map((participant) => (
              <option key={participant.playerId} value={participant.playerId}>
                {participant.playerName}
              </option>
            ))}
          </select>
        </div>
        {data.assignments.map((row) => (
          <div key={row.playerId} className="space-y-1">
            <Label className="text-slate-200 flex items-center justify-between">
              <span>
                {t(`ratings.${row.kind}`)}: {row.name}
              </span>
              <span className="text-emerald-300 tabular-nums">{(scores[row.playerId] ?? 5).toFixed(1)}</span>
            </Label>
            <Slider
              min={0}
              max={10}
              step={0.1}
              value={[scores[row.playerId] ?? 5]}
              onValueChange={([value]) =>
                setScores((current) => ({ ...current, [row.playerId]: Math.round(value * 10) / 10 }))
              }
              disabled={match.status !== "completed"}
              className="py-2"
            />
            <p className="text-[11px] text-slate-500">{t("ratings.scaleHint")}</p>
          </div>
        ))}
        {match.status === "completed" && (
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={submitMutation.isPending || mvpPlayerId === ""}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending
              ? t("common.saving")
              : data.myBallot.submitted
                ? t("ratings.update")
                : t("ratings.submit")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
