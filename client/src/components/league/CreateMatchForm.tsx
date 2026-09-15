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
import { DEFAULT_SIDE_SIZE, SIDE_SIZES, type SideSize } from "@shared/domain/teams";
import { Switch } from "@/components/ui/switch";
import { formatDisplayMarketValue } from "@shared/domain/displayValue";

interface CreateMatchFormProps {
  leagueId: number;
  onSuccess?: () => void;
}

export default function CreateMatchForm({ leagueId, onSuccess }: CreateMatchFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<{
    date: string;
    time: string;
    lineupBudget: number;
    sideSize: SideSize;
    joinOpen: boolean;
  }>({
    date: '',
    time: '',
    lineupBudget: 100,
    sideSize: DEFAULT_SIDE_SIZE,
    joinOpen: true,
  });

  const createMatchMutation = useMutation({
    mutationFn: async (data: {
      leagueId: number;
      date: string;
      lineupBudget: number;
      sideSize: SideSize;
      joinOpen: boolean;
    }) => {
      const response = await apiRequest('POST', '/api/matches', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('match.created'),
        description: t('match.createdDescription'),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.leagueMatches(leagueId) });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: describeApiError(error, t) || t('match.createError'),
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.time) return;
    
    // Combine date and time
    const matchDate = new Date(`${formData.date}T${formData.time}`);
    
    createMatchMutation.mutate({
      leagueId,
      date: matchDate.toISOString(),
      lineupBudget: formData.lineupBudget,
      sideSize: formData.sideSize,
      joinOpen: formData.joinOpen,
    });
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date" className="text-white">
            {t('match.date')} *
          </Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => handleChange('date', e.target.value)}
            className="bg-slate-900 border-slate-600 text-white"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="time" className="text-white">
            {t('match.time')} *
          </Label>
          <Input
            id="time"
            type="time"
            value={formData.time}
            onChange={(e) => handleChange('time', e.target.value)}
            className="bg-slate-900 border-slate-600 text-white"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-white">{t('match.sideSize')} *</Label>
        <div className="grid grid-cols-3 gap-2">
          {SIDE_SIZES.map((size) => (
            <Button
              key={size}
              type="button"
              variant={formData.sideSize === size ? 'default' : 'outline'}
              className={
                formData.sideSize === size
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'border-slate-600 text-slate-200 hover:bg-slate-700'
              }
              onClick={() => setFormData((prev) => ({ ...prev, sideSize: size }))}
            >
              {t('match.sideSizeOption', { size })}
            </Button>
          ))}
        </div>
        <p className="text-xs text-slate-400">{t('match.sideSizeHint')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="budget" className="text-white">
          {t('match.lineupBudget')}
        </Label>
        <Input
          id="budget"
          type="number"
          value={formData.lineupBudget}
          onChange={(e) => handleChange('lineupBudget', parseInt(e.target.value))}
          className="bg-slate-900 border-slate-600 text-white"
          min="50"
          max="200"
        />
        <p className="text-xs text-slate-400">
          {t("match.lineupBudgetHint", { display: formatDisplayMarketValue(formData.lineupBudget) })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="match-join-open"
          checked={formData.joinOpen}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, joinOpen: checked }))}
        />
        <Label htmlFor="match-join-open" className="text-white text-sm">
          {formData.joinOpen ? t("match.joinOpen") : t("match.joinClosed")}
        </Label>
      </div>
      <p className="text-xs text-slate-400">{t("match.joinOpenHint")}</p>

      <Button
        type="submit"
        disabled={createMatchMutation.isPending || !formData.date || !formData.time}
        title={!formData.date || !formData.time ? t("match.dateTimeRequired") : undefined}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {createMatchMutation.isPending ? t('common.creating') : t('match.createMatch')}
      </Button>
      {(!formData.date || !formData.time) && (
        <p className="text-xs text-slate-400 text-center">{t("match.dateTimeRequired")}</p>
      )}
    </form>
  );
}