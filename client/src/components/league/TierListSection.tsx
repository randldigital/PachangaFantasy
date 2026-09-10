import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, List, RotateCcw, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  VALUATION_TIERS,
  type PlayerTierPlacement,
  type ValuationTier,
} from "@shared/domain/valuation";
import type { Player, User, TierList } from "@shared/schema";

interface ValuationOrganisation {
  createdBy: number;
  participants?: number[] | null;
  status: string;
}

interface TierListSectionProps {
  leagueId?: number;
  clubId?: number;
  organisation: ValuationOrganisation;
  players: Player[];
  user?: User;
  onAddPlayer?: () => void;
}

const TIER_STYLES: Record<ValuationTier, string> = {
  S: "border-yellow-500 bg-yellow-500 text-slate-900",
  A: "border-emerald-500 bg-emerald-500 text-slate-900",
  B: "border-blue-500 bg-blue-500 text-white",
  C: "border-purple-500 bg-purple-500 text-white",
  D: "border-red-500 bg-red-500 text-white",
};

export default function TierListSection({
  leagueId,
  clubId,
  organisation,
  players,
  user,
  onAddPlayer,
}: TierListSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [placements, setPlacements] = useState<Record<number, ValuationTier>>({});
  const [closeOpen, setCloseOpen] = useState(false);

  const isClub = clubId != null;
  const basePath = isClub ? `/api/clubs/${clubId}/tierlist` : `/api/tierlist/${leagueId}`;
  const isAdmin = user?.id === organisation.createdBy;
  const memberCount = Math.max(organisation.participants?.length ?? 0, 1);
  const valuationOpen = organisation.status === "voting";
  const valuationClosed = organisation.status === "closed";

  const { data: existingTierList, isLoading: tierListLoading } = useQuery<TierList | null>({
    queryKey: isClub ? queryKeys.clubTierList(clubId) : queryKeys.tierList(leagueId!),
    queryFn: () => api.get<TierList | null>(basePath),
    enabled: isClub || leagueId != null,
  });

  const { data: allTierLists = [] } = useQuery<TierList[]>({
    queryKey: isClub ? queryKeys.clubTierListsAll(clubId) : queryKeys.tierListsAll(leagueId!),
    queryFn: () => api.get<TierList[]>(`${basePath}/all`),
    enabled: isClub || leagueId != null,
  });

  useEffect(() => {
    const next: Record<number, ValuationTier> = {};
    for (const placement of existingTierList?.playerTiers ?? []) {
      next[placement.playerId] = placement.tier;
    }
    setPlacements(next);
  }, [existingTierList]);

  const unplacedCount = players.filter((player) => !placements[player.id]).length;
  const allPlaced = players.length > 0 && unplacedCount === 0;
  const hasSubmitted = Boolean(existingTierList?.submitted);
  const submittedCount = allTierLists.length;
  const fewVotes = submittedCount === 0 || submittedCount < Math.ceil(memberCount / 2);

  const invalidateValuation = async () => {
    if (isClub && clubId != null) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.clubTierList(clubId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clubTierListsAll(clubId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clubPlayers(clubId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.club(clubId) }),
      ]);
      return;
    }
    if (leagueId != null) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tierList(leagueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tierListsAll(leagueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaguePlayers(leagueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.league(leagueId) }),
      ]);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (data: { playerTiers: PlayerTierPlacement[]; submitted: boolean }) => {
      return api.post(basePath, data);
    },
    onSuccess: () => {
      toast({
        title: t("tierlist.submitted"),
        description: t("tierlist.submittedDescription"),
      });
      void invalidateValuation();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t) || t("tierlist.submitError"),
        variant: "destructive",
      });
    },
  });

  const openMutation = useMutation({
    mutationFn: async () => api.post(`${basePath}/open`),
    onSuccess: () => {
      toast({ title: t("tierlist.opened") });
      void invalidateValuation();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => api.post(`${basePath}/close`),
    onSuccess: () => {
      toast({ title: t("tierlist.closed") });
      setCloseOpen(false);
      void invalidateValuation();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const orderedPlayers = useMemo(() => {
    if (valuationClosed) {
      return [...players].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
    }
    return [...players].sort((a, b) => {
      const aPlaced = placements[a.id] ? 1 : 0;
      const bPlaced = placements[b.id] ? 1 : 0;
      if (aPlaced !== bPlaced) return aPlaced - bPlaced;
      return a.name.localeCompare(b.name);
    });
  }, [players, placements, valuationClosed]);

  const handleSubmit = () => {
    if (!allPlaced) return;
    submitMutation.mutate({
      playerTiers: players.map((player) => ({
        playerId: player.id,
        tier: placements[player.id]!,
      })),
      submitted: true,
    });
  };

  const handleReset = () => setPlacements({});

  if (tierListLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4" />
          <p className="text-white">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  if (!players || players.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">{t("tierlist.noPlayers")}</h3>
          <p className="text-slate-400 mb-4">
            {t(isClub ? "tierlist.noPlayersDescriptionClub" : "tierlist.noPlayersDescription")}
          </p>
          {onAddPlayer && (
            <Button onClick={onAddPlayer} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {t("tierlist.addPlayersCta")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const statusCopy = valuationOpen
    ? t("tierlist.placeInTier")
    : valuationClosed
      ? t("tierlist.votingClosed")
      : t("tierlist.notOpen");

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center">
              <List className="w-5 h-5 mr-2" />
              {t("tierlist.title")}
            </div>
            <div className="flex items-center space-x-2">
              {hasSubmitted && (
                <Badge variant="secondary" className="bg-green-600 text-white">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {t("tierlist.submitted")}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-slate-700 text-white">
                {t("tierlist.submissionsOf", { submitted: submittedCount, total: memberCount })}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-400">{statusCopy}</p>
          {valuationOpen && (
            <p className="text-slate-500 text-sm">{t("tierlist.editWhileOpen")}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {isAdmin && !valuationOpen && (
              <Button
                onClick={() => openMutation.mutate()}
                disabled={openMutation.isPending}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              >
                {valuationClosed ? t("tierlist.reopenValuation") : t("tierlist.openValuation")}
              </Button>
            )}

            {valuationOpen && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="border-slate-600 text-slate-400 hover:bg-slate-700"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t("tierlist.reset")}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || !allPlaced}
                  size="sm"
                  title={!allPlaced ? t("tierlist.submitBlocked", { count: unplacedCount }) : undefined}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitMutation.isPending
                    ? t("common.submitting")
                    : hasSubmitted
                      ? t("tierlist.update")
                      : t("tierlist.submit")}
                </Button>
                {!allPlaced && valuationOpen && (
                  <p className="text-amber-400 text-sm w-full">
                    {t("tierlist.submitBlocked", { count: unplacedCount })}
                  </p>
                )}
              </>
            )}

            {isAdmin && valuationOpen && (
              <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-amber-500 text-amber-400 hover:bg-amber-500/10">
                    {t("tierlist.closeValuation")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("tierlist.closeConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-300 space-y-2">
                      <span className="block">
                        {t("tierlist.closeConfirmCount", {
                          submitted: submittedCount,
                          total: memberCount,
                        })}
                      </span>
                      {fewVotes && (
                        <span className="block text-amber-400">
                          {submittedCount === 0
                            ? t("tierlist.closeConfirmWarnNone")
                            : t("tierlist.closeConfirmWarn")}
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-800 border-slate-600 text-white">
                      {t("common.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-amber-500 text-slate-900 hover:bg-amber-400"
                      onClick={(event) => {
                        event.preventDefault();
                        closeMutation.mutate();
                      }}
                      disabled={closeMutation.isPending}
                    >
                      {fewVotes ? t("tierlist.closeAnyway") : t("tierlist.closeValuation")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6 space-y-3">
          {orderedPlayers.map((player) => {
            const tier = placements[player.id];
            const unplaced = valuationOpen && !tier;
            return (
              <div
                key={player.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border",
                  unplaced ? "border-amber-500/70 bg-amber-500/10" : "border-slate-600 bg-slate-800/40",
                )}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {tier && (
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                        TIER_STYLES[tier],
                      )}
                    >
                      {tier}
                    </div>
                  )}
                  <div className="text-2xl">{player.emoji || "👤"}</div>
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">{player.name}</div>
                    {unplaced && (
                      <div className="text-amber-400 text-sm">{t("tierlist.unplaced")}</div>
                    )}
                  </div>
                </div>

                {valuationOpen ? (
                  <div className="flex flex-wrap gap-1">
                    {VALUATION_TIERS.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPlacements((current) => ({ ...current, [player.id]: option }))
                        }
                        className={cn(
                          "w-10 px-0",
                          tier === option
                            ? TIER_STYLES[option]
                            : "border-slate-600 text-slate-300 hover:bg-slate-700",
                        )}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">${player.marketValue ?? 0}</div>
                    <div className="text-slate-400 text-xs">{t("tierlist.marketValue")}</div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
