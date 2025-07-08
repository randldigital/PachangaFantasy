import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
// Note: restrictToVerticalAxis would be imported from @dnd-kit/modifiers if needed
import { List, Trophy, Award, Star, Users, CheckCircle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SortablePlayerItem from "@/components/league/SortablePlayerItem";
import type { League, Player, User, TierList } from "@shared/schema";

interface TierListSectionProps {
  leagueId: number;
  league: League;
  players: Player[];
  user?: User;
}

export default function TierListSection({ leagueId, league, players, user }: TierListSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [playerOrder, setPlayerOrder] = useState<number[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: existingTierList, isLoading: tierListLoading } = useQuery<TierList>({
    queryKey: [`/api/tierlist/${leagueId}`],
    queryFn: async () => {
      const response = await fetch(`/api/tierlist/${leagueId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch tier list');
      }
      return response.json();
    }
  });

  const { data: allTierLists = [], isLoading: allTierListsLoading } = useQuery<TierList[]>({
    queryKey: [`/api/tierlist/${leagueId}/all`],
    queryFn: async () => {
      const response = await fetch(`/api/tierlist/${leagueId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch tier lists');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // Initialize player order from existing tier list or default order
  useEffect(() => {
    if (existingTierList) {
      setPlayerOrder(existingTierList.playerOrder || []);
      setHasSubmitted(existingTierList.submitted || false);
    } else if (players && players.length > 0) {
      // Default order: all players
      setPlayerOrder(players.map(p => p.id));
      setHasSubmitted(false);
    }
  }, [existingTierList, players]);

  const submitTierListMutation = useMutation({
    mutationFn: async (data: { playerOrder: number[]; submitted: boolean }) => {
      return apiRequest(`/api/tierlist/${leagueId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: t('tierlist.submitted'),
        description: t('tierlist.submittedDescription'),
      });
      setHasSubmitted(true);
      queryClient.invalidateQueries({ queryKey: [`/api/tierlist/${leagueId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/players/${leagueId}`] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('tierlist.submitError'),
        variant: 'destructive',
      });
    }
  });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setPlayerOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = () => {
    if (playerOrder.length === 0) return;
    
    submitTierListMutation.mutate({
      playerOrder,
      submitted: true
    });
  };

  const handleReset = () => {
    if (players && players.length > 0) {
      setPlayerOrder(players.map(p => p.id));
      setHasSubmitted(false);
    }
  };

  const getTierColor = (index: number, total: number) => {
    const percentage = index / Math.max(total - 1, 1);
    
    if (percentage <= 0.2) return 'bg-gradient-to-r from-yellow-500 to-yellow-600'; // S tier
    if (percentage <= 0.4) return 'bg-gradient-to-r from-emerald-500 to-emerald-600'; // A tier
    if (percentage <= 0.6) return 'bg-gradient-to-r from-blue-500 to-blue-600'; // B tier
    if (percentage <= 0.8) return 'bg-gradient-to-r from-purple-500 to-purple-600'; // C tier
    return 'bg-gradient-to-r from-red-500 to-red-600'; // D tier
  };

  const getTierLabel = (index: number, total: number) => {
    const percentage = index / Math.max(total - 1, 1);
    
    if (percentage <= 0.2) return 'S';
    if (percentage <= 0.4) return 'A';
    if (percentage <= 0.6) return 'B';
    if (percentage <= 0.8) return 'C';
    return 'D';
  };

  const calculateMarketValues = () => {
    if (!allTierLists || allTierLists.length === 0) return {};
    
    const playerPositions: { [playerId: number]: number[] } = {};
    
    // Collect all positions for each player
    (allTierLists || []).forEach(tierList => {
      tierList.playerOrder?.forEach((playerId, index) => {
        if (!playerPositions[playerId]) {
          playerPositions[playerId] = [];
        }
        playerPositions[playerId].push(index);
      });
    });
    
    // Calculate average positions and market values
    const marketValues: { [playerId: number]: number } = {};
    Object.entries(playerPositions).forEach(([playerId, positions]) => {
      const avgPosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
      const totalPlayers = players.length;
      const marketValue = Math.max(1, Math.round(100 - (avgPosition / totalPlayers) * 100));
      marketValues[parseInt(playerId)] = marketValue;
    });
    
    return marketValues;
  };

  const marketValues = calculateMarketValues();

  if (tierListLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white">{t('common.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (!players || players.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">{t('tierlist.noPlayers')}</h3>
          <p className="text-slate-400">{t('tierlist.noPlayersDescription')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center">
              <List className="w-5 h-5 mr-2" />
              {t('tierlist.title')}
            </div>
            <div className="flex items-center space-x-2">
              {hasSubmitted && (
                <Badge variant="secondary" className="bg-green-600 text-white">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {t('tierlist.submitted')}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-slate-700 text-white">
                {allTierLists.length} {t('tierlist.submissions')}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-slate-400">
              {league.status === 'voting' 
                ? t('tierlist.dragToRank')
                : t('tierlist.votingClosed')
              }
            </p>
            
            {league.status === 'voting' && !hasSubmitted && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="border-slate-600 text-slate-400 hover:bg-slate-700"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t('tierlist.reset')}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitTierListMutation.isPending || playerOrder.length === 0}
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                >
                  {submitTierListMutation.isPending ? t('common.submitting') : t('tierlist.submit')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tier List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          {league.status === 'voting' && !hasSubmitted ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              // modifiers={[restrictToVerticalAxis]} // Removed for now
            >
              <SortableContext items={playerOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {playerOrder.map((playerId, index) => {
                    const player = players.find(p => p.id === playerId);
                    if (!player) return null;
                    
                    return (
                      <SortablePlayerItem
                        key={playerId}
                        player={player}
                        index={index}
                        tierColor={getTierColor(index, playerOrder.length)}
                        tierLabel={getTierLabel(index, playerOrder.length)}
                        marketValue={marketValues[playerId]}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="space-y-3">
              {playerOrder.map((playerId, index) => {
                const player = players.find(p => p.id === playerId);
                if (!player) return null;
                
                return (
                  <div
                    key={playerId}
                    className={`flex items-center justify-between p-4 rounded-lg border border-slate-600 ${
                      getTierColor(index, playerOrder.length)
                    }/20`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        getTierColor(index, playerOrder.length)
                      }`}>
                        {getTierLabel(index, playerOrder.length)}
                      </div>
                      <div className="text-2xl">{player.emoji || '👤'}</div>
                      <div>
                        <div className="text-white font-medium">{player.name}</div>
                        <div className="text-slate-400 text-sm">
                          {t('tierlist.position')} {index + 1}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {marketValues[playerId] && (
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold">
                            ${marketValues[playerId]}
                          </div>
                          <div className="text-slate-400 text-xs">
                            {t('tierlist.marketValue')}
                          </div>
                        </div>
                      )}
                      
                      {index === 0 && (
                        <Trophy className="w-5 h-5 text-yellow-500" />
                      )}
                      {index === 1 && (
                        <Award className="w-5 h-5 text-gray-400" />
                      )}
                      {index === 2 && (
                        <Star className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}