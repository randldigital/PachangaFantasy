import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BarChart3, Code, History, List, Trophy, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClubRosterSection from "@/components/club/ClubRosterSection";
import ClubClasificacionSection from "@/components/club/ClubClasificacionSection";
import ClubHistorialSection from "@/components/club/ClubHistorialSection";
import ClubMatchBanner from "@/components/club/ClubMatchBanner";
import DeleteClubButton from "@/components/club/DeleteClubButton";
import LeaveOrganisationButton from "@/components/LeaveOrganisationButton";
import MembershipJoinToggle from "@/components/MembershipJoinToggle";
import PlanChip from "@/components/PlanChip";
import AdSlot from "@/components/AdSlot";
import AddPlayerForm from "@/components/league/AddPlayerForm";
import RosterManagerDialog from "@/components/league/RosterManagerDialog";
import StatsSection from "@/components/league/StatsSection";
import TierListSection from "@/components/league/TierListSection";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { pickActiveMatch } from "@shared/domain/matchLifecycle";
import { pickStatsMatch } from "@shared/domain/stats";
import { shouldRenderHubAd } from "@shared/domain/entitlements";
import type { Club, Match, Player } from "@shared/schema";

type ClubTab = "roster" | "clasificacion" | "historial" | "valoracion" | "stats";

/**
 * Club Mode hub. No lineup, no Team A/B, no Manager board. Valuation and Market Value
 * are present; they do not affect Club Player Points.
 */
export default function ClubHub() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ClubTab>("roster");
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const clubId = parseInt(id!);

  const { data: club, isLoading } = useQuery<Club>({
    queryKey: queryKeys.club(clubId),
    queryFn: () => api.get<Club>(`/api/clubs/${clubId}`),
  });

  const { data: matches = [] } = useQuery<Match[]>({
    queryKey: queryKeys.clubMatches(clubId),
    queryFn: () => api.get<Match[]>(`/api/clubs/${clubId}/matches`),
    enabled: Number.isFinite(clubId),
  });

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: queryKeys.clubPlayers(clubId),
    queryFn: () => api.get<Player[]>(`/api/clubs/${clubId}/players`),
    enabled: Number.isFinite(clubId),
  });

  const isAdmin = Boolean(user && club && user.id === club.createdBy);
  const activeMatch = pickActiveMatch(matches);
  const statsMatch = pickStatsMatch(matches);
  const bannerMatch =
    activeMatch ??
    (statsMatch?.status === "completed" || statsMatch?.status === "scored" ? statsMatch : undefined);

  const { data: pendingClaims = [] } = useQuery<{ id: number }[]>({
    queryKey: queryKeys.clubClaimRequests(clubId),
    queryFn: () => api.get<{ id: number }[]>(`/api/clubs/${clubId}/claim-requests`),
    enabled: isAdmin,
  });

  const { data: billing } = useQuery<{ planCode: string }>({
    queryKey: queryKeys.billingSubject("club", clubId),
    queryFn: () => api.get<{ planCode: string }>(`/api/billing/subject/club/${clubId}`),
    enabled: Number.isFinite(clubId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
          <p className="text-white mt-4">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">{t("club.notFound")}</h2>
          <Link href="/overview">
            <Button
              variant="outline"
              className="border-sky-500 text-sky-400 hover:bg-sky-500 hover:text-white"
            >
              {t("common.backToOverview")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/overview">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common.backToOverview")}
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-white">{club.name}</h1>
          <Badge variant="secondary" className="bg-sky-600 text-white border-0">
            {t("club.badge")}
          </Badge>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddPlayer(true)}
                className="border-sky-500 text-sky-400 hover:bg-sky-500 hover:text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {t("club.addPlayers")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRoster(true)}
                className="relative border-slate-500 text-slate-200 hover:bg-slate-700"
              >
                <Users className="w-4 h-4 mr-2" />
                {t("roster.manage")}
                {pendingClaims.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-900">
                    {pendingClaims.length}
                  </span>
                )}
              </Button>
              <DeleteClubButton club={club} isClubCreator={isAdmin} />
              <MembershipJoinToggle kind="club" organisationId={club.id} joinOpen={club.joinOpen !== false} />
            </div>
          )}
          {!isAdmin && <LeaveOrganisationButton kind="club" organisationId={club.id} />}
          <PlanChip type="club" id={club.id} />
          <div className="flex items-center gap-2 text-slate-400 text-sm ml-auto">
            <Users className="w-4 h-4" />
            <span>
              {club.participants?.length || 0} {t("common.participants")}
            </span>
            <Code className="w-4 h-4 ml-3" />
            <span className="font-mono text-xs">{club.inviteCode}</span>
          </div>
        </div>

        {shouldRenderHubAd(billing?.planCode) ? <AdSlot slot="hub.sidebar" /> : null}
        <ClubMatchBanner
          club={club}
          match={bannerMatch}
          user={user || undefined}
          players={players}
          createMatchOpen={showCreateMatch}
          onCreateMatchOpenChange={setShowCreateMatch}
          onOpenStats={() => setActiveTab("stats")}
        />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ClubTab)}>
          <TabsList className="flex flex-wrap h-auto bg-slate-800 border border-slate-700">
            <TabsTrigger value="roster" className="data-[state=active]:bg-sky-600">
              <Users className="w-4 h-4 mr-2" />
              {t("club.tabs.roster")}
            </TabsTrigger>
            <TabsTrigger value="clasificacion" className="data-[state=active]:bg-sky-600">
              <Trophy className="w-4 h-4 mr-2" />
              {t("club.tabs.clasificacion")}
            </TabsTrigger>
            <TabsTrigger value="historial" className="data-[state=active]:bg-sky-600">
              <History className="w-4 h-4 mr-2" />
              {t("club.tabs.historial")}
            </TabsTrigger>
            <TabsTrigger value="valoracion" className="data-[state=active]:bg-sky-600">
              <List className="w-4 h-4 mr-2" />
              {t("club.tabs.valoracion")}
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-sky-600">
              <BarChart3 className="w-4 h-4 mr-2" />
              {t("club.tabs.stats")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="mt-6">
            <ClubRosterSection
              clubId={clubId}
              onAddPlayer={isAdmin ? () => setShowAddPlayer(true) : undefined}
            />
          </TabsContent>
          <TabsContent value="clasificacion" className="mt-6">
            <ClubClasificacionSection clubId={clubId} />
          </TabsContent>
          <TabsContent value="historial" className="mt-6">
            <ClubHistorialSection
              clubId={clubId}
              onCreateMatch={isAdmin && !activeMatch ? () => setShowCreateMatch(true) : undefined}
            />
          </TabsContent>
          <TabsContent value="valoracion" className="mt-6">
            <TierListSection
              clubId={clubId}
              organisation={club}
              players={players}
              user={user || undefined}
              onAddPlayer={isAdmin ? () => setShowAddPlayer(true) : undefined}
            />
          </TabsContent>
          <TabsContent value="stats" className="mt-6">
            <StatsSection
              match={statsMatch}
              isAdmin={isAdmin}
              players={players}
              user={user || undefined}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AddPlayerForm
        clubId={clubId}
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
      />
      <RosterManagerDialog
        clubId={clubId}
        createdBy={club.createdBy}
        players={players}
        isOpen={showRoster}
        onClose={() => setShowRoster(false)}
      />
    </div>
  );
}
