import React from 'react';
import { useParams, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insertTierListSchema, type InsertTierList, type League, type Player, type TierList as TierListType } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import TierList from '@/components/TierList';
import { useToast } from '@/hooks/use-toast';

export default function TierListPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: league, isLoading: leagueLoading } = useQuery<League>({
    queryKey: ['/api/leagues', id],
  });

  const { data: players, isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ['/api/players', id],
  });

  const { data: existingTierList } = useQuery<TierListType | null>({
    queryKey: ['/api/tierlist', id],
  });

  const submitTierListMutation = useMutation({
    mutationFn: async (playerOrder: number[]) => {
      const data: InsertTierList = { 
        playerOrder,
        submitted: true 
      };
      const response = await apiRequest('POST', `/api/tierlist/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tierlist', id] });
      toast({
        title: t('common.success'),
        description: 'Tier list submitted successfully',
      });
      setLocation(`/league/${id}`);
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: 'Failed to submit tier list',
        variant: 'destructive',
      });
    },
  });

  if (leagueLoading || playersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-blue"></div>
      </div>
    );
  }

  if (!league || !players) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-text-primary">League or players not found</h1>
      </div>
    );
  }

  if (existingTierList?.submitted) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-text-primary">{t('tierlist.title')}</h1>
          <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-accent-green mb-2">Tier List Already Submitted</h2>
            <p className="text-text-secondary">
              You have already submitted your tier list for this league. Wait for the admin to close voting to see the results.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = (ranking: number[]) => {
    submitTierListMutation.mutate(ranking);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2">{t('tierlist.title')}</h1>
          <p className="text-text-secondary">
            {t('league.name')}: <span className="text-accent-blue font-semibold">{league.name}</span>
          </p>
          <p className="text-text-secondary text-sm mt-1">{t('tierlist.subtitle')}</p>
        </div>

        {/* Instructions */}
        <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-accent-blue mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-accent-blue">{t('tierlist.instructions')}</h3>
              <p className="text-sm text-text-secondary mt-1">
                {t('tierlist.instructionsText')}
              </p>
            </div>
          </div>
        </div>

        <TierList players={players} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
