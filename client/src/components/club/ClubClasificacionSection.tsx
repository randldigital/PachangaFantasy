import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar, Coins, Crown, Handshake, Target, Timer, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  marketValue: number;
  mvps: number;
  peerAverage: number | null;
}

type ClubSortKey =
  | "totalPoints"
  | "goals"
  | "assists"
  | "minutes"
  | "marketValue"
  | "mvps"
  | "matchesPlayed";

interface ClubClasificacionSectionProps {
  clubId: number;
}

function formatSortValue(row: ClubRankingRow, key: ClubSortKey): string {
  const value = row[key] ?? 0;
  if (key === "totalPoints") {
    return Number(value).toFixed(1);
  }
  return String(value);
}

/** Season contribution ranking: totals accumulate, they never mix across seasons. */
export default function ClubClasificacionSection({ clubId }: ClubClasificacionSectionProps) {
  const { t } = useTranslation();
  const [season, setSeason] = useState<string>();
  const [sortKey, setSortKey] = useState<ClubSortKey>("totalPoints");

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
  const sorted = useMemo(() => {
    return [...ranked].sort(
      (a, b) =>
        (b[sortKey] ?? 0) - (a[sortKey] ?? 0) ||
        b.totalPoints - a.totalPoints ||
        a.name.localeCompare(b.name),
    );
  }, [ranked, sortKey]);

  const sortOptions: { key: ClubSortKey; label: string; icon: typeof Trophy }[] = [
    { key: "totalPoints", label: t("clasificacion.points"), icon: Trophy },
    { key: "goals", label: t("clasificacion.goals"), icon: Target },
    { key: "assists", label: t("clasificacion.assists"), icon: Handshake },
    { key: "minutes", label: t("clasificacion.minutes"), icon: Timer },
    { key: "marketValue", label: t("clasificacion.marketValue"), icon: Coins },
    { key: "mvps", label: t("clasificacion.mvps"), icon: Crown },
    { key: "matchesPlayed", label: t("clasificacion.matches"), icon: Calendar },
  ];

  return (
    <div className="space-y-4">
      <SeasonSwitcher seasons={seasons} value={activeSeason} onChange={setSeason} />
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{t("club.tabs.clasificacion")}</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            {sortOptions.map((option) => (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={sortKey === option.key ? "default" : "outline"}
                className={
                  sortKey === option.key
                    ? "bg-sky-600 hover:bg-sky-700 text-white"
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
        <CardContent>
          {isLoading ? (
            <p className="text-slate-400">{t("common.loading")}</p>
          ) : sorted.length === 0 ? (
            <p className="text-slate-400">{t("club.noRanking")}</p>
          ) : (
            <ul className="divide-y divide-slate-700">
              {sorted.map((row, index) => (
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
                  <span className="text-emerald-400 font-semibold tabular-nums">
                    {sortKey === "marketValue" ? `$${row.marketValue}` : formatSortValue(row, sortKey)}
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
