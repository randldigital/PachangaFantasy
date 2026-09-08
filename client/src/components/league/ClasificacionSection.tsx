import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, TrendingUp, Users, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { User as AppUser } from "@shared/schema";

interface ClasificacionSectionProps {
  leagueId: number;
  currentUser?: AppUser;
  onPlayMatch?: () => void;
}

interface PlayerRanking {
  playerId: number;
  name: string;
  userId: number | null;
  totalPoints: number;
  goals: number;
  assists: number;
  matchesPlayed: number;
}

interface ManagerRanking {
  userId: number;
  username: string;
  totalPoints: number;
}

function getPositionIcon(position: number) {
  switch (position) {
    case 1:
      return <Trophy className="w-5 h-5 text-yellow-500" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-400" />;
    case 3:
      return <Award className="w-5 h-5 text-amber-600" />;
    default:
      return (
        <span className="w-5 h-5 flex items-center justify-center text-slate-400 font-bold text-sm">
          {position}
        </span>
      );
  }
}

function getPositionColor(position: number) {
  switch (position) {
    case 1:
      return "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/30";
    case 2:
      return "bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30";
    case 3:
      return "bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30";
    default:
      return "bg-slate-800/50 border-slate-700";
  }
}

function BoardRow({
  position,
  highlight,
  initials,
  title,
  subtitle,
  points,
}: {
  position: number;
  highlight: boolean;
  initials: string;
  title: string;
  subtitle: string;
  points: number;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${getPositionColor(position)} ${
        highlight ? "ring-2 ring-emerald-500/50" : ""
      }`}
    >
      <div className="flex items-center space-x-4">
        {getPositionIcon(position)}
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-slate-700 text-white">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-white font-medium">{title}</span>
            {highlight && (
              <Badge variant="secondary" className="bg-emerald-600 text-white text-xs">
                {t("clasificacion.you")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold text-emerald-400">{points}</div>
        <div className="text-xs text-slate-400">{t("clasificacion.points")}</div>
      </div>
    </div>
  );
}

export default function ClasificacionSection({ leagueId, currentUser, onPlayMatch }: ClasificacionSectionProps) {
  const { t } = useTranslation();

  const { data: players = [], isLoading: playersLoading } = useQuery<PlayerRanking[]>({
    queryKey: queryKeys.leagueRankings(leagueId),
    queryFn: () => api.get<PlayerRanking[]>(`/api/leagues/${leagueId}/rankings`),
  });

  const { data: managers = [], isLoading: managersLoading } = useQuery<ManagerRanking[]>({
    queryKey: queryKeys.leagueManagerRankings(leagueId),
    queryFn: () => api.get<ManagerRanking[]>(`/api/leagues/${leagueId}/manager-rankings`),
  });

  if (playersLoading || managersLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  const empty = players.length === 0 && managers.length === 0;

  return (
    <div className="space-y-6">
      {empty && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-2">{t("clasificacion.noData")}</h3>
            <p className="text-slate-400 mb-4">{t("clasificacion.noDataDescription")}</p>
            {onPlayMatch && (
              <Button onClick={onPlayMatch} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {t("clasificacion.emptyCta")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {players.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <User className="w-5 h-5 mr-2" />
              {t("clasificacion.title")}
            </CardTitle>
            <p className="text-slate-400 text-sm">{t("clasificacion.playerSubtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player, index) => (
              <BoardRow
                key={player.playerId}
                position={index + 1}
                highlight={player.userId === currentUser?.id}
                initials={player.name?.[0]?.toUpperCase() || "?"}
                title={player.name}
                subtitle={t("clasificacion.playerDetail", {
                  goals: player.goals,
                  assists: player.assists,
                  matches: player.matchesPlayed,
                })}
                points={player.totalPoints}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {managers.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Users className="w-5 h-5 mr-2" />
              {t("clasificacion.managerTitle")}
            </CardTitle>
            <p className="text-slate-400 text-sm">{t("clasificacion.managerSubtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {managers.map((manager, index) => (
              <BoardRow
                key={manager.userId}
                position={index + 1}
                highlight={manager.userId === currentUser?.id}
                initials={manager.username?.[0]?.toUpperCase() || "?"}
                title={manager.username}
                subtitle={t("clasificacion.points")}
                points={manager.totalPoints}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
