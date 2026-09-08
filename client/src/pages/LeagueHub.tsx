import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { ArrowLeft, Users, Trophy, List, User, Target, History, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import MobileBottomNav from "@/components/league/MobileBottomNav";
import MatchContextHeader from "@/components/league/MatchContextHeader";
import LineupSection from "@/components/league/LineupSection";
import ClasificacionSection from "@/components/league/ClasificacionSection";
import HistorialSection from "@/components/league/HistorialSection";
import TierListSection from "@/components/league/TierListSection";
import StatsSection from "@/components/league/StatsSection";
import PrimaryActionBanner from "@/components/league/PrimaryActionBanner";
import AddPlayerForm from "@/components/league/AddPlayerForm";
import DeleteLeagueButton from "@/components/league/DeleteLeagueButton";
import { pickActiveMatch } from "@shared/domain/matchLifecycle";
import { pickStatsMatch } from "@shared/domain/stats";
import type { HubTab } from "@shared/domain/primaryAction";
import type { League, Match, Player } from "@shared/schema";

export default function LeagueHub() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HubTab>("lineup");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const leagueId = parseInt(id!);

  const { data: league, isLoading: leagueLoading } = useQuery<League>({
    queryKey: queryKeys.league(leagueId),
    queryFn: () => api.get<League>(`/api/leagues/${leagueId}`),
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: queryKeys.leagueMatches(leagueId),
    queryFn: () => api.get<Match[]>(`/api/leagues/${leagueId}/matches`),
  });

  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: queryKeys.leaguePlayers(leagueId),
    queryFn: () => api.get<Player[]>(`/api/players/${leagueId}`),
  });

  const activeMatch = pickActiveMatch(matches);
  const statsMatch = pickStatsMatch(matches);
  const headerMatch = activeMatch ?? (statsMatch?.status === "completed" ? statsMatch : undefined);
  const isAdmin = Boolean(user && league && user.id === league.createdBy);

  if (leagueLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="text-white mt-4">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">{t("league.notFound")}</h2>
          <Link href="/overview">
            <Button variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white">
              {t("common.backToOverview")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-4 min-w-0">
              <Link href="/overview">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t("common.back")}
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-white truncate">{league.name}</h1>
                {league.description && (
                  <p className="text-slate-400 text-sm truncate">{league.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              {isAdmin && (
                <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddPlayer(true)}
                  className="border-slate-500 text-slate-200 hover:bg-slate-700"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{t("league.addPlayers")}</span>
                </Button>
                <DeleteLeagueButton league={league} isLeagueCreator={isAdmin} />
                </>
              )}
              <Badge variant="secondary" className="bg-slate-700 text-white">
                {league.inviteCode}
              </Badge>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400 text-sm">{league.participants?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrimaryActionBanner
        league={league}
        matches={matches}
        players={players}
        user={user || undefined}
        onTabChange={setActiveTab}
        onOpenAddPlayer={() => setShowAddPlayer(true)}
        onOpenCreateMatch={() => setShowCreateMatch(true)}
        onOpenMatchDetails={() => setShowMatchDetails(true)}
      />

      <MatchContextHeader
        match={headerMatch}
        league={league}
        user={user || undefined}
        players={players || []}
        createMatchOpen={showCreateMatch}
        onCreateMatchOpenChange={setShowCreateMatch}
        matchDetailsOpen={showMatchDetails}
        onMatchDetailsOpenChange={setShowMatchDetails}
      />

      <div className="container mx-auto px-4 py-6 pb-20 lg:pb-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as HubTab)} className="w-full">
          <TabsList className="hidden lg:grid w-full grid-cols-5 bg-slate-800 border-slate-700 mb-6">
            <TabsTrigger value="lineup" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Target className="w-4 h-4 mr-2" />
              {t("league.tabs.lineup")}
            </TabsTrigger>
            <TabsTrigger value="clasificacion" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-2" />
              {t("league.tabs.clasificacion")}
            </TabsTrigger>
            <TabsTrigger value="historial" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <History className="w-4 h-4 mr-2" />
              {t("league.tabs.historial")}
            </TabsTrigger>
            <TabsTrigger value="tierlist" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <List className="w-4 h-4 mr-2" />
              {t("league.tabs.tierlist")}
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <User className="w-4 h-4 mr-2" />
              {t("league.tabs.stats")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lineup" className="mt-0">
            <LineupSection
              match={activeMatch}
              league={league}
              players={players}
              user={user || undefined}
              isLoading={playersLoading}
              onCreateMatch={isAdmin ? () => setShowCreateMatch(true) : undefined}
            />
          </TabsContent>

          <TabsContent value="clasificacion" className="mt-0">
            <ClasificacionSection
              leagueId={leagueId}
              currentUser={user || undefined}
              onPlayMatch={() => setActiveTab("lineup")}
            />
          </TabsContent>

          <TabsContent value="historial" className="mt-0">
            <HistorialSection
              matches={matches}
              players={players}
              isLoading={matchesLoading}
              onCreateMatch={isAdmin ? () => setShowCreateMatch(true) : undefined}
            />
          </TabsContent>

          <TabsContent value="tierlist" className="mt-0">
            <TierListSection
              leagueId={leagueId}
              league={league}
              players={players}
              user={user || undefined}
              onAddPlayer={isAdmin ? () => setShowAddPlayer(true) : undefined}
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-0">
            <StatsSection
              match={statsMatch}
              league={league}
              players={players}
              user={user || undefined}
              onGoToMatch={() => setActiveTab("lineup")}
            />
          </TabsContent>
        </Tabs>
      </div>

      <MobileBottomNav activeTab={activeTab} setActiveTab={(tab) => setActiveTab(tab as HubTab)} />

      <AddPlayerForm
        leagueId={String(leagueId)}
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
      />
    </div>
  );
}
