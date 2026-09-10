import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Code, History, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClubRosterSection from "@/components/club/ClubRosterSection";
import ClubClasificacionSection from "@/components/club/ClubClasificacionSection";
import ClubHistorialSection from "@/components/club/ClubHistorialSection";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Club } from "@shared/schema";

type ClubTab = "roster" | "clasificacion" | "historial";

/**
 * Club Mode hub. Deliberately smaller than LeagueHub: no lineup, no valuation, no Team A/B.
 */
export default function ClubHub() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ClubTab>("roster");
  const clubId = parseInt(id!);

  const { data: club, isLoading } = useQuery<Club>({
    queryKey: queryKeys.club(clubId),
    queryFn: () => api.get<Club>(`/api/clubs/${clubId}`),
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
          <div className="flex items-center gap-2 text-slate-400 text-sm ml-auto">
            <Users className="w-4 h-4" />
            <span>
              {club.participants?.length || 0} {t("common.participants")}
            </span>
            <Code className="w-4 h-4 ml-3" />
            <span className="font-mono text-xs">{club.inviteCode}</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ClubTab)}>
          <TabsList className="bg-slate-800 border border-slate-700">
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
          </TabsList>

          <TabsContent value="roster" className="mt-6">
            <ClubRosterSection clubId={clubId} />
          </TabsContent>
          <TabsContent value="clasificacion" className="mt-6">
            <ClubClasificacionSection clubId={clubId} />
          </TabsContent>
          <TabsContent value="historial" className="mt-6">
            <ClubHistorialSection clubId={clubId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
