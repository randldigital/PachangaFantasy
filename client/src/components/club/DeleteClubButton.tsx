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
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Trash2 } from "lucide-react";
import type { Club } from "@shared/schema";

interface DeleteClubButtonProps {
  club: Club;
  isClubCreator: boolean;
}

export default function DeleteClubButton({ club, isClubCreator }: DeleteClubButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const deleteClubMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/clubs/${club.id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("club.deleted"),
        description: t("club.deletedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.clubs });
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

  if (!isClubCreator) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{t("club.delete")}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("club.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {t("club.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteClubMutation.mutate()}
            disabled={deleteClubMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteClubMutation.isPending ? t("club.deleting") : t("club.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
