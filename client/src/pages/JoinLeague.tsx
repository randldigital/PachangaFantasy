import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { joinLeagueSchema, type JoinLeagueInput } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function JoinLeague() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<JoinLeagueInput>({
    resolver: zodResolver(joinLeagueSchema),
    defaultValues: {
      inviteCode: '',
    },
  });

  const joinLeagueMutation = useMutation({
    mutationFn: async (data: JoinLeagueInput) => {
      const response = await apiRequest('POST', `/api/leagues/${data.inviteCode}/join`, {});
      return response.json();
    },
    onSuccess: (league) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      toast({
        title: t('common.success'),
        description: `Joined league: ${league.name}`,
      });
      setLocation(`/league/${league.id}`);
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: 'Failed to join league. Check the invite code.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: JoinLeagueInput) => {
    joinLeagueMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-primary">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2">{t('league.join')}</h1>
          <p className="text-text-secondary">Enter the invite code to join a league</p>
        </div>

        <Card className="bg-secondary/50 backdrop-blur-sm border border-gray-700/50">
          <CardHeader>
            <CardTitle className="text-text-primary">{t('league.join')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="inviteCode" className="text-text-secondary">
                  {t('league.inviteCode')}
                </Label>
                <Input
                  {...form.register('inviteCode')}
                  type="text"
                  className="mt-1 bg-transparent border-gray-600 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue font-mono uppercase"
                  placeholder="ABC123"
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    form.setValue('inviteCode', e.target.value);
                  }}
                />
                {form.formState.errors.inviteCode && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.inviteCode.message}</p>
                )}
              </div>

              <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-accent-green mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-accent-green">How to Join</h3>
                    <p className="text-sm text-text-secondary mt-1">
                      Ask the league admin for the 6-character invite code. Once you join, you'll be able to participate in tier list voting.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={joinLeagueMutation.isPending}
                className="w-full bg-gradient-to-r from-accent-green to-accent-blue text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg hover:shadow-accent-green/25 transform hover:scale-105 transition-all duration-300"
              >
                {joinLeagueMutation.isPending ? t('common.loading') : t('league.joinButton')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
