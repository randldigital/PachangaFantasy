import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface JoinLeagueFormProps {
  onSuccess?: () => void;
}

export default function JoinLeagueForm({ onSuccess }: JoinLeagueFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState('');

  const joinLeagueMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      return apiRequest('POST', `/api/leagues/${inviteCode}/join`);
    },
    onSuccess: () => {
      toast({
        title: t('league.joined'),
        description: t('league.joinedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('league.joinError'),
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    joinLeagueMutation.mutate(inviteCode.trim().toUpperCase());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inviteCode" className="text-white">
          {t('league.inviteCode')} *
        </Label>
        <Input
          id="inviteCode"
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder={t('league.inviteCodePlaceholder')}
          className="bg-slate-900 border-slate-600 text-white placeholder-slate-400 font-mono"
          required
        />
      </div>

      <Button
        type="submit"
        disabled={joinLeagueMutation.isPending || !inviteCode.trim()}
        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
      >
        {joinLeagueMutation.isPending ? t('common.joining') : t('league.joinLeague')}
      </Button>
    </form>
  );
}