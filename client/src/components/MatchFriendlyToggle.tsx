import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/apiError";
import { invalidateMatchQueries } from "@/lib/matchQueries";
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
import type { Match } from "@shared/schema";
import { normalizeMatchStatus } from "@shared/domain/matchLifecycle";

export default function MatchFriendlyToggle({ match }: { match: Match }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<boolean | null>(null);
  const scored =
    normalizeMatchStatus(match.status) === "scored" ||
    normalizeMatchStatus(match.status) === "closed";

  const mutation = useMutation({
    mutationFn: (next: boolean) => api.post(`/api/matches/${match.id}/friendly`, { isFriendly: next }),
    onSuccess: async () => {
      toast({
        title: t("match.friendlyUpdated"),
        description: scored ? t("match.recalculateDoneDescription") : undefined,
      });
      await invalidateMatchQueries(queryClient, match);
      await queryClient.invalidateQueries({ queryKey: queryKeys.matchRecap(match.id) });
      setPending(null);
    },
    onError: (error) => {
      toast({ title: t("common.error"), description: describeApiError(error, t), variant: "destructive" });
      setPending(null);
    },
  });

  const apply = (next: boolean) => {
    if (scored) {
      setPending(next);
      return;
    }
    mutation.mutate(next);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Switch
          checked={match.isFriendly}
          onCheckedChange={apply}
          disabled={mutation.isPending}
          aria-label={t("match.friendlyLabel")}
        />
        <Label className="text-slate-300 text-xs sm:text-sm">
          {match.isFriendly ? t("match.friendly") : t("match.official")}
        </Label>
      </div>
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("match.friendlyConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {t("match.recalculateConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => pending !== null && mutation.mutate(pending)}
            >
              {t("match.friendlyConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
