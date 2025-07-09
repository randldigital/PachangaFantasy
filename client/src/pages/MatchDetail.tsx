import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Users, Target, Trophy, Clock } from 'lucide-react';
import EndMatchButton from '@/components/league/EndMatchButton';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import AdminGoalValidation from '@/components/league/AdminGoalValidation';
import SubmitMyStats from '@/components/league/SubmitMyStats';
import AdminStatsOverview from '@/components/league/AdminStatsOverview';
import type { Match, MatchParticipant, Player, StatReport } from '@shared/schema';

interface MatchWithParticipants extends Match {
  participants: MatchParticipant[];
}

export default function MatchDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: match, isLoading: matchLoading, error: matchError } = useQuery<MatchWithParticipants>({
    queryKey: ['/api/matches', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/matches/${id}`);
      return response.json();
    },
    retry: (failureCount, error) => {
      // Don't retry if it's a 404 (match not found)
      if (error?.message?.includes('404')) return false;
      return failureCount < 3;
    },
  });

  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ['/api/players', match?.leagueId],
    queryFn: async () => {
      if (!match?.leagueId) return [];
      const response = await apiRequest('GET', `/api/players/${match.leagueId}`);
      return response.json();
    },
    enabled: !!match?.leagueId,
  });

  const { data: league } = useQuery({
    queryKey: ['/api/leagues', match?.leagueId],
    queryFn: async () => {
      if (!match?.leagueId) return null;
      const response = await apiRequest('GET', `/api/leagues/${match.leagueId}`);
      return response.json();
    },
    enabled: !!match?.leagueId,
  });

  const { data: statReports = [] } = useQuery<StatReport[]>({
    queryKey: ['/api/matches', id, 'stats'],
    queryFn: async () => {
      if (!id) return [];
      const response = await apiRequest('GET', `/api/matches/${id}/stats`);
      return response.json();
    },
    enabled: !!id,
  });

  const joinMatchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/matches/${id}/join`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', id] });
      toast({
        title: 'Success!',
        description: 'You have joined the match',
      });
    },
    onError: async (error: any) => {
      console.error('Join match error:', error);
      try {
        const errorData = await error.json();
        if (errorData.needsPlayerRecord) {
          toast({
            title: 'Player Record Required',
            description: 'You need to add yourself as a player in this league first. Go to the league page and click "Add Me as Player".',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: errorData.message || 'Failed to join match',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to join match',
          variant: 'destructive',
        });
      }
    },
  });

  if (matchLoading) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#e0e0e0] p-6">
        <div className="animate-pulse max-w-4xl mx-auto">
          <div className="h-8 bg-gray-700 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="h-64 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!match || matchError) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#e0e0e0] p-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">
            {matchError?.message?.includes('404') ? 'Match not found or has been deleted' : 'Match not found'}
          </h1>
          <p className="text-gray-400 mb-4">
            The match you're looking for may have been deleted or doesn't exist.
          </p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const isParticipant = match.participants.some(p => p.userId === user?.id);
  const acceptedParticipants = match.participants.filter(p => p.status === 'accepted');
  const teamA = match.matchTeams?.teamA || [];
  const teamB = match.matchTeams?.teamB || [];

  const getPlayersByIds = (playerIds: number[]) => {
    return players.filter(p => playerIds.includes(p.userId || 0));
  };

  return (
    <div className="min-h-screen bg-[#121212] text-[#e0e0e0] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Match Details</h1>
            <div className="flex items-center gap-3">
              {match.status === 'completed' && (
                <div className="flex items-center gap-2 text-green-400">
                  <Trophy className="h-5 w-5" />
                  <span className="text-sm font-medium">Match Completed</span>
                </div>
              )}
              <Badge 
                variant={match.status === 'completed' ? 'default' : 'secondary'}
                className={`${
                  match.status === 'completed' ? 'bg-green-600 animate-pulse' :
                  match.status === 'ready' ? 'bg-blue-600' :
                  'bg-gray-600'
                } text-white font-medium px-3 py-1`}
              >
                {match.status === 'completed' ? '✅ COMPLETED' : 
                 match.status === 'ready' ? '🎯 READY' : 
                 '⏳ OPEN'}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-[#1e1e1e] border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-400">Date</p>
                    <p className="font-semibold">
                      {new Date(match.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1e1e1e] border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-sm text-gray-400">
                      {match.status === 'completed' && match.finalScore !== null ? 'Final Score' : 'Budget'}
                    </p>
                    <p className="font-semibold">
                      {match.status === 'completed' && match.finalScore !== null 
                        ? `${match.finalScore} goals` 
                        : `$${match.lineupBudget}M`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1e1e1e] border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-sm text-gray-400">Participants</p>
                    <p className="font-semibold">{acceptedParticipants.length}/10</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 mb-6">
            {!isParticipant && match.status === 'open' && (
              <Button 
                onClick={() => joinMatchMutation.mutate()}
                disabled={joinMatchMutation.isPending}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              >
                {joinMatchMutation.isPending ? 'Joining...' : 'Join Match'}
              </Button>
            )}
            
            {isParticipant && (
              <>
                {match.status !== 'completed' && (
                  <Button 
                    onClick={() => window.location.href = `/matches/${id}/lineup`}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    Manage Lineup
                  </Button>
                )}
                
                {/* Enhanced stats submission for participants when match is completed */}
                {match.status === 'completed' && (
                  <SubmitMyStats 
                    match={match}
                    userId={user!.id}
                    isParticipant={isParticipant}
                  />
                )}
              </>
            )}
            
            {/* League creator controls */}
            {league?.createdBy === user?.id && (
              <>
                {/* End match button for league creator (shown when match is not completed) */}
                <EndMatchButton 
                  match={match}
                  leagueId={match.leagueId}
                  isLeagueCreator={true}
                />
                
                {/* Stats submission for league creator when match is completed */}
                {match.status === 'completed' && isParticipant && (
                  <SubmitMyStats 
                    match={match}
                    userId={user?.id || 0}
                    isParticipant={isParticipant}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* League Creator Participant Overview */}
        {league?.createdBy === user?.id && match.status === 'completed' && (
          <Card className="mb-6 bg-[#1e1e1e] border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                Participant Stats Submission Status
              </CardTitle>
              <CardDescription>
                Monitor which participants have submitted their match statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {acceptedParticipants.map((participant) => {
                  const player = players.find(p => p.userId === participant.userId);
                  const playerName = player?.name || `User ${participant.userId}`;
                  const hasSubmitted = statReports.some(report => report.userId === participant.userId);
                  
                  return (
                    <div 
                      key={participant.userId}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        hasSubmitted 
                          ? 'bg-green-600/10 border-green-500/30' 
                          : 'bg-yellow-600/10 border-yellow-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{player?.emoji || '👤'}</span>
                        <div>
                          <p className="font-semibold">{playerName}</p>
                          <p className="text-sm text-gray-400">
                            {hasSubmitted ? 'Stats submitted' : 'Pending submission'}
                          </p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        hasSubmitted 
                          ? 'bg-green-600 text-white' 
                          : 'bg-yellow-600 text-white'
                      }`}>
                        {hasSubmitted ? '✅ Done' : '⏳ Waiting'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Match Completion Status Banner */}
        {match.status === 'completed' && (
          <Card className="mb-6 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-500/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-green-600 rounded-full">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-400">Match Successfully Completed!</h3>
                    <p className="text-sm text-green-300">
                      Final score: {match.finalScore || 0} goals | Players can now submit their individual stats
                    </p>
                  </div>
                </div>
                {isParticipant && (
                  <div className="text-right">
                    <p className="text-sm text-gray-400 mb-1">Next Step:</p>
                    <p className="text-green-400 font-medium">Submit your stats below</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Goal Validation */}
        {statReports.length > 0 && (
          <div className="mb-6">
            <AdminGoalValidation 
              match={match} 
              statReports={statReports} 
              user={user} 
              league={league}
            />
          </div>
        )}

        {/* Admin Stats Overview */}
        <div className="mb-6">
          <AdminStatsOverview 
            match={match}
            isLeagueCreator={league?.createdBy === user?.id}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team A */}
          {teamA.length > 0 && (
            <Card className="bg-[#1e1e1e] border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  Team A
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getPlayersByIds(teamA).map((player) => (
                    <div 
                      key={player.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#2a2a2a] border border-blue-500/30"
                    >
                      <span className="text-xl">{player.emoji}</span>
                      <div className="flex-1">
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-sm text-gray-400">
                          ${player.marketValue || 0}M
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team B */}
          {teamB.length > 0 && (
            <Card className="bg-[#1e1e1e] border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  Team B
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getPlayersByIds(teamB).map((player) => (
                    <div 
                      key={player.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#2a2a2a] border border-red-500/30"
                    >
                      <span className="text-xl">{player.emoji}</span>
                      <div className="flex-1">
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-sm text-gray-400">
                          ${player.marketValue || 0}M
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Participants (when teams not formed yet) */}
          {teamA.length === 0 && teamB.length === 0 && (
            <div className="lg:col-span-2">
              <Card className="bg-[#1e1e1e] border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Participants ({acceptedParticipants.length}/10)
                  </CardTitle>
                  <CardDescription>
                    Teams will be automatically balanced when 10 players join
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {acceptedParticipants.map((participant) => {
                      const player = players.find(p => p.userId === participant.userId);
                      return (
                        <div 
                          key={participant.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-[#2a2a2a] border border-gray-600"
                        >
                          <span className="text-xl">{player?.emoji || '👤'}</span>
                          <div className="flex-1">
                            <p className="font-semibold">{player?.name || 'Unknown Player'}</p>
                            <p className="text-sm text-gray-400">
                              ${player?.marketValue || 0}M
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {acceptedParticipants.length < 10 && (
                    <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                      <p className="text-sm text-yellow-200">
                        <Clock className="h-4 w-4 inline mr-2" />
                        Waiting for {10 - acceptedParticipants.length} more players to join...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}