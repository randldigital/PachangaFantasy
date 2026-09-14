import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Plus, Users, Code, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import CreateLeagueForm from "@/components/league/CreateLeagueForm";
import CreateClubForm from "@/components/club/CreateClubForm";
import JoinForm from "@/components/JoinForm";
import AdSlot from "@/components/AdSlot";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Club, League } from "@shared/schema";

export default function Overview() {
  const { t } = useTranslation();
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const { data: leagues = [], isLoading: loadingLeagues } = useQuery<League[]>({
    queryKey: queryKeys.leagues,
    queryFn: () => api.get<League[]>("/api/leagues"),
  });

  const { data: clubs = [], isLoading: loadingClubs } = useQuery<Club[]>({
    queryKey: queryKeys.clubs,
    queryFn: () => api.get<Club[]>("/api/clubs"),
  });

  const isLoading = loadingLeagues || loadingClubs;
  const isEmpty = leagues.length === 0 && clubs.length === 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-500";
      case "voting":
        return "bg-yellow-500";
      case "closed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return t("league.status.open");
      case "voting":
        return t("league.status.voting");
      case "closed":
        return t("league.status.closed");
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-3xl font-bold text-white">{t("overview.title")}</h2>
          <div className="flex flex-wrap gap-3">
            <Dialog open={showJoin} onOpenChange={setShowJoin}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                >
                  <Users className="w-4 h-4 mr-2" />
                  {t("join.submit")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">{t("join.title")}</DialogTitle>
                </DialogHeader>
                <JoinForm onSuccess={() => setShowJoin(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={showCreateLeague} onOpenChange={setShowCreateLeague}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("league.createLeague")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">{t("league.createLeague")}</DialogTitle>
                </DialogHeader>
                <CreateLeagueForm onSuccess={() => setShowCreateLeague(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={showCreateClub} onOpenChange={setShowCreateClub}>
              <DialogTrigger asChild>
                <Button className="bg-sky-600 hover:bg-sky-700">
                  <Shield className="w-4 h-4 mr-2" />
                  {t("club.createClub")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">{t("club.createClub")}</DialogTitle>
                </DialogHeader>
                <CreateClubForm onSuccess={() => setShowCreateClub(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <AdSlot slot="overview.banner" />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-slate-800/50 border-slate-700 animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-6 bg-slate-700 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-700 rounded w-full"></div>
                    <div className="h-4 bg-slate-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{t("overview.noLeagues")}</h3>
            <p className="text-slate-400 mb-6">{t("overview.noLeaguesDescription")}</p>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => setShowCreateLeague(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("league.createLeague")}
              </Button>
              <Button
                onClick={() => setShowCreateClub(true)}
                className="bg-sky-600 hover:bg-sky-700"
              >
                <Shield className="w-4 h-4 mr-2" />
                {t("club.createClub")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {leagues.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-slate-200 mb-4">
                  {t("overview.leaguesHeading")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {leagues.map((league) => (
                    <Link key={league.id} href={`/league/${league.id}`}>
                      <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 cursor-pointer group">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-white group-hover:text-emerald-400">
                              {league.name}
                            </CardTitle>
                            <Badge
                              variant="secondary"
                              className={`${getStatusColor(league.status)} text-white border-0`}
                            >
                              {getStatusText(league.status)}
                            </Badge>
                          </div>
                          {league.description && (
                            <p className="text-slate-400 text-sm line-clamp-2">
                              {league.description}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2 text-slate-400">
                              <Users className="w-4 h-4" />
                              <span>
                                {league.participants?.length || 0} {t("common.participants")}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-slate-400">
                              <Code className="w-4 h-4" />
                              <span className="font-mono text-xs">{league.inviteCode}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {clubs.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-slate-200 mb-4">
                  {t("overview.clubsHeading")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {clubs.map((club) => (
                    <Link key={club.id} href={`/club/${club.id}`}>
                      <Card className="bg-slate-800/50 border-sky-900/60 hover:bg-slate-800/70 cursor-pointer group">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-white group-hover:text-sky-400">
                              {club.name}
                            </CardTitle>
                            <Badge variant="secondary" className="bg-sky-600 text-white border-0">
                              {t("club.badge")}
                            </Badge>
                          </div>
                          {club.description && (
                            <p className="text-slate-400 text-sm line-clamp-2">
                              {club.description}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2 text-slate-400">
                              <Users className="w-4 h-4" />
                              <span>
                                {club.participants?.length || 0} {t("common.participants")}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-slate-400">
                              <Code className="w-4 h-4" />
                              <span className="font-mono text-xs">{club.inviteCode}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
