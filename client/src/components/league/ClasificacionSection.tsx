import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Users,
  User,
  Target,
  Handshake,
  Crown,
  Flag,
  Calendar,
} from "lucide-react";
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
  mvps: number;
  victories: number;
}

interface ManagerRanking {
  userId: number;
  username: string;
  totalPoints: number;
}

type PlayerSortKey = "totalPoints" | "goals" | "assists" | "mvps" | "victories" | "matchesPlayed";

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
  value,
  valueLabel,
}: {
  position: number;
  highlight: boolean;
  initials: string;
  title: string;
  subtitle: string;
  value: number;
  valueLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${getPositionColor(position)} ${
        highlight ? "ring-2 ring-emerald-500/50" : ""
      }`}
    >
      <div className="flex items-center space-x-4 min-w-0">
        {getPositionIcon(position)}
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-slate-700 text-white">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-white font-medium truncate">{title}</span>
            {highlight && (
              <Badge variant="secondary" className="bg-emerald-600 text-white text-xs">
                {t("clasificacion.you")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-400 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <div className="text-2xl font-bold text-emerald-400">
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </div>
        <div className="text-xs text-slate-400">{valueLabel}</div>
      </div>
    </div>
  );
}

export default function ClasificacionSection({ leagueId, currentUser, onPlayMatch }: ClasificacionSectionProps) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<PlayerSortKey>("totalPoints");

  const { data: players = [], isLoading: playersLoading } = useQuery<PlayerRanking[]>({
    queryKey: queryKeys.leagueRankings(leagueId),
    queryFn: () => api.get<PlayerRanking[]>(`/api/leagues/${leagueId}/rankings`),
  });

  const { data: managers = [], isLoading: managersLoading } = useQuery<ManagerRanking[]>({
    queryKey: queryKeys.leagueManagerRankings(leagueId),
    queryFn: () => api.get<ManagerRanking[]>(`/api/leagues/${leagueId}/manager-rankings`),
  });

  const sortedPlayers = useMemo(() => {
    return [...players].sort(
      (a, b) =>
        (b[sortKey] ?? 0) - (a[sortKey] ?? 0) ||
        b.totalPoints - a.totalPoints ||
        a.name.localeCompare(b.name),
    );
  }, [players, sortKey]);

  const sortOptions: { key: PlayerSortKey; label: string; icon: typeof Trophy }[] = [
    { key: "totalPoints", label: t("clasificacion.points"), icon: Trophy },
    { key: "goals", label: t("clasificacion.goals"), icon: Target },
    { key: "assists", label: t("clasificacion.assists"), icon: Handshake },
    { key: "mvps", label: t("clasificacion.mvps"), icon: Crown },
    { key: "victories", label: t("clasificacion.victories"), icon: Flag },
    { key: "matchesPlayed", label: t("clasificacion.matches"), icon: Calendar },
  ];

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
            <div className="flex flex-wrap gap-2 pt-2">
              {sortOptions.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  size="sm"
                  variant={sortKey === option.key ? "default" : "outline"}
                  className={
                    sortKey === option.key
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "border-slate-600 text-slate-200 hover:bg-slate-700"
                  }
                  onClick={() => setSortKey(option.key)}
                >
                  <option.icon className="w-3.5 h-3.5 mr-1.5" />
                  {option.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedPlayers.map((player, index) => (
              <div key={player.playerId} className="space-y-2">
                <BoardRow
                  position={index + 1}
                  highlight={player.userId === currentUser?.id}
                  initials={player.name?.[0]?.toUpperCase() || "?"}
                  title={player.name}
                  subtitle={t("clasificacion.playerDetail", {
                    goals: player.goals,
                    assists: player.assists,
                    matches: player.matchesPlayed,
                  })}
                  value={player[sortKey] ?? 0}
                  valueLabel={sortOptions.find((option) => option.key === sortKey)?.label ?? t("clasificacion.points")}
                />
                <div className="flex flex-wrap gap-3 px-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-emerald-400" />{" "}
                    {Number.isInteger(player.totalPoints) ? player.totalPoints : player.totalPoints.toFixed(1)}{" "}
                    {t("clasificacion.points")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3 text-emerald-400" /> {player.goals}
                  </span>
                  <span className="flex items-center gap-1">
                    <Handshake className="w-3 h-3 text-sky-400" /> {player.assists}
                  </span>
                  <span className="flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" /> {player.mvps ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Flag className="w-3 h-3 text-violet-400" /> {player.victories ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {player.matchesPlayed}
                  </span>
                </div>
              </div>
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
                value={manager.totalPoints}
                valueLabel={t("clasificacion.points")}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
