import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { UserPlus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/queryClient';

interface AddMyselfAsPlayerButtonProps {
  leagueId: number;
}

export default function AddMyselfAsPlayerButton({ leagueId }: AddMyselfAsPlayerButtonProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Check if user is already a player
  const { data: userPlayerStatus } = useQuery({
    queryKey: ['userPlayerStatus', leagueId],
    queryFn: async () => {
      const response = await fetch(`/api/leagues/${leagueId}/check-user-player`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to check user player status');
      return response.json();
    }
  });

  // Add user as player mutation
  const addMyselfMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/leagues/${leagueId}/add-me-as-player`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['userPlayerStatus', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['/api/players', leagueId] });
    }
  });

  const handleAddMyself = () => {
    addMyselfMutation.mutate();
  };

  // Don't show if user is already a player
  if (userPlayerStatus?.isPlayer) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center px-4 py-2 rounded-lg bg-accent-green/20 text-accent-green border border-accent-green/30">
          <Check className="w-4 h-4 mr-2" />
          You are already a player in this league
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Button
        onClick={handleAddMyself}
        disabled={addMyselfMutation.isPending}
        className="bg-accent-purple hover:bg-accent-purple/80 text-white font-semibold py-3 px-8 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300"
      >
        <UserPlus className="w-5 h-5 mr-2" />
        {addMyselfMutation.isPending ? t('common.loading') : 'Add myself as player in this league'}
      </Button>
      
      {addMyselfMutation.error && (
        <div className="mt-2 text-red-400 text-sm">
          {(addMyselfMutation.error as any)?.message || 'Failed to add yourself as player'}
        </div>
      )}
    </div>
  );
}