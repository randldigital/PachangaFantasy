import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Medal, Award, Crown, Target, TrendingUp } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface LeaderboardEntry {
  userId: number;
  username: string;
  totalPoints: number;
  rank?: number;
  change?: number; // Position change from last period
}

interface EnhancedLeaderboardProps {
  leagueId: number;
  className?: string;
}

export default function EnhancedLeaderboard({ leagueId, className = "" }: EnhancedLeaderboardProps) {
  const { data: rankings = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leagues', leagueId, 'rankings'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/leagues/${leagueId}/rankings`);
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card className={`bg-[#1e1e1e] border-gray-700 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            League Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-3 rounded-lg bg-[#2a2a2a]">
                <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-600 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-700 rounded w-16"></div>
                </div>
                <div className="h-6 bg-gray-600 rounded w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rankings.length === 0) {
    return (
      <Card className={`bg-[#1e1e1e] border-gray-700 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            League Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No rankings yet</p>
          <p className="text-sm text-gray-500 mt-1">Play some matches to see the leaderboard!</p>
        </CardContent>
      </Card>
    );
  }

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-400 fill-current" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-300 fill-current" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600 fill-current" />;
      default:
        return <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold text-white">{position}</div>;
    }
  };

  const getRankColor = (position: number) => {
    switch (position) {
      case 1:
        return 'border-yellow-400 bg-yellow-400/10';
      case 2:
        return 'border-gray-300 bg-gray-300/10';
      case 3:
        return 'border-amber-600 bg-amber-600/10';
      default:
        return 'border-gray-600 bg-[#2a2a2a]';
    }
  };

  const maxPoints = Math.max(...rankings.map(r => r.totalPoints));

  return (
    <Card className={`bg-[#1e1e1e] border-gray-700 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            League Leaderboard
          </div>
          <Badge variant="outline" className="text-yellow-400 border-yellow-400">
            {rankings.length} Players
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rankings.map((entry, index) => {
          const position = index + 1;
          const progressValue = maxPoints > 0 ? (entry.totalPoints / maxPoints) * 100 : 0;
          
          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:scale-[1.02] ${getRankColor(position)}`}
            >
              {/* Rank Icon */}
              <div className="flex-shrink-0">
                {getRankIcon(position)}
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-white truncate">
                    {entry.username}
                  </p>
                  {position <= 3 && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        position === 1 ? 'text-yellow-400 border-yellow-400' :
                        position === 2 ? 'text-gray-300 border-gray-300' :
                        'text-amber-600 border-amber-600'
                      }`}
                    >
                      {position === 1 ? 'Champion' : position === 2 ? 'Runner-up' : 'Third Place'}
                    </Badge>
                  )}
                </div>
                
                {/* Points Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Points</span>
                    <span className="text-white font-medium">{entry.totalPoints}</span>
                  </div>
                  <Progress 
                    value={progressValue} 
                    className="h-2"
                    style={{
                      backgroundColor: 'rgb(55 65 81)'
                    }}
                  />
                </div>
              </div>

              {/* Position Change */}
              {entry.change !== undefined && entry.change !== 0 && (
                <div className="flex-shrink-0">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    entry.change > 0 
                      ? 'bg-green-900/50 text-green-400' 
                      : 'bg-red-900/50 text-red-400'
                  }`}>
                    <TrendingUp className={`h-3 w-3 ${entry.change < 0 ? 'rotate-180' : ''}`} />
                    {Math.abs(entry.change)}
                  </div>
                </div>
              )}

              {/* Total Points Badge */}
              <div className="flex-shrink-0">
                <Badge 
                  variant="secondary" 
                  className={`font-bold ${
                    position === 1 ? 'bg-yellow-600 text-white' :
                    position === 2 ? 'bg-gray-600 text-white' :
                    position === 3 ? 'bg-amber-700 text-white' :
                    'bg-gray-700 text-gray-200'
                  }`}
                >
                  {entry.totalPoints}
                </Badge>
              </div>
            </div>
          );
        })}

        {/* Quick Stats */}
        <div className="pt-3 border-t border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-yellow-400">{rankings[0]?.totalPoints || 0}</div>
              <div className="text-xs text-gray-400">Top Score</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                {rankings.length > 0 ? Math.round(rankings.reduce((sum, r) => sum + r.totalPoints, 0) / rankings.length) : 0}
              </div>
              <div className="text-xs text-gray-400">Average</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{rankings.length}</div>
              <div className="text-xs text-gray-400">Players</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}