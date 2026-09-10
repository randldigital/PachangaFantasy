import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UserAvatar from "@/components/UserAvatar";
import SeasonSwitcher, { ALL_SEASONS, defaultSeason } from "@/components/SeasonSwitcher";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

interface ClubRankingRow {
  playerId: number;
  name: string;
  userId: number | null;
  totalPoints: number;
  goals: number;
  assists: number;
  minutes: number;
  matchesPlayed: number;
}

interface ClubClasificacionSectionProps {
  clubId: number;
}

/** Season contribution ranking: totals accumulate, they never mix across seasons. */
export default function ClubClasificacionSection({ clubId }: ClubClasificacionSectionProps) {
  const { t } = useTranslation();
  const [season, setSeason] = useState<string>();

  const { data: seasons = [] } = useQuery<string[]>({
    queryKey: queryKeys.clubSeasons(clubId),
    queryFn: () => api.get<string[]>(`/api/clubs/${clubId}/seasons`),
  });

  const activeSeason = season ?? defaultSeason(seasons);
  const seasonQuery = activeSeason === ALL_SEASONS ? undefined : activeSeason;

  const { data: rows = [], isLoading } = useQuery<ClubRankingRow[]>({
    queryKey: queryKeys.clubRankings(clubId, activeSeason),
    queryFn: () =>
      api.get<ClubRankingRow[]>(
        `/api/clubs/${clubId}/rankings${seasonQuery ? `?season=${encodeURIComponent(seasonQuery)}` : ""}`,
      ),
  });

  const ranked = useMemo(() => rows.filter((row) => row.matchesPlayed > 0), [rows]);

  return (
    <div className="space-y-4">
      <SeasonSwitcher seasons={seasons} value={activeSeason} onChange={setSeason} />
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{t("club.tabs.clasificacion")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-400">{t("common.loading")}</p>
          ) : ranked.length === 0 ? (
            <p className="text-slate-400">{t("club.noRanking")}</p>
          ) : (
            <ul className="divide-y divide-slate-700">
              {ranked.map((row, index) => (
                <li key={row.playerId} className="flex items-center gap-3 py-3">
                  <span className="w-6 text-slate-400 text-sm">{index + 1}</span>
                  <UserAvatar userId={row.userId} name={row.name} className="w-8 h-8" />
                  <div className="flex-1">
                    <p className="text-white">{row.name}</p>
                    <p className="text-xs text-slate-400">
                      {t("club.rankingLine", {
                        matches: row.matchesPlayed,
                        goals: row.goals,
                        assists: row.assists,
                        minutes: row.minutes,
                      })}
                    </p>
                  </div>
                  <span className="text-emerald-400 font-semibold">
                    {row.totalPoints.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
