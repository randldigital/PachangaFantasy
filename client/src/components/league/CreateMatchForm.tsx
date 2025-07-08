import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { InsertMatch } from "@shared/schema";

interface CreateMatchFormProps {
  leagueId: number;
  onSuccess?: () => void;
}

export default function CreateMatchForm({ leagueId, onSuccess }: CreateMatchFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    lineupBudget: 100
  });

  const createMatchMutation = useMutation({
    mutationFn: async (data: InsertMatch) => {
      return apiRequest('POST', '/api/matches', data);
    },
    onSuccess: () => {
      toast({
        title: t('match.created'),
        description: t('match.createdDescription'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/leagues/${leagueId}/matches`] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('match.createError'),
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
      lineupBudget: formData.lineupBudget
    });
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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
      </div>

      <Button
        type="submit"
        disabled={createMatchMutation.isPending || !formData.date || !formData.time}
        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
      >
        {createMatchMutation.isPending ? t('common.creating') : t('match.createMatch')}
      </Button>
    </form>
  );
}