import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Key, Users, BarChart3, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { League } from '@shared/schema';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: leagues, isLoading, error } = useQuery<League[]>({
    queryKey: ['/api/leagues'],
    queryFn: getQueryFn({ on401: "throw" }),
    retry: 1,
    enabled: !!user, // Only fetch when user is authenticated
  });

  console.log('Dashboard render:', { 
    user: !!user, 
    leagues: leagues?.length, 
    isLoading, 
    error: error?.message,
    hasToken: !!localStorage.getItem('token')
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-blue mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <p className="text-red-400">Error loading dashboard: {error.message}</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-accent-blue';
      case 'voting': return 'text-accent-green';
      case 'closed': return 'text-accent-purple';
      default: return 'text-text-secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return t('status.open');
      case 'voting': return t('status.voting');
      case 'closed': return t('status.closed');
      default: return status;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2">{t('dashboard.title')}</h1>
          <p className="text-text-secondary">{t('dashboard.subtitle')}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/create-league">
            <Card className="bg-gradient-to-br from-accent-blue/10 to-accent-purple/10 border border-accent-blue/20 rounded-2xl hover:border-accent-blue/40 transition-all duration-300 cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-accent-blue/20 rounded-xl flex items-center justify-center group-hover:bg-accent-blue/30 transition-colors">
                    <Plus className="w-6 h-6 text-accent-blue" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{t('dashboard.createNew')}</h3>
                    <p className="text-text-secondary">{t('dashboard.createNewDesc')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/join-league">
            <Card className="bg-gradient-to-br from-accent-green/10 to-accent-blue/10 border border-accent-green/20 rounded-2xl hover:border-accent-green/40 transition-all duration-300 cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-accent-green/20 rounded-xl flex items-center justify-center group-hover:bg-accent-green/30 transition-colors">
                    <Key className="w-6 h-6 text-accent-green" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{t('dashboard.joinWithCode')}</h3>
                    <p className="text-text-secondary">{t('dashboard.joinWithCodeDesc')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* My Leagues */}
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-6">{t('dashboard.myLeagues')}</h2>
          {leagues && leagues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagues.map((league) => {
                const isAdmin = league.createdBy === user?.id;
                return (
                  <Card key={league.id} className="bg-secondary/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl hover:border-accent-blue/40 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-text-primary">{league.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${isAdmin ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-purple/20 text-accent-purple'}`}>
                          {isAdmin ? 'Admin' : 'Player'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-text-secondary">
                        <div className="flex justify-between">
                          <span>{t('dashboard.participants')}:</span>
                          <span className="text-text-primary">{league.participants.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('dashboard.status')}:</span>
                          <span className={getStatusColor(league.status)}>{getStatusText(league.status)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('dashboard.code')}:</span>
                          <span className="text-accent-purple font-mono">{league.inviteCode}</span>
                        </div>
                      </div>
                      <Link href={`/league/${league.id}`}>
                        <Button className="w-full mt-4 bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20 transition-colors">
                          {league.status === 'closed' ? t('dashboard.viewResults') : t('dashboard.manage')}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-secondary/30 border border-gray-600/50 rounded-2xl">
              <CardContent className="p-12 text-center">
                <Trophy className="w-16 h-16 text-accent-blue/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">No leagues yet</h3>
                <p className="text-text-secondary mb-6">Create your first league or join one with an invite code</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/create-league">
                    <Button className="bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20">
                      Create League
                    </Button>
                  </Link>
                  <Link href="/join-league">
                    <Button className="bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green/20">
                      Join League
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
