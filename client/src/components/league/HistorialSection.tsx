import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, Users, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Match } from "@shared/schema";

interface HistorialSectionProps {
  matches: Match[];
  isLoading: boolean;
}

export default function HistorialSection({ matches, isLoading }: HistorialSectionProps) {
  const { t } = useTranslation();
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set());

  const toggleMatch = (matchId: number) => {
    setExpandedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600 text-white';
      case 'in_progress':
        return 'bg-yellow-600 text-white';
      case 'upcoming':
        return 'bg-blue-600 text-white';
      case 'cancelled':
        return 'bg-red-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const getStatusText = (status: string) => {
    return t(`match.status.${status}`);
  };

  // Filter and sort matches (past matches first, then upcoming)
  const pastMatches = matches.filter(match => match.status === 'completed').sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  const upcomingMatches = matches.filter(match => match.status !== 'completed').sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const allMatches = [...pastMatches, ...upcomingMatches];

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white">{t('common.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (allMatches.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">{t('historial.noMatches')}</h3>
          <p className="text-slate-400">{t('historial.noMatchesDescription')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          {t('historial.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allMatches.map((match) => {
            const isExpanded = expandedMatches.has(match.id);
            
            return (
              <Collapsible key={match.id} open={isExpanded} onOpenChange={() => toggleMatch(match.id)}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full p-4 h-auto justify-between hover:bg-slate-700/50 text-left"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="text-white font-medium">
                            {formatDate(match.date)}
                          </div>
                          <div className="text-slate-400 text-sm flex items-center space-x-2">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(match.date)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <Badge className={getStatusColor(match.status)}>
                        {getStatusText(match.status)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-white text-sm">
                          {t('match.budget')}: {match.lineupBudget}
                        </div>
                        <div className="text-slate-400 text-xs flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {/* participants count would go here */}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="px-4 pb-4">
                  <div className="border-t border-slate-700 pt-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Team A */}
                      <div className="space-y-2">
                        <h4 className="text-white font-medium flex items-center">
                          <Trophy className="w-4 h-4 mr-2 text-emerald-400" />
                          {t('match.teamA')}
                        </h4>
                        <div className="space-y-1">
                          {match.teamA && match.teamA.length > 0 ? (
                            match.teamA.map((playerId) => (
                              <div key={playerId} className="text-slate-300 text-sm">
                                {t('match.player')} {playerId}
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-400 text-sm">
                              {t('match.noPlayers')}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Team B */}
                      <div className="space-y-2">
                        <h4 className="text-white font-medium flex items-center">
                          <Trophy className="w-4 h-4 mr-2 text-blue-400" />
                          {t('match.teamB')}
                        </h4>
                        <div className="space-y-1">
                          {match.teamB && match.teamB.length > 0 ? (
                            match.teamB.map((playerId) => (
                              <div key={playerId} className="text-slate-300 text-sm">
                                {t('match.player')} {playerId}
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-400 text-sm">
                              {t('match.noPlayers')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Match Stats */}
                    {match.status === 'completed' && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-emerald-400 font-bold text-lg">
                              --
                            </div>
                            <div className="text-slate-400 text-sm">
                              {t('match.goals')}
                            </div>
                          </div>
                          <div>
                            <div className="text-emerald-400 font-bold text-lg">
                              --
                            </div>
                            <div className="text-slate-400 text-sm">
                              {t('match.assists')}
                            </div>
                          </div>
                          <div>
                            <div className="text-emerald-400 font-bold text-lg">
                              --
                            </div>
                            <div className="text-slate-400 text-sm">
                              {t('match.mvp')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}