import { useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertLeagueSchema, type InsertLeague } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function CreateLeague() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertLeague>({
    resolver: zodResolver(insertLeagueSchema),
    defaultValues: {
      name: '',
    },
  });

  const createLeagueMutation = useMutation({
    mutationFn: async (data: InsertLeague) => {
      const response = await apiRequest('POST', '/api/leagues', data);
      return response.json();
    },
    onSuccess: (league) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      toast({
        title: t('common.success'),
        description: `League created with code: ${league.inviteCode}`,
      });
      setLocation(`/league/${league.id}`);
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: 'Failed to create league',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: InsertLeague) => {
    createLeagueMutation.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2">{t('league.create')}</h1>
          <p className="text-text-secondary">Set up your fantasy league and invite friends</p>
        </div>

        <Card className="bg-secondary/50 backdrop-blur-sm border border-gray-700/50">
          <CardHeader>
            <CardTitle className="text-text-primary">{t('league.create')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-text-secondary">
                  {t('league.name')}
                </Label>
                <Input
                  {...form.register('name')}
                  type="text"
                  className="mt-1 bg-transparent border-gray-600 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
                  placeholder="Enter league name"
                />
                {form.formState.errors.name && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-accent-blue mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-accent-blue">League Setup</h3>
                    <p className="text-sm text-text-secondary mt-1">
                      After creating the league, you'll be able to add players and share the invite code with participants.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={createLeagueMutation.isPending}
                className="w-full bg-gradient-to-r from-accent-blue to-accent-purple text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg hover:shadow-accent-blue/25 transform hover:scale-105 transition-all duration-300"
              >
                {createLeagueMutation.isPending ? t('common.loading') : t('league.createButton')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
