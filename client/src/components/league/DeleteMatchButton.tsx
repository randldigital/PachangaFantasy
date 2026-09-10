import { useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { describeApiError } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match } from "@shared/schema";

interface DeleteMatchButtonProps {
  match: Match;
  leagueId?: number;
  clubId?: number;
  isLeagueCreator: boolean;
  onMatchDeleted?: () => void;
  className?: string;
}

export default function DeleteMatchButton({
  match,
  leagueId,
  clubId,
  isLeagueCreator,
  onMatchDeleted,
  className,
}: DeleteMatchButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMatchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/matches/${match.id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("match.deleted"),
        description: t("match.deletedDescription"),
      });

      setOpen(false);
      if (leagueId != null) {
        queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(leagueId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.league(leagueId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.leagueRankingsPrefix(leagueId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.leagueManagerRankingsPrefix(leagueId) });
      }
      if (clubId != null) {
        queryClient.invalidateQueries({ queryKey: queryKeys.clubMatches(clubId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.club(clubId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.clubRankingsPrefix(clubId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.clubAggregates(clubId) });
      }
      onMatchDeleted?.();
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

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("text-red-600 hover:text-red-700", className)}>
          <Trash2 className="h-4 w-4 mr-1" />
          {t("match.delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("match.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {t("match.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMatchMutation.mutate()}
            disabled={deleteMatchMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteMatchMutation.isPending ? t("common.deleting") : t("match.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
