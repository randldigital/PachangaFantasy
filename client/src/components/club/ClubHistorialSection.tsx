import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { groupBySeason, seasonOf } from "@shared/domain/season";
import type { Match } from "@shared/schema";

interface ClubSeasonAggregate {
  season: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface ClubHistorialSectionProps {
  clubId: number;
}

function resultOf(match: Match): "win" | "draw" | "loss" | null {
  if (match.ourGoals == null || match.opponentGoals == null) {
    return null;
  }
  if (match.ourGoals > match.opponentGoals) return "win";
  if (match.ourGoals < match.opponentGoals) return "loss";
  return "draw";
}

/** Matches and Club aggregates in season sections (1 Aug – 31 Jul), newest season first. */
export default function ClubHistorialSection({ clubId }: ClubHistorialSectionProps) {
  const { t } = useTranslation();

  const { data: matches = [], isLoading } = useQuery<Match[]>({
    queryKey: queryKeys.clubMatches(clubId),
    queryFn: () => api.get<Match[]>(`/api/clubs/${clubId}/matches`),
  });

  const { data: aggregates = [] } = useQuery<ClubSeasonAggregate[]>({
    queryKey: [`/api/clubs/${clubId}/aggregates`],
    queryFn: () => api.get<ClubSeasonAggregate[]>(`/api/clubs/${clubId}/aggregates`),
  });

  const aggregateBySeason = new Map(aggregates.map((row) => [row.season, row]));
  const sections = groupBySeason(matches, (match) => match.seasonKey ?? seasonOf(match.date));

  if (isLoading) {
    return <p className="text-slate-400">{t("common.loading")}</p>;
  }

  if (sections.length === 0) {
    return <p className="text-slate-400">{t("club.noMatches")}</p>;
  }

  return (
    <div className="space-y-6">
      {sections.map(({ season, items }) => {
        const totals = aggregateBySeason.get(season);
        return (
          <Card key={season} className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">
                {t("season.heading", { season })}
              </CardTitle>
              {totals && (
                <p className="text-xs text-slate-400">
                  {t("club.aggregateLine", {
                    played: totals.played,
                    wins: totals.wins,
                    draws: totals.draws,
                    losses: totals.losses,
                    goalsFor: totals.goalsFor,
                    goalsAgainst: totals.goalsAgainst,
                  })}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-slate-700">
                {items.map((match) => {
                  const result = resultOf(match);
                  return (
                    <li key={match.id} className="flex items-center gap-3 py-3">
                      <span className="text-sm text-slate-400 w-24">
                        {new Date(match.date).toLocaleDateString()}
                      </span>
                      <span className="text-white flex-1">
                        {match.opponentName ?? t("club.opponentPending")}
                      </span>
                      {result ? (
                        <>
                          <span className="text-slate-200 font-mono">
                            {match.ourGoals} – {match.opponentGoals}
                          </span>
                          <Badge
                            variant="secondary"
                            className={
                              result === "win"
                                ? "bg-emerald-600 text-white border-0"
                                : result === "loss"
                                  ? "bg-red-600 text-white border-0"
                                  : "bg-slate-600 text-white border-0"
                            }
                          >
                            {t(`club.result.${result}`)}
                          </Badge>
                        </>
                      ) : (
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {t(`match.status.${match.status ?? "open"}`)}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
