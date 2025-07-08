import { useParams } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { type League, type Player } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, BarChart3, DollarSign, Crown, Share, Download, RotateCcw } from 'lucide-react';

export default function Results() {
  const { id } = useParams();
  const { t } = useTranslation();

  const { data: league, isLoading: leagueLoading } = useQuery<League>({
    queryKey: ['/api/leagues', id],
  });

  const { data: players, isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ['/api/players', id],
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

  const sortedPlayers = [...players].sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
  const topThree = sortedPlayers.slice(0, 3);
  const restOfPlayers = sortedPlayers.slice(3);
  const totalValue = players.reduce((sum, player) => sum + (player.marketValue || 0), 0);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bgClass: 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10',
          borderClass: 'border-2 border-yellow-500/50',
          numberBg: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
          accentColor: 'text-yellow-400',
        };
      case 2:
        return {
          bgClass: 'bg-gradient-to-br from-gray-400/20 to-gray-500/10',
          borderClass: 'border-2 border-gray-400/50',
          numberBg: 'bg-gradient-to-br from-gray-400 to-gray-600',
          accentColor: 'text-gray-400',
        };
      case 3:
        return {
          bgClass: 'bg-gradient-to-br from-amber-600/20 to-amber-700/10',
          borderClass: 'border-2 border-amber-600/50',
          numberBg: 'bg-gradient-to-br from-amber-600 to-amber-800',
          accentColor: 'text-amber-600',
        };
      default:
        return {
          bgClass: 'bg-secondary/50',
          borderClass: 'border border-gray-600/50',
          numberBg: 'bg-accent-blue/20',
          accentColor: 'text-accent-blue',
        };
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2">{t('results.title')}</h1>
          <p className="text-text-secondary">
            {t('league.name')}: <span className="text-accent-green font-semibold">{league.name}</span>
          </p>
          <p className="text-text-secondary text-sm mt-1">{t('results.subtitle')}</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 border border-accent-blue/30">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-accent-blue mx-auto mb-2" />
              <div className="text-2xl font-bold text-text-primary">{league.participants.length}</div>
              <div className="text-text-secondary">{t('results.participants')}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent-green/10 to-accent-green/5 border border-accent-green/30">
            <CardContent className="p-6 text-center">
              <BarChart3 className="w-8 h-8 text-accent-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-text-primary">{players.length}</div>
              <div className="text-text-secondary">{t('results.playersEvaluated')}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent-purple/10 to-accent-purple/5 border border-accent-purple/30">
            <CardContent className="p-6 text-center">
              <DollarSign className="w-8 h-8 text-accent-purple mx-auto mb-2" />
              <div className="text-2xl font-bold text-text-primary">€{totalValue}M</div>
              <div className="text-text-secondary">{t('results.totalValue')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Final Ranking */}
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-6">{t('results.finalRanking')}</h2>

          {/* Top 3 Players */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {topThree.map((player, index) => {
              const rank = index + 1;
              const style = getRankStyle(rank);
              return (
                <div key={player.id} className={`${style.bgClass} ${style.borderClass} rounded-2xl p-6 text-center relative overflow-hidden`}>
                  {rank === 1 && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center">
                        <Crown className="w-3 h-3 mr-1" />
                        {t('results.mvp')}
                      </span>
                    </div>
                  )}
                  <div className="w-20 h-20 bg-gradient-to-br from-accent-blue to-accent-purple rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">
                    {player.emoji}
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-1">{player.name}</h3>
                  <p className={`${style.accentColor} font-semibold mb-2`}>{t(`positions.${player.position}`)}</p>
                  <div className={`text-3xl font-bold ${style.accentColor} mb-1`}>€{player.marketValue}M</div>
                  <p className="text-text-secondary text-sm">Rank #{rank}</p>
                </div>
              );
            })}
          </div>

          {/* Rest of Players */}
          {restOfPlayers.length > 0 && (
            <Card className="bg-secondary/30 border border-gray-600/50 rounded-2xl overflow-hidden">
              <div className="bg-secondary/50 px-6 py-4 border-b border-gray-600/50">
                <h3 className="text-lg font-semibold text-text-primary">{t('results.restOfPlayers')}</h3>
              </div>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {restOfPlayers.map((player, index) => {
                    const rank = index + 4;
                    return (
                      <div key={player.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl hover:bg-secondary/70 transition-colors">
                        <div className="flex items-center space-x-4">
                          <span className="w-8 h-8 bg-accent-blue/20 rounded-full flex items-center justify-center text-accent-blue font-semibold text-sm">
                            {rank}
                          </span>
                          <div className="w-10 h-10 bg-gradient-to-br from-accent-purple to-accent-green rounded-full flex items-center justify-center text-xl">
                            {player.emoji}
                          </div>
                          <div>
                            <h4 className="font-semibold text-text-primary">{player.name}</h4>
                            <p className="text-text-secondary text-sm">{t(`positions.${player.position}`)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-accent-blue">€{player.marketValue}M</div>
                          <p className="text-text-secondary text-sm">Rank #{rank}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Export/Share Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
          <Button className="bg-accent-blue/10 border border-accent-blue/30 text-accent-blue font-semibold py-3 px-6 rounded-xl hover:bg-accent-blue/20 transition-colors">
            <Download className="w-4 h-4 mr-2" />
            {t('results.export')}
          </Button>
          <Button className="bg-accent-green/10 border border-accent-green/30 text-accent-green font-semibold py-3 px-6 rounded-xl hover:bg-accent-green/20 transition-colors">
            <Share className="w-4 h-4 mr-2" />
            {t('results.share')}
          </Button>
          <Button className="bg-accent-purple/10 border border-accent-purple/30 text-accent-purple font-semibold py-3 px-6 rounded-xl hover:bg-accent-purple/20 transition-colors">
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('results.newLeague')}
          </Button>
        </div>
      </div>
    </div>
  );
}
