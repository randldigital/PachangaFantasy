import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, DollarSign, Users, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import FootballFieldLineup from "./FootballFieldLineup";
import type { Match, League, Player, User, Lineup } from "@shared/schema";

interface LineupSectionProps {
  match?: Match;
  league: League;
  players: Player[];
  user?: User;
  isLoading: boolean;
}

export default function LineupSection({ 
  match, 
  league, 
  players, 
  user, 
  isLoading 
}: LineupSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [captain, setCaptain] = useState<number | null>(null);

  const { data: existingLineup } = useQuery<Lineup>({
    queryKey: [`/api/matches/${match?.id}/lineup`],
    queryFn: async () => {
      const response = await fetch(`/api/matches/${match?.id}/lineup`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch lineup');
      }
      return response.json();
    },
    enabled: !!match?.id
  });

  // Load existing lineup
  useEffect(() => {
    if (existingLineup) {
      setSelectedPlayers(existingLineup.playerIds || []);
      setCaptain(existingLineup.captainId || null);
    }
  }, [existingLineup]);

  const saveLineupMutation = useMutation({
    mutationFn: async (lineupData: any) => {
      return apiRequest('POST', `/api/matches/${match?.id}/lineup`, lineupData);
    },
    onSuccess: () => {
      toast({
        title: t('lineup.saved'),
        description: t('lineup.savedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/matches/${match?.id}/lineup`] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('lineup.saveError'),
        variant: 'destructive',
      });
    }
  });

  const handlePlayerToggle = (playerId: number) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        // Remove player
        if (captain === playerId) {
          setCaptain(null);
        }
        return prev.filter(id => id !== playerId);
      } else {
        // Add player (max 5)
        if (prev.length >= 5) {
          toast({
            title: t('lineup.maxPlayers'),
            description: t('lineup.maxPlayersDescription'),
            variant: 'destructive',
          });
          return prev;
        }
        return [...prev, playerId];
      }
    });
  };

  const handleCaptainSelect = (playerId: number) => {
    if (selectedPlayers.includes(playerId)) {
      setCaptain(captain === playerId ? null : playerId);
    }
  };

  const calculateCost = () => {
    return selectedPlayers.reduce((total, playerId) => {
      const player = players.find(p => p.id === playerId);
      return total + (player?.marketValue || 0);
    }, 0);
  };

  const canSaveLineup = () => {
    return selectedPlayers.length === 5 && captain !== null && calculateCost() <= (match?.lineupBudget || 100);
  };

  const handleSaveLineup = () => {
    if (!canSaveLineup()) return;
    
    saveLineupMutation.mutate({
      playerIds: selectedPlayers,
      captainId: captain,
      totalCost: calculateCost(),
    });
  };

  if (!match) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">No Active Match</h3>
          <p className="text-slate-400">Create a match first to set up lineups for this league.</p>
        </CardContent>
      </Card>
    );
  }

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

  const totalCost = calculateCost();
  const budget = match.lineupBudget || 100;
  const budgetUsed = (totalCost / budget) * 100;

  return (
    <div className="space-y-6">
      {/* Football Field Visualization */}
      {(selectedPlayers.length > 0 || existingLineup) && (
        <FootballFieldLineup 
          lineup={existingLineup || { 
            id: 0, 
            matchId: match?.id || 0, 
            userId: user?.id || 0, 
            playerIds: selectedPlayers, 
            captainId: captain || 0, 
            totalCost: calculateCost(),
            createdAt: new Date()
          }} 
          players={players} 
        />
      )}

      {/* Budget and Selection Summary */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>{t('lineup.title')}</span>
            <Badge variant="secondary" className="bg-emerald-600 text-white">
              {selectedPlayers.length}/5 {t('lineup.players')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Budget Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white text-sm">{t('lineup.budget')}</span>
                <span className="text-white text-sm">
                  {totalCost}/{budget}
                </span>
              </div>
              <Progress 
                value={budgetUsed} 
                className="h-2"
                // Use red color if over budget
                style={{ 
                  backgroundColor: budgetUsed > 100 ? 'rgb(239 68 68)' : undefined 
                }}
              />
            </div>

            {/* Captain Selection */}
            {captain && (
              <div className="flex items-center space-x-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-white text-sm">
                  {t('lineup.captain')}: {players.find(p => p.id === captain)?.name}
                </span>
                <Badge variant="secondary" className="bg-yellow-600 text-white text-xs">
                  2x {t('lineup.points')}
                </Badge>
              </div>
            )}

            {/* Save Button */}
            <Button
              onClick={handleSaveLineup}
              disabled={!canSaveLineup() || saveLineupMutation.isPending}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            >
              {saveLineupMutation.isPending ? t('common.saving') : t('lineup.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Player Selection */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{t('lineup.availablePlayers')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {players && players.length > 0 ? (
              players.map((player) => {
                const isSelected = selectedPlayers.includes(player.id);
                const isCaptain = captain === player.id;
                
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-500/20 border-emerald-500' 
                        : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700/70'
                    }`}
                    onClick={() => handlePlayerToggle(player.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{player.emoji || '👤'}</div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">{player.name}</span>
                          {isCaptain && (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-slate-400">
                          <DollarSign className="w-3 h-3" />
                          <span>{player.marketValue || 0}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {isSelected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCaptainSelect(player.id);
                          }}
                          className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                        >
                          <Star className={`w-4 h-4 ${isCaptain ? 'fill-current' : ''}`} />
                        </Button>
                      )}
                      
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}>
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">No players available in this league.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}