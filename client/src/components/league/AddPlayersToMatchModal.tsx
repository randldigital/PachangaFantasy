import React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Player, Match } from "@shared/schema";

interface ParticipantWithUser {
  matchId: number;
  playerId: number;
  status: string;
  playerName: string;
  userId?: number;
  username?: string;
  userRole?: string;
}

interface AddPlayersToMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  players: Player[];
  participants: ParticipantWithUser[];
}

export default function AddPlayersToMatchModal({
  isOpen,
  onClose,
  match,
  players,
  participants
}: AddPlayersToMatchModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);

  // Get player IDs of existing participants
  const participantPlayerIds = participants.map(p => p.playerId);
  
  // Filter players - exclude those already in match
  const availablePlayers = (players || []).filter(player => 
    !participantPlayerIds.includes(player.id)
  );
  
  const alreadyJoinedPlayers = (players || []).filter(player =>
    participantPlayerIds.includes(player.id)
  );

  const addPlayersMutation = useMutation({
    mutationFn: async (playerIds: number[]) => {
      return apiRequest('POST', `/api/matches/${match.id}/add-players`, {
        playerIds
      });
    },
    onSuccess: (data) => {
      toast({
        title: t('common.success'),
        description: t('match.playersAdded', { count: data.addedCount }),
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/matches/${match.id}/participants`] });
      queryClient.invalidateQueries({ queryKey: [`/api/leagues/${match.leagueId}/matches`] });
      
      setSelectedPlayerIds([]);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: t('match.addPlayersError'),
        variant: 'destructive',
      });
    }
  });

  const handlePlayerToggle = (playerId: number) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPlayerIds.length === availablePlayers.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(availablePlayers.map(p => p.id));
    }
  };

  const handleSubmit = () => {
    if (selectedPlayerIds.length > 0) {
      addPlayersMutation.mutate(selectedPlayerIds);
    }
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            {t('match.addPlayersToMatch')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Available Players Section */}
          {availablePlayers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-300">
                  {t('match.availablePlayers')} ({availablePlayers.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-emerald-400 hover:text-emerald-300 text-xs"
                >
                  {selectedPlayerIds.length === availablePlayers.length 
                    ? t('common.deselectAll') 
                    : t('common.selectAll')
                  }
                </Button>
              </div>

              <div className="space-y-2">
                {availablePlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                  >
                    <Checkbox
                      checked={selectedPlayerIds.includes(player.id)}
                      onCheckedChange={() => handlePlayerToggle(player.id)}
                      className="border-slate-500"
                    />
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-emerald-600 text-white text-xs">
                        {getInitials(player.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{player.name}</p>
                      <p className="text-slate-400 text-xs">{player.position}</p>
                    </div>
                    <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                      ${player.marketValue}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Already Joined Players Section */}
          {alreadyJoinedPlayers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                {t('match.alreadyJoined')} ({alreadyJoinedPlayers.length})
              </h3>
              <div className="space-y-2">
                {alreadyJoinedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-slate-600/30 opacity-60"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-slate-600 text-white text-xs">
                        {getInitials(player.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{player.name}</p>
                      <p className="text-slate-400 text-xs">{player.position}</p>
                    </div>
                    <Badge variant="outline" className="text-xs border-slate-500 text-slate-400">
                      {t('match.joined')}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Players Available */}
          {availablePlayers.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('match.noPlayersAvailable')}</p>
              <p className="text-sm mt-1">{t('match.allPlayersAlreadyJoined')}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <X className="w-4 h-4 mr-2" />
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedPlayerIds.length === 0 || addPlayersMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {addPlayersMutation.isPending 
              ? t('common.adding') 
              : t('match.addSelectedPlayers', { count: selectedPlayerIds.length })
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}