import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

interface CreateClubMatchFormProps {
  clubId: number;
  onSuccess?: () => void;
}

export default function CreateClubMatchForm({ clubId, onSuccess }: CreateClubMatchFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    opponentName: "",
  });

  const createMatchMutation = useMutation({
    mutationFn: async (data: { clubId: number; date: string; opponentName?: string }) => {
      const response = await apiRequest("POST", "/api/matches", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("match.created"),
        description: t("match.createdDescription"),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.clubMatches(clubId) });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t) || t("match.createError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.date || !formData.time) return;

    const opponentName = formData.opponentName.trim();
    createMatchMutation.mutate({
      clubId,
      date: new Date(`${formData.date}T${formData.time}`).toISOString(),
      ...(opponentName ? { opponentName } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="club-match-date" className="text-white">
            {t("match.date")} *
          </Label>
          <Input
            id="club-match-date"
            type="date"
            value={formData.date}
            onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
            className="bg-slate-900 border-slate-600 text-white"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="club-match-time" className="text-white">
            {t("match.time")} *
          </Label>
          <Input
            id="club-match-time"
            type="time"
            value={formData.time}
            onChange={(event) => setFormData((prev) => ({ ...prev, time: event.target.value }))}
            className="bg-slate-900 border-slate-600 text-white"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="club-match-opponent" className="text-white">
          {t("club.opponentName")}
        </Label>
        <Input
          id="club-match-opponent"
          value={formData.opponentName}
          onChange={(event) => setFormData((prev) => ({ ...prev, opponentName: event.target.value }))}
          maxLength={40}
          placeholder={t("club.opponentPlaceholder")}
          className="bg-slate-900 border-slate-600 text-white"
        />
        <p className="text-xs text-slate-400">{t("club.opponentNameOptional")}</p>
      </div>

      <Button
        type="submit"
        disabled={createMatchMutation.isPending || !formData.date || !formData.time}
        title={!formData.date || !formData.time ? t("match.dateTimeRequired") : undefined}
        className="w-full bg-sky-600 hover:bg-sky-700"
      >
        {createMatchMutation.isPending ? t("common.creating") : t("match.createMatch")}
      </Button>
      {(!formData.date || !formData.time) && (
        <p className="text-xs text-slate-400 text-center">{t("match.dateTimeRequired")}</p>
      )}
    </form>
  );
}
