import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { InsertLeague } from "@shared/schema";

interface CreateLeagueFormProps {
  onSuccess?: () => void;
}

export default function CreateLeagueForm({ onSuccess }: CreateLeagueFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const createLeagueMutation = useMutation({
    mutationFn: async (data: InsertLeague) => {
      return apiRequest('/api/leagues', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: t('league.created'),
        description: t('league.createdDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('league.createError'),
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    createLeagueMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-white">
          {t('league.name')} *
        </Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder={t('league.namePlaceholder')}
          className="bg-slate-900 border-slate-600 text-white placeholder-slate-400"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-white">
          {t('league.description')}
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder={t('league.descriptionPlaceholder')}
          className="bg-slate-900 border-slate-600 text-white placeholder-slate-400"
          rows={3}
        />
      </div>

      <Button
        type="submit"
        disabled={createLeagueMutation.isPending || !formData.name.trim()}
        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
      >
        {createLeagueMutation.isPending ? t('common.creating') : t('league.createLeague')}
      </Button>
    </form>
  );
}