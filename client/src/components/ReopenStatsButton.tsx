import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import { invalidateMatchQueries } from "@/lib/matchQueries";
import { useToast } from "@/hooks/use-toast";
import { Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match } from "@shared/schema";
import { canReopenMatchStats } from "@shared/domain/matchReplay";

export default function ReopenStatsButton({
  match,
  matches,
  className,
}: {
  match: Match;
  matches: Match[];
  className?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.post(`/api/matches/${match.id}/reopen-stats`),
    onSuccess: async () => {
      toast({
        title: t("match.reopenStatsDone"),
        description: t("match.reopenStatsDoneDescription"),
      });
      await invalidateMatchQueries(queryClient, match);
      await queryClient.invalidateQueries({ queryKey: queryKeys.matchRecap(match.id) });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  if (!canReopenMatchStats(matches, match)) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("text-amber-300 border-amber-500 hover:bg-amber-500/10", className)}
        >
          <Unlock className="h-4 w-4 mr-1" />
          {t("match.reopenStats")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("match.reopenStatsTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {t("match.reopenStatsConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t("common.saving") : t("match.reopenStats")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
