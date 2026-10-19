import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Match, Player } from "@shared/schema";
import { isFinishedStatus, normalizeMatchStatus } from "@shared/domain/matchLifecycle";
import { groupBySeason, seasonOf } from "@shared/domain/season";
import MatchRecapPitch, { type MatchRecapPlayer } from "./MatchRecapPitch";
import CorrectResultButton from "@/components/CorrectResultButton";
import RecalculateButton from "@/components/RecalculateButton";
import ReopenStatsButton from "@/components/ReopenStatsButton";
import MatchFriendlyToggle from "@/components/MatchFriendlyToggle";
import { teamSideTextClass } from "@/lib/teamSide";

interface MatchRecap {
  matchId: number;
  status: string | null;
  teamAGoals: number | null;
  teamBGoals: number | null;
  players: MatchRecapPlayer[];
}

interface HistorialSectionProps {
  matches: Match[];
  players: Player[];
  isLoading: boolean;
  isAdmin?: boolean;
  onCreateMatch?: () => void;
}

function matchDate(value: Match["date"] | string) {
  return value instanceof Date ? value : new Date(value);
}

function MatchDetail({ matchId, open }: { matchId: number; open: boolean }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<MatchRecap>({
    queryKey: queryKeys.matchRecap(matchId),
    queryFn: () => api.get<MatchRecap>(`/api/matches/${matchId}/recap`),
    enabled: open,
  });

  if (isLoading) {
    return <p className="text-slate-400 text-sm py-3">{t("common.loading")}</p>;
  }
  if (!data) {
    return null;
  }

  return (
    <MatchRecapPitch
      teamAGoals={data.teamAGoals}
      teamBGoals={data.teamBGoals}
      players={data.players}
    />
  );
}

export default function HistorialSection({
  matches,
  players,
  isLoading,
  isAdmin = false,
  onCreateMatch,
}: HistorialSectionProps) {
  const { t, i18n } = useTranslation();
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set());

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

  const formatDate = (value: Match["date"]) =>
    matchDate(value).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const formatTime = (value: Match["date"]) =>
    matchDate(value).toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const pastMatches = matches
    .filter((match) => isFinishedStatus(match.status))
    .sort((a, b) => matchDate(b.date).getTime() - matchDate(a.date).getTime());

  const seasons = groupBySeason(pastMatches, (match) => match.seasonKey ?? seasonOf(match.date));

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  if (pastMatches.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">{t("historial.noMatches")}</h3>
          <p className="text-slate-400 mb-4">{t("historial.noMatchesDescription")}</p>
          {onCreateMatch && (
            <Button onClick={onCreateMatch} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {t("historial.createCta")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          {t("historial.title")}
        </CardTitle>
        <p className="text-slate-400 text-sm">{t("historial.subtitle")}</p>
      </CardHeader>
      <CardContent>
        {seasons.map((group) => (
        <div key={group.season} className="space-y-3">
          <div className="flex items-center gap-3 pt-4 first:pt-0">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              {t("season.heading", { season: group.season })}
            </h4>
            <div className="h-px flex-1 bg-slate-700" />
          </div>
          {group.items.map((match) => {
            const isExpanded = expandedMatches.has(match.id);
            const scored = normalizeMatchStatus(match.status) === "scored";
            const a = match.teamAGoals;
            const b = match.teamBGoals;
            const names = new Map(players.map((player) => [player.id, player.name]));
            const mvpHint = match.matchTeams
              ? [...(match.matchTeams.teamA ?? []), ...(match.matchTeams.teamB ?? [])]
                  .map((id) => names.get(id))
                  .filter(Boolean).length
              : 0;

            return (
              <Collapsible key={match.id} open={isExpanded} onOpenChange={() => toggleMatch(match.id)}>
                <div className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-auto w-full flex-col items-stretch gap-2 whitespace-normal rounded-none p-4 text-left hover:bg-slate-800/80 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 sm:flex">
                          <Calendar className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">{formatDate(match.date)}</div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{formatTime(match.date)}</span>
                            {mvpHint > 0 && (
                              <span>
                                · {mvpHint} {t("historial.players")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 self-stretch sm:shrink-0 sm:self-auto sm:justify-end">
                        {a != null && b != null && (
                          <div className="text-left sm:text-right">
                            <div className="text-xl font-bold tabular-nums text-white">
                              {a}
                              <span className="mx-1 text-slate-500">–</span>
                              {b}
                            </div>
                            <div className="hidden text-[10px] uppercase tracking-wide sm:block">
                              <span className={teamSideTextClass("A")}>{t("match.teamA")}</span>
                              <span className="text-slate-500"> / </span>
                              <span className={teamSideTextClass("B")}>{t("match.teamB")}</span>
                            </div>
                          </div>
                        )}
                        <Badge className={scored ? "bg-violet-600 text-white" : "bg-emerald-600 text-white"}>
                          {t(`match.status.${normalizeMatchStatus(match.status)}`)}
                        </Badge>
                        {match.isFriendly && (
                          <Badge className="bg-sky-700 text-white">{t("match.friendly")}</Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 border-t border-slate-700 space-y-3">
                      {isAdmin && (
                        <div className="flex flex-wrap items-center gap-2 pt-3">
                          <CorrectResultButton match={match} />
                          <RecalculateButton match={match} />
                          <ReopenStatsButton match={match} matches={matches} />
                          <MatchFriendlyToggle match={match} />
                        </div>
                      )}
                      <MatchDetail matchId={match.id} open={isExpanded} />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
        ))}
      </CardContent>
    </Card>
  );
}
