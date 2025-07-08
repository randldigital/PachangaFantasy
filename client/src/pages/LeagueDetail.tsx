import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertPlayerSchema, type InsertPlayer, type League, type Player } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, Copy, Plus, Play, StopCircle } from 'lucide-react';

const playerEmojis = ['⚽', '🏃', '🛡️', '🎯', '🥅', '⚡', '🔥', '💎', '👑', '🌟'];


export default function LeagueDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const { data: league, isLoading: leagueLoading } = useQuery<League>({
    queryKey: ['/api/leagues', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/leagues/${id}`);
      return response.json();
    },
  });

  const { data: players, isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ['/api/players', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/players/${id}`);
      return response.json();
    },
  });

  const form = useForm<InsertPlayer>({
    resolver: zodResolver(insertPlayerSchema),
    defaultValues: {
      name: '',
      position: 'forward',
      emoji: '⚽',
    },
  });

  const addPlayerMutation = useMutation({
    mutationFn: async (data: InsertPlayer) => {
      const response = await apiRequest('POST', `/api/players/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players', id] });
      toast({
        title: t('common.success'),
        description: 'Player added successfully',
      });
      form.reset();
      setShowAddPlayer(false);
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: 'Failed to add player',
        variant: 'destructive',
      });
    },
  });

  const closeVotingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/tierlist/${id}/close`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues', id] });
      toast({
        title: t('common.success'),
        description: 'Voting closed and market values calculated',
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: 'Failed to close voting',
        variant: 'destructive',
      });
    },
  });

  const joinLeagueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/leagues/${id}/join`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues', id] });
      toast({
        title: t('common.success'),
        description: 'Successfully joined league',
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: 'Failed to join league',
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

  if (!league) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-text-primary">League not found</h1>
      </div>
    );
  }

  const isAdmin = league.createdBy === user?.id;

  const copyInviteCode = () => {
    navigator.clipboard.writeText(league.inviteCode);
    toast({
      title: t('common.success'),
      description: 'Invite code copied to clipboard',
    });
  };

  const onSubmit = (data: InsertPlayer) => {
    addPlayerMutation.mutate(data);
  };

  const handleCloseVoting = () => {
    closeVotingMutation.mutate();
  };

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* League Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2">{league.name}</h1>
          <div className="flex items-center justify-center space-x-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(league.status)} bg-current bg-opacity-10`}>
              {getStatusText(league.status)}
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-text-secondary">Code:</span>
              <span className="font-mono text-accent-purple">{league.inviteCode}</span>
              <Button variant="ghost" size="sm" onClick={copyInviteCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Join League or Start Ranking Actions */}
        {!league.participants.includes(user?.id || 0) && league.status === 'open' && (
          <div className="text-center">
            <Button
              onClick={() => {
                joinLeagueMutation.mutate();
              }}
              disabled={joinLeagueMutation.isPending}
              className="bg-accent-green hover:bg-accent-green/80 text-white font-semibold py-3 px-8 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300"
            >
              <Users className="w-5 h-5 mr-2" />
              {joinLeagueMutation.isPending ? t('common.loading') : 'Join League as Player'}
            </Button>
          </div>
        )}

        {league.participants.includes(user?.id || 0) && league.status === 'open' && (
          <div className="text-center">
            <Link href={`/tierlist/${league.id}`}>
              <Button className="bg-accent-purple hover:bg-accent-purple/80 text-white font-semibold py-3 px-8 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                <Play className="w-5 h-5 mr-2" />
                {t('league.startRanking')}
              </Button>
            </Link>
          </div>
        )}

        {/* League Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 border border-accent-blue/30">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-accent-blue mx-auto mb-2" />
              <div className="text-2xl font-bold text-text-primary">{league.participants.length}</div>
              <div className="text-text-secondary">{t('dashboard.participants')}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent-green/10 to-accent-green/5 border border-accent-green/30">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-accent-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-text-primary">{players?.length || 0}</div>
              <div className="text-text-secondary">Players</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent-purple/10 to-accent-purple/5 border border-accent-purple/30">
            <CardContent className="p-6 text-center">
              <div className={`w-8 h-8 mx-auto mb-2 ${getStatusColor(league.status)}`}>
                {league.status === 'open' && <Play className="w-8 h-8" />}
                {league.status === 'voting' && <StopCircle className="w-8 h-8" />}
                {league.status === 'closed' && <Users className="w-8 h-8" />}
              </div>
              <div className="text-2xl font-bold text-text-primary">{getStatusText(league.status)}</div>
              <div className="text-text-secondary">{t('dashboard.status')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Players Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Players</h2>
            {isAdmin && league.status === 'open' && (
              <Button
                onClick={() => setShowAddPlayer(true)}
                className="bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('league.addPlayer')}
              </Button>
            )}
          </div>

          {showAddPlayer && (
            <Card className="mb-6 bg-secondary/50 border border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-text-primary">{t('league.addPlayer')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">{t('league.playerName')}</Label>
                      <Input
                        {...form.register('name')}
                        className="bg-transparent border-gray-600 focus:border-accent-blue"
                        placeholder="Player name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="emoji">{t('league.playerEmoji')}</Label>
                      <Select onValueChange={(value) => form.setValue('emoji', value)}>
                        <SelectTrigger className="bg-transparent border-gray-600">
                          <SelectValue placeholder="Select emoji" />
                        </SelectTrigger>
                        <SelectContent>
                          {playerEmojis.map(emoji => (
                            <SelectItem key={emoji} value={emoji}>
                              {emoji}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      type="submit"
                      disabled={addPlayerMutation.isPending}
                      className="bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20"
                    >
                      {addPlayerMutation.isPending ? t('common.loading') : t('league.addPlayer')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAddPlayer(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {players && players.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {players.map(player => (
                <Card key={player.id} className="bg-secondary/50 border border-gray-700/50 hover:border-accent-blue/40 transition-colors">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-accent-blue to-accent-purple rounded-full mx-auto mb-2 flex items-center justify-center text-xl">
                      {player.emoji}
                    </div>
                    <h3 className="font-semibold text-text-primary text-sm">{player.name}</h3>
                    {player.marketValue > 0 && (
                      <p className="text-accent-green font-bold text-sm mt-1">€{player.marketValue}M</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-secondary/30 border border-gray-600/50">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-accent-blue/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8 text-accent-blue" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">No players added yet</h3>
                <p className="text-text-secondary">Add players to start the tier list voting</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        {league.status === 'closed' ? (
          <div className="text-center">
            <Link href={`/results/${id}`}>
              <Button className="bg-gradient-to-r from-accent-purple to-accent-blue text-white font-semibold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-accent-purple/25 transform hover:scale-105 transition-all duration-300">
                {t('dashboard.viewResults')}
              </Button>
            </Link>
          </div>
        ) : players && players.length > 0 ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/tierlist/${id}`}>
              <Button className="bg-gradient-to-r from-accent-green to-accent-blue text-white font-semibold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-accent-green/25 transform hover:scale-105 transition-all duration-300">
                {league.status === 'voting' ? 'Submit Tier List' : 'Create Tier List'}
              </Button>
            </Link>
            {isAdmin && league.status === 'voting' && (
              <Button
                onClick={handleCloseVoting}
                disabled={closeVotingMutation.isPending}
                className="bg-gradient-to-r from-accent-purple to-accent-blue text-white font-semibold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-accent-purple/25 transform hover:scale-105 transition-all duration-300"
              >
                {closeVotingMutation.isPending ? t('common.loading') : t('league.closeVoting')}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
