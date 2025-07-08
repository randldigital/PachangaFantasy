import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy, Users, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import type { League, Match, Player } from '@shared/schema';

export default function LeagueDashboard() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: league, isLoading: leagueLoading } = useQuery<League>({
    queryKey: ['/api/leagues', id],
    queryFn: async () => {
      const response = await fetch(`/api/leagues/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.json();
    },
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ['/api/leagues', id, 'matches'],
    queryFn: async () => {
      const response = await fetch(`/api/leagues/${id}/matches`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.json();
    },
  });

  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ['/api/players', id],
    queryFn: async () => {
      const response = await fetch(`/api/players/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.json();
    },
  });

  const { data: rankings = [], isLoading: rankingsLoading } = useQuery<{ userId: number, username: string, totalPoints: number }[]>({
    queryKey: ['/api/leagues', id, 'rankings'],
    queryFn: async () => {
      const response = await fetch(`/api/leagues/${id}/rankings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.json();
    },
  });

  if (leagueLoading) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#e0e0e0] p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const upcomingMatch = matches.find(m => m.status === 'open' || m.status === 'ready');
  const completedMatches = matches.filter(m => m.status === 'completed');

  return (
    <div className="min-h-screen bg-[#121212] text-[#e0e0e0] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{league?.name}</h1>
          <p className="text-gray-400">{league?.description}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-[#1e1e1e] border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Matches</p>
                  <p className="text-2xl font-bold">{matches.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1e1e1e] border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Players</p>
                  <p className="text-2xl font-bold">{players.length}</p>
                </div>
                <Users className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1e1e1e] border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Completed</p>
                  <p className="text-2xl font-bold">{completedMatches.length}</p>
                </div>
                <Trophy className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1e1e1e] border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">My Points</p>
                  <p className="text-2xl font-bold">
                    {rankings.find(r => r.userId === user?.id)?.totalPoints || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Match */}
          <div className="lg:col-span-2">
            <Card className="bg-[#1e1e1e] border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Match
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingMatch ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold">
                          {new Date(upcomingMatch.date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-400">
                          Budget: ${upcomingMatch.lineupBudget}M
                        </p>
                      </div>
                      <Badge 
                        variant={upcomingMatch.status === 'ready' ? 'default' : 'secondary'}
                        className="bg-gradient-to-r from-blue-600 to-purple-600"
                      >
                        {upcomingMatch.status}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        onClick={() => window.location.href = `/matches/${upcomingMatch.id}`}
                      >
                        View Match
                      </Button>
                      <Button 
                        variant="outline"
                        className="flex-1 border-gray-600 hover:bg-gray-700"
                        onClick={() => window.location.href = `/matches/${upcomingMatch.id}/lineup`}
                      >
                        Set Lineup
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">No upcoming matches</p>
                    {league?.createdBy === user?.id && (
                      <Button 
                        className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        onClick={() => window.location.href = `/leagues/${id}/create-match`}
                      >
                        Create Match
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* League Rankings */}
          <div>
            <Card className="bg-[#1e1e1e] border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rankings.slice(0, 10).map((ranking, index) => (
                    <div 
                      key={ranking.userId}
                      className={`flex items-center justify-between p-2 rounded ${
                        ranking.userId === user?.id ? 'bg-blue-900/20 border border-blue-500/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold w-6 ${
                          index === 0 ? 'text-yellow-400' : 
                          index === 1 ? 'text-gray-300' : 
                          index === 2 ? 'text-orange-400' : 'text-gray-400'
                        }`}>
                          #{index + 1}
                        </span>
                        <span className="text-sm">{ranking.username}</span>
                      </div>
                      <span className="text-sm font-semibold text-green-400">
                        {ranking.totalPoints} pts
                      </span>
                    </div>
                  ))}
                  
                  {rankings.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm">No rankings yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Players List */}
        <div className="mt-8">
          <Card className="bg-[#1e1e1e] border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Players ({players.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {players.map((player) => (
                  <div 
                    key={player.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#2a2a2a] border border-gray-600"
                  >
                    <span className="text-2xl">{player.emoji}</span>
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
        </div>
      </div>
    </div>
  );
}