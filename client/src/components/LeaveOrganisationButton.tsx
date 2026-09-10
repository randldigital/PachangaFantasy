import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

interface LeaveOrganisationButtonProps {
  kind: "league" | "club";
  organisationId: number;
}

export default function LeaveOrganisationButton({
  kind,
  organisationId,
}: LeaveOrganisationButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const isClub = kind === "club";

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const path = isClub ? `/api/clubs/${organisationId}/leave` : `/api/leagues/${organisationId}/leave`;
      return apiRequest("POST", path);
    },
    onSuccess: () => {
      toast({
        title: t("membership.left"),
        description: t("membership.leftDescription"),
      });
      queryClient.invalidateQueries({ queryKey: isClub ? queryKeys.clubs : queryKeys.leagues });
      setLocation("/overview");
      setOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-orange-400 hover:text-orange-300">
          <LogOut className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{t("membership.leave")}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("membership.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {t("membership.leaveDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {leaveMutation.isPending ? t("membership.leaving") : t("membership.leave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
