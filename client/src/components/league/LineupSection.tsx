import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, DollarSign, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { lineupTotalCost, validateLineup, type LineupViolation } from "@shared/domain/lineup";
import { isLineupEditable } from "@shared/domain/matchLifecycle";
import { formatDisplayMarketValue } from "@shared/domain/displayValue";
import FootballFieldLineup from "./FootballFieldLineup";
import type { Match, League, Player, User, Lineup } from "@shared/schema";

interface LineupSectionProps {
  match?: Match;
  /** When idle (no open/started match), show this scored match's manager score + lineup. */
  lastScoredMatch?: Match;
  league: League;
  players: Player[];
  user?: User;
  isLoading: boolean;
  onCreateMatch?: () => void;
}

interface Participant {
  playerId: number;
  status: string;
}

type MatchRecapPayload = {
  managers: { userId: number; points: number; lineupStatus: string }[];
};

function LastScoredLineupSummary({
  match,
  players,
  user,
  onCreateMatch,
}: {
  match: Match;
  players: Player[];
  user?: User;
  onCreateMatch?: () => void;
}) {
  const { t } = useTranslation();

  const { data: existingLineup, isLoading: lineupLoading } = useQuery<Lineup | null>({
    queryKey: queryKeys.matchLineup(match.id),
    queryFn: () => api.get<Lineup | null>(`/api/matches/${match.id}/lineup`),
  });

  const { data: recap, isLoading: recapLoading } = useQuery<MatchRecapPayload>({
    queryKey: queryKeys.matchRecap(match.id),
    queryFn: () => api.get<MatchRecapPayload>(`/api/matches/${match.id}/recap`),
  });

  if (lineupLoading || recapLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4" />
          <p className="text-white">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  const managerRow = user
    ? recap?.managers.find((row) => row.userId === user.id)
    : undefined;
  const budget = match.lineupBudget || 100;
  const totalCost = existingLineup
    ? lineupTotalCost(existingLineup.playerIds || [], players)
    : 0;

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6 text-center space-y-3">
          <h3 className="text-white font-medium text-lg">{t("lineup.lastScoreTitle")}</h3>
          {managerRow ? (
            <>
              <p className="text-emerald-400 text-3xl font-bold">
                {t("lineup.lastScorePoints", { points: managerRow.points })}
              </p>
              {managerRow.lineupStatus === "invalid" && (
                <p className="text-amber-400 text-sm">{t("lineup.lastScoreInvalid")}</p>
              )}
            </>
          ) : (
            <p className="text-slate-400">{t("lineup.lastScoreNoScore")}</p>
          )}
          <p className="text-slate-400 text-sm">{t("lineup.lastScoreWaiting")}</p>
          {onCreateMatch && (
            <Button onClick={onCreateMatch} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {t("lineup.noMatchAdminCta")}
            </Button>
          )}
        </CardContent>
      </Card>

      {existingLineup ? (
        <FootballFieldLineup
          lineup={existingLineup}
          players={players}
          budget={budget}
        />
      ) : (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 text-center">
            <p className="text-slate-400">{t("lineup.lastScoreNoLineup")}</p>
          </CardContent>
        </Card>
      )}

      {existingLineup && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex justify-between text-sm text-slate-300">
            <span>{t("lineup.budget")}</span>
            <span>
              {formatDisplayMarketValue(totalCost)}/{formatDisplayMarketValue(budget)}
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LineupSection({
  match,
  lastScoredMatch,
  players,
  user,
  isLoading,
  onCreateMatch,
}: LineupSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [captain, setCaptain] = useState<number | null>(null);

  const { data: existingLineup } = useQuery<Lineup | null>({
    queryKey: queryKeys.matchLineup(match?.id || 0),
    queryFn: () => api.get<Lineup | null>(`/api/matches/${match?.id}/lineup`),
    enabled: !!match?.id,
  });

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: queryKeys.matchParticipants(match?.id || 0),
    queryFn: () => api.get<Participant[]>(`/api/matches/${match!.id}/participants`),
    enabled: !!match?.id,
  });

  useEffect(() => {
    if (existingLineup) {
      setSelectedPlayers(existingLineup.playerIds || []);
      setCaptain(existingLineup.captainId || null);
    }
  }, [existingLineup]);

  const participantIds = participants.map((participant) => participant.playerId);
  const selectablePlayers = players.filter((player) => participantIds.includes(player.id));
  const locked = !isLineupEditable(match?.status);
  const budget = match?.lineupBudget || 100;
  const totalCost = lineupTotalCost(selectedPlayers, players);
  const violations = match
    ? validateLineup({
        playerIds: selectedPlayers,
        captainId: captain,
        budget,
        players,
        participantIds,
        matchStatus: match.status,
      })
    : [];
  const canSave = !locked && violations.filter((item) => item.code !== "LINEUP_LOCKED").length === 0
    && selectedPlayers.length === 5
    && captain !== null;

  const saveLineupMutation = useMutation({
    mutationFn: async (lineupData: { playerIds: number[]; captainId: number }) => {
      return api.post(`/api/matches/${match?.id}/lineup`, lineupData);
    },
    onSuccess: () => {
      toast({
        title: t("lineup.saved"),
        description: t("lineup.savedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.matchLineup(match?.id || 0) });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t) || t("lineup.saveError"),
        variant: "destructive",
      });
    },
  });

  const handlePlayerToggle = (playerId: number) => {
    if (locked) return;
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) {
        if (captain === playerId) setCaptain(null);
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 5) {
        toast({
          title: t("lineup.maxPlayers"),
          description: t("lineup.maxPlayersDescription"),
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const handleCaptainSelect = (playerId: number) => {
    if (locked) return;
    if (selectedPlayers.includes(playerId)) {
      setCaptain(captain === playerId ? null : playerId);
    }
  };

  const blockerCopy = (violation: LineupViolation) => {
    switch (violation.code) {
      case "LINEUP_SIZE":
        return t("lineup.blockers.size", { count: selectedPlayers.length });
      case "LINEUP_UNIQUE":
        return t("lineup.blockers.unique");
      case "LINEUP_CAPTAIN_REQUIRED":
        return t("lineup.blockers.captain");
      case "LINEUP_CAPTAIN_NOT_IN_LINEUP":
        return t("lineup.blockers.captainNotInLineup");
      case "LINEUP_NOT_PARTICIPANT":
        return t("lineup.blockers.notParticipant");
      case "LINEUP_OVER_BUDGET":
        return t("lineup.blockers.overBudget", {
          cost: formatDisplayMarketValue(totalCost),
          budget: formatDisplayMarketValue(budget),
        });
      case "LINEUP_LOCKED":
        return t("lineup.blockers.locked");
      default:
        return violation.message;
    }
  };

  const visibleBlockers = locked
    ? [{ code: "LINEUP_LOCKED" as const, message: t("lineup.blockers.locked") }]
    : violations;

  const handleSaveLineup = () => {
    if (!canSave || captain === null) return;
    saveLineupMutation.mutate({
      playerIds: selectedPlayers,
      captainId: captain,
    });
  };

  if (!match) {
    if (lastScoredMatch) {
      return (
        <LastScoredLineupSummary
          match={lastScoredMatch}
          players={players}
          user={user}
          onCreateMatch={onCreateMatch}
        />
      );
    }
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">{t("lineup.noMatch")}</h3>
          <p className="text-slate-400 mb-4">{t("lineup.noMatchDescription")}</p>
          {onCreateMatch && (
            <Button onClick={onCreateMatch} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {t("lineup.noMatchAdminCta")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4" />
          <p className="text-white">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  const budgetUsed = (totalCost / budget) * 100;

  return (
    <div className="space-y-6">
      {(selectedPlayers.length > 0 || existingLineup) && (
        <FootballFieldLineup
          lineup={
            existingLineup || {
              id: 0,
              matchId: match.id,
              userId: user?.id || 0,
              playerIds: selectedPlayers,
              captainId: captain || 0,
              totalCost,
              createdAt: new Date(),
            }
          }
          players={players}
          budget={budget}
        />
      )}

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>{t("lineup.title")}</span>
            <Badge variant="secondary" className="bg-emerald-600 text-white">
              {selectedPlayers.length}/5 {t("lineup.players")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white text-sm">{t("lineup.budget")}</span>
                <span className="text-white text-sm">
                  {formatDisplayMarketValue(totalCost)}/{formatDisplayMarketValue(budget)}
                </span>
              </div>
              <Progress
                value={budgetUsed}
                className="h-2"
                style={{
                  backgroundColor: budgetUsed > 100 ? "rgb(239 68 68)" : undefined,
                }}
              />
            </div>

            {captain && (
              <div className="flex items-center space-x-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-white text-sm">
                  {t("lineup.captain")}: {players.find((player) => player.id === captain)?.name}
                </span>
              </div>
            )}

            {visibleBlockers.length > 0 && (
              <ul className="text-amber-400 text-sm space-y-1">
                {visibleBlockers.map((violation) => (
                  <li key={violation.code}>{blockerCopy(violation)}</li>
                ))}
              </ul>
            )}

            <Button
              onClick={handleSaveLineup}
              disabled={!canSave || saveLineupMutation.isPending}
              title={!canSave && visibleBlockers[0] ? blockerCopy(visibleBlockers[0]) : undefined}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {saveLineupMutation.isPending ? t("common.saving") : t("lineup.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{t("lineup.availablePlayers")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectablePlayers.length > 0 ? (
              selectablePlayers.map((player) => {
                const isSelected = selectedPlayers.includes(player.id);
                const isCaptain = captain === player.id;

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                    } ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-500"
                        : "bg-slate-700/50 border-slate-600 hover:bg-slate-700/70"
                    }`}
                    onClick={() => handlePlayerToggle(player.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{player.emoji || "👤"}</div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">{player.name}</span>
                          {isCaptain && (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-slate-400">
                          <DollarSign className="w-3 h-3" />
                          <span>{formatDisplayMarketValue(player.marketValue || 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isSelected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCaptainSelect(player.id);
                          }}
                          className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                        >
                          <Star className={`w-4 h-4 ${isCaptain ? "fill-current" : ""}`} />
                        </Button>
                      )}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isSelected ? "bg-emerald-500" : "bg-slate-600"
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-white font-medium mb-2">{t("lineup.joinFirst")}</h3>
                <p className="text-slate-400">{t("lineup.joinFirstDescription")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
