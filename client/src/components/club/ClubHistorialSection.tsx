import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ClubMatchRecap, { type ClubRecapPlayer } from "@/components/club/ClubMatchRecap";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { isFinishedStatus } from "@shared/domain/matchLifecycle";
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

interface ClubMatchRecapPayload {
  matchId: number;
  opponentName: string | null;
  ourGoals: number | null;
  opponentGoals: number | null;
  players: ClubRecapPlayer[];
}

interface ClubHistorialSectionProps {
  clubId: number;
  onCreateMatch?: () => void;
}

function resultOf(match: Match): "win" | "draw" | "loss" | null {
  if (match.ourGoals == null || match.opponentGoals == null) {
    return null;
  }
  if (match.ourGoals > match.opponentGoals) return "win";
  if (match.ourGoals < match.opponentGoals) return "loss";
  return "draw";
}

function ClubMatchDetail({ matchId, open }: { matchId: number; open: boolean }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<ClubMatchRecapPayload>({
    queryKey: queryKeys.matchRecap(matchId),
    queryFn: () => api.get<ClubMatchRecapPayload>(`/api/matches/${matchId}/recap`),
    enabled: open,
  });

  if (isLoading) {
    return <p className="text-slate-400 text-sm py-3">{t("common.loading")}</p>;
  }
  if (!data) {
    return null;
  }

  return (
    <ClubMatchRecap
      opponentName={data.opponentName}
      ourGoals={data.ourGoals}
      opponentGoals={data.opponentGoals}
      players={data.players}
    />
  );
}

/** Matches and Club aggregates in season sections (1 Aug – 31 Jul), newest season first. */
export default function ClubHistorialSection({
  clubId,
  onCreateMatch,
}: ClubHistorialSectionProps) {
  const { t } = useTranslation();
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set());

  const { data: matches = [], isLoading } = useQuery<Match[]>({
    queryKey: queryKeys.clubMatches(clubId),
    queryFn: () => api.get<Match[]>(`/api/clubs/${clubId}/matches`),
  });

  const { data: aggregates = [] } = useQuery<ClubSeasonAggregate[]>({
    queryKey: queryKeys.clubAggregates(clubId),
    queryFn: () => api.get<ClubSeasonAggregate[]>(`/api/clubs/${clubId}/aggregates`),
  });

  const toggleMatch = (matchId: number) => {
    setExpandedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const aggregateBySeason = new Map(aggregates.map((row) => [row.season, row]));
  const sections = groupBySeason(matches, (match) => match.seasonKey ?? seasonOf(match.date));

  if (isLoading) {
    return <p className="text-slate-400">{t("common.loading")}</p>;
  }

  if (sections.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">{t("club.noMatches")}</h3>
          <p className="text-slate-400 mb-4">{t("club.createMatchDescription")}</p>
          {onCreateMatch && (
            <Button onClick={onCreateMatch} className="bg-sky-600 hover:bg-sky-700 text-white">
              {t("match.createMatch")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
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
                  const expandable = isFinishedStatus(match.status);
                  const isExpanded = expandedMatches.has(match.id);
                  return (
                    <li key={match.id}>
                      <Collapsible
                        open={isExpanded}
                        onOpenChange={() => expandable && toggleMatch(match.id)}
                      >
                        <div className="flex items-center gap-3 py-3">
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
                          {expandable && (
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-white"
                                aria-label={t("club.recapToggle")}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </div>
                        {expandable && (
                          <CollapsibleContent>
                            <div className="pb-3 pl-2">
                              <ClubMatchDetail matchId={match.id} open={isExpanded} />
                            </div>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
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
