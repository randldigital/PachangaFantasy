import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

interface CreateClubFormProps {
  onSuccess?: () => void;
}

export default function CreateClubForm({ onSuccess }: CreateClubFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ name: "", description: "", alias: "" });

  const createClubMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; alias: string }) => {
      const response = await apiRequest("POST", "/api/clubs", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t("club.created"), description: t("club.createdDescription") });
      queryClient.invalidateQueries({ queryKey: queryKeys.clubs });
      onSuccess?.();
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t) || t("club.createError"),
        variant: "destructive",
      });
    },
  });

  const handleChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.alias.trim()) return;
    createClubMutation.mutate({
      name: formData.name.trim(),
      description: formData.description.trim(),
      alias: formData.alias.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="clubName" className="text-white">
          {t("club.name")} *
        </Label>
        <Input
          id="clubName"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder={t("club.namePlaceholder")}
          className="bg-slate-900 border-slate-600 text-white placeholder-slate-400"
          maxLength={25}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="clubDescription" className="text-white">
          {t("club.description")}
        </Label>
        <Textarea
          id="clubDescription"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder={t("club.descriptionPlaceholder")}
          className="bg-slate-900 border-slate-600 text-white placeholder-slate-400"
          maxLength={200}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="clubAlias" className="text-white">
          {t("alias.label")} *
        </Label>
        <Input
          id="clubAlias"
          type="text"
          value={formData.alias}
          onChange={(e) => handleChange("alias", e.target.value)}
          placeholder={t("alias.placeholder")}
          className="bg-slate-900 border-slate-600 text-white placeholder-slate-400"
          maxLength={30}
          required
        />
        <p className="text-xs text-slate-400">{t("alias.hint")}</p>
      </div>

      <Button
        type="submit"
        disabled={createClubMutation.isPending || !formData.name.trim() || !formData.alias.trim()}
        className="w-full bg-sky-600 hover:bg-sky-700"
      >
        {createClubMutation.isPending ? t("common.creating") : t("club.createClub")}
      </Button>
    </form>
  );
}
