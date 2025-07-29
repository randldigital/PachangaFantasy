import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User } from "@shared/schema";

interface ManagerLeaderboardSectionProps {
  leagueId: number;
  currentUser?: User;
}

interface ManagerRankingData {
  userId: number;
  username: string;
  totalPoints: number;
}

export default function ManagerLeaderboardSection({ leagueId, currentUser }: ManagerLeaderboardSectionProps) {
  const { t } = useTranslation();

  const { data: rankings = [], isLoading } = useQuery<ManagerRankingData[]>({
    queryKey: ["/api/leaderboards", leagueId, "users"],
    queryFn: async () => {
      const response = await fetch(`/api/leaderboards/${leagueId}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch manager leaderboard');
      return response.json();
    }
  });

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-slate-400 font-bold text-sm">{position}</span>;
    }
  };

  const getPositionColor = (position: number) => {
    switch (position) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30';
      default:
        return 'bg-slate-800/50 border-slate-700';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white">{t('common.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (rankings.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">{t('managerLeaderboard.noData', 'No fantasy scores yet')}</h3>
          <p className="text-slate-400">{t('managerLeaderboard.noDataDescription', 'No users have submitted lineups or no matches have been scored yet.')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Trophy className="w-5 h-5 mr-2" />
          {t('managerLeaderboard.title', 'Manager Leaderboard')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rankings.map((manager, index) => {
            const position = index + 1;
            const isCurrentUser = manager.userId === currentUser?.id;
            return (
              <div
                key={manager.userId}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  getPositionColor(position)
                } ${isCurrentUser ? 'ring-2 ring-emerald-500/50' : ''}`}
              >
                <div className="flex items-center space-x-4">
                  {getPositionIcon(position)}
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-slate-700 text-white">
                      {manager.username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">{manager.username}</span>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="bg-emerald-600 text-white text-xs">
                          {t('clasificacion.you')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-slate-400">
                      <span>{t('clasificacion.points')}: {manager.totalPoints}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-400">
                    {manager.totalPoints}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t('clasificacion.points')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Stats Summary */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-emerald-400 font-bold text-lg">
                {rankings.length}
              </div>
              <div className="text-slate-400 text-sm">
                {t('managerLeaderboard.managers', 'Managers')}
              </div>
            </div>
            <div>
              <div className="text-emerald-400 font-bold text-lg">
                {rankings.reduce((total, manager) => total + manager.totalPoints, 0)}
              </div>
              <div className="text-slate-400 text-sm">
                {t('clasificacion.totalPoints')}
              </div>
            </div>
            <div>
              <div className="text-emerald-400 font-bold text-lg">
                {rankings.length > 0 ? Math.round(rankings.reduce((total, manager) => total + manager.totalPoints, 0) / rankings.length) : 0}
              </div>
              <div className="text-slate-400 text-sm">
                {t('clasificacion.average')}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 