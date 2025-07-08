import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Plus, Users, Code, LogOut } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import CreateLeagueForm from "@/components/league/CreateLeagueForm";
import JoinLeagueForm from "@/components/league/JoinLeagueForm";
import type { League } from "@shared/schema";

export default function Overview() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [showJoinLeague, setShowJoinLeague] = useState(false);

  const { data: leagues = [], isLoading } = useQuery<League[]>({
    queryKey: ["/api/leagues"],
    queryFn: async () => {
      const response = await fetch("/api/leagues", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch leagues");
      return response.json();
    },
  });

  const handleLogout = () => {
    logout();
    toast({
      title: t("common.loggedOut"),
      description: t("common.loggedOutDescription"),
    });
  };

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
      {/* Header */}
      <div
        className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm"
        style={{ display: "none" }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <h1 className="text-2xl font-bold text-white">
                  Pachanga Fantasy
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-slate-700 text-white">
                    {user?.username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white hidden sm:inline">
                  {user?.username}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Action Buttons */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white">
            {t("overview.title")}
          </h2>
          <div className="flex space-x-3">
            <Dialog open={showJoinLeague} onOpenChange={setShowJoinLeague}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                >
                  <Users className="w-4 h-4 mr-2" />
                  {t("league.joinLeague")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {t("league.joinLeague")}
                  </DialogTitle>
                </DialogHeader>
                <JoinLeagueForm onSuccess={() => setShowJoinLeague(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={showCreateLeague} onOpenChange={setShowCreateLeague}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("league.createLeague")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {t("league.createLeague")}
                  </DialogTitle>
                </DialogHeader>
                <CreateLeagueForm
                  onSuccess={() => setShowCreateLeague(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* League Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card
                key={i}
                className="bg-slate-800/50 border-slate-700 animate-pulse"
              >
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
        ) : leagues.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {t("overview.noLeagues")}
            </h3>
            <p className="text-slate-400 mb-6">
              {t("overview.noLeaguesDescription")}
            </p>
            <Button
              onClick={() => setShowCreateLeague(true)}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("league.createLeague")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map((league) => (
              <Link key={league.id} href={`/league/${league.id}`}>
                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer group hover:scale-105">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white group-hover:text-emerald-400 transition-colors">
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
                          {league.participants?.length || 0}{" "}
                          {t("common.participants")}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-400">
                        <Code className="w-4 h-4" />
                        <span className="font-mono text-xs">
                          {league.inviteCode}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
