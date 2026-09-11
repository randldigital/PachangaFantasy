import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/apiError";

export default function MembershipJoinToggle({
  kind,
  organisationId,
  joinOpen,
}: {
  kind: "league" | "club";
  organisationId: number;
  joinOpen: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      api.post(`/api/${kind === "league" ? "leagues" : "clubs"}/${organisationId}/membership`, {
        joinOpen: next,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: kind === "league" ? queryKeys.league(organisationId) : queryKeys.club(organisationId),
      });
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
        aria-label={t("membership.joinOpenLabel")}
      />
      <Label className="text-slate-300 text-xs sm:text-sm">
        {joinOpen ? t("membership.joinOpen") : t("membership.joinClosed")}
      </Label>
    </div>
  );
}
