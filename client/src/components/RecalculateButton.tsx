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
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match } from "@shared/schema";
import { normalizeMatchStatus } from "@shared/domain/matchLifecycle";

export default function RecalculateButton({
  match,
  className,
}: {
  match: Match;
  className?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const status = normalizeMatchStatus(match.status);

  const mutation = useMutation({
    mutationFn: () => api.post(`/api/matches/${match.id}/recalculate`),
    onSuccess: async () => {
      toast({
        title: t("match.recalculateDone"),
        description: t("match.recalculateDoneDescription"),
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

  if (status !== "scored" && status !== "closed") {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("text-violet-300 border-violet-500 hover:bg-violet-500/10", className)}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          {t("match.recalculate")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("match.recalculateTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {t("match.recalculateConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-violet-600 hover:bg-violet-700"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t("common.saving") : t("match.recalculate")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
