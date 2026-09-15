import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/apiError";

export default function MatchJoinToggle({
  matchId,
  joinOpen,
  leagueId,
  clubId,
}: {
  matchId: number;
  joinOpen: boolean;
  leagueId?: number | null;
  clubId?: number | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: boolean) => api.post(`/api/matches/${matchId}/join-open`, { joinOpen: next }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) }),
        leagueId
          ? queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(leagueId) })
          : Promise.resolve(),
        clubId
          ? queryClient.invalidateQueries({ queryKey: queryKeys.clubMatches(clubId) })
          : Promise.resolve(),
      ]);
    },
    onError: (error) => {
      toast({ title: t("common.error"), description: describeApiError(error, t), variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={joinOpen}
        onCheckedChange={(checked) => mutation.mutate(checked)}
        disabled={mutation.isPending}
        aria-label={t("match.joinOpenLabel")}
      />
      <Label className="text-slate-300 text-xs sm:text-sm">
        {joinOpen ? t("match.joinOpen") : t("match.joinClosed")}
      </Label>
    </div>
  );
}
