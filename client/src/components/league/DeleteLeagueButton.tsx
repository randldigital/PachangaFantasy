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
import { useLocation } from "wouter";
import { Trash2 } from "lucide-react";
import type { League } from "@shared/schema";

interface DeleteLeagueButtonProps {
  league: League;
  isLeagueCreator: boolean;
}

export default function DeleteLeagueButton({ league, isLeagueCreator }: DeleteLeagueButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const deleteLeagueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/leagues/${league.id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("league.deleted"),
        description: t("league.deletedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setLocation("/overview");
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

  if (!isLeagueCreator) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{t("league.delete")}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("league.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {t("league.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteLeagueMutation.mutate()}
            disabled={deleteLeagueMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteLeagueMutation.isPending ? t("league.deleting") : t("league.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
