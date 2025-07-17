import React from "react";
import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Calendar, Users, Trophy, List, User, Target, History } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import MobileBottomNav from "@/components/league/MobileBottomNav";
import MatchContextHeader from "@/components/league/MatchContextHeader";
import TeamAssignmentPreview from "@/components/league/TeamAssignmentPreview";
import LineupSection from "@/components/league/LineupSection";
import ClasificacionSection from "@/components/league/ClasificacionSection";
import HistorialSection from "@/components/league/HistorialSection";
import TierListSection from "@/components/league/TierListSection";
import SubmitMyStats from "@/components/league/SubmitMyStats";
import AdminStatsOverview from "@/components/league/AdminStatsOverview";
import type { League, Match, Player } from "@shared/schema";
import { FEATURE_VOTING, FEATURE_WRAPPED } from '../constants';

export default function LeagueHub() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('lineup');
  const leagueId = parseInt(id!);

  const { data: league, isLoading: leagueLoading } = useQuery<League>({
    queryKey: [`/api/leagues/${leagueId}`],
    queryFn: async () => {
      const response = await fetch(`/api/leagues/${leagueId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch league');
      return response.json();
    }
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: [`/api/leagues/${leagueId}/matches`],
    queryFn: async () => {
      const response = await fetch(`/api/leagues/${leagueId}/matches`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch matches');
      return response.json();
    }
  });

  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: [`/api/players/${leagueId}`],
    queryFn: async () => {
      const response = await fetch(`/api/players/${leagueId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch players');
      return response.json();
    }
  });

  // Find active match
  const activeMatch = matches && matches.length > 0 ? matches.find(match => match.status === 'open' || match.status === 'ready') || matches[0] : undefined;

  if (leagueLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="text-white mt-4">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">{t('league.notFound')}</h2>
          <Link href="/overview">
            <Button variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white">
              {t('common.backToOverview')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/overview">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('common.back')}
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">{league.name}</h1>
                <p className="text-slate-400 text-sm">{league.description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
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

      {/* Match Context Header */}
      <MatchContextHeader 
        match={activeMatch} 
        league={league} 
        user={user || undefined}
        matches={matches}
        players={players || []}
        onMatchAction={() => {
          // Refresh matches data
        }}
      />

      {/* Team Assignment Preview - Show when there's an active match */}
      {activeMatch && (
        <div className="container mx-auto px-4 pb-4">
          <TeamAssignmentPreview 
            match={activeMatch} 
            user={user || undefined}
            players={players || []}
            league={league}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 pb-20 lg:pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-5 bg-slate-800 border-slate-700 mb-6">
            <TabsTrigger 
              value="lineup" 
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <Target className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('league.tabs.lineup')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="clasificacion" 
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <Trophy className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('league.tabs.clasificacion')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="historial" 
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <History className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('league.tabs.historial')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="tierlist" 
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <List className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('league.tabs.tierlist')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <User className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('league.tabs.stats')}</span>
            </TabsTrigger>
            {FEATURE_VOTING && (
              <TabsTrigger value="voting" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Trophy className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Voting (FUTURE)</span>
              </TabsTrigger>
            )}
            {FEATURE_WRAPPED && (
              <TabsTrigger value="wrapped" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <History className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Wrapped (FUTURE)</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="lineup" className="mt-0">
            <LineupSection 
              match={activeMatch} 
              league={league} 
              players={players}
              user={user || undefined}
              isLoading={playersLoading}
            />
          </TabsContent>

          <TabsContent value="clasificacion" className="mt-0">
            <ClasificacionSection 
              leagueId={leagueId}
              currentUser={user || undefined}
            />
          </TabsContent>

          <TabsContent value="historial" className="mt-0">
            <HistorialSection 
              matches={matches}
              isLoading={matchesLoading}
            />
          </TabsContent>

          <TabsContent value="tierlist" className="mt-0">
            <TierListSection 
              leagueId={leagueId}
              league={league}
              players={players}
              user={user || undefined}
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-0">
            <div className="space-y-6">
              {/* Stats submission for completed matches */}
              {activeMatch && activeMatch.status === 'completed' && (
                <>
                  {/* User stats submission */}
                  {user && (
                    <SubmitMyStats 
                      match={activeMatch}
                      userId={user.id}
                      isParticipant={true} // This prop is ignored, component checks internally
                    />
                  )}
                  
                  {/* Admin overview for league creator */}
                  {user && (
                    <AdminStatsOverview 
                      match={activeMatch}
                      isLeagueCreator={league.createdBy === user.id}
                    />
                  )}
                </>
              )}
              
              {/* Placeholder for non-completed matches */}
              {(!activeMatch || activeMatch.status !== 'completed') && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <User className="w-5 h-5 mr-2" />
                      {t('league.tabs.stats')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400">
                      {activeMatch 
                        ? "Match statistics will be available after the match is completed."
                        : "No active match. Create a match to access statistics."
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {FEATURE_VOTING && (
            <TabsContent value="voting" className="mt-0">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Trophy className="w-5 h-5 mr-2" />
                    Voting (FUTURE)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400">MVP/Disappointment voting will be available in a future release.</p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
          {FEATURE_WRAPPED && (
            <TabsContent value="wrapped" className="mt-0">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <History className="w-5 h-5 mr-2" />
                    Wrapped (FUTURE)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400">End-of-season highlights will be available in a future release.</p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}