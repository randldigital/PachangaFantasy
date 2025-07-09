import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Users, Plus, UserPlus, Eye, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CreateMatchForm from "@/components/league/CreateMatchForm";
import TeamAssignmentPreview from "@/components/league/TeamAssignmentPreview";
import AddPlayersToMatchModal from "@/components/league/AddPlayersToMatchModal";
import type { Match, League, User, Player } from "@shared/schema";

interface MatchContextHeaderProps {
  match?: Match;
  league: League;
  user?: User;
  matches: Match[];
  players: Player[];
  onMatchAction?: () => void;
}

interface ParticipantWithUser {
  matchId: number;
  playerId: number;
  status: string;
  playerName: string;
  userId?: number;
  username?: string;
  userRole?: string;
}

export default function MatchContextHeader({ 
  match, 
  league, 
  user, 
  matches,
  players,
  onMatchAction 
}: MatchContextHeaderProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [showAddPlayers, setShowAddPlayers] = useState(false);

  // Check if user has joined the match
  const { data: participants = [], isLoading: participantsLoading } = useQuery<ParticipantWithUser[]>({
    queryKey: [`/api/matches/${match?.id}/participants`],
    queryFn: async () => {
      if (!match) return [];
      const response = await fetch(`/api/matches/${match.id}/participants`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch participants');
      return response.json();
    },
    enabled: !!match
  });

  const userHasJoined = participants.some(p => p.userId === user?.id && p.status === 'accepted');
  const acceptedParticipants = participants.filter(p => p.status === 'accepted');
  const isMatchFull = acceptedParticipants.length >= 10;

  const joinMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      return apiRequest('POST', `/api/matches/${matchId}/join`, {});
    },
    onSuccess: () => {
      toast({
        title: t('match.joined'),
        description: t('match.joinedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/leagues/${league.id}/matches`] });
      queryClient.invalidateQueries({ queryKey: [`/api/matches/${match?.id}/participants`] });
      onMatchAction?.();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('match.joinError'),
        variant: 'destructive',
      });
    }
  });

  const handleJoinMatch = () => {
    if (match) {
      joinMatchMutation.mutate(match.id);
    }
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

  if (match) {
    return (
      <>
        <Card className="mx-4 my-4 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">{formatDate(match.date)}</span>
                </div>
                <div className="flex items-center space-x-2 text-emerald-400">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">{formatTime(match.date)}</span>
                </div>
                <Badge variant="secondary" className="bg-emerald-600 text-white">
                  {t(`match.status.${match.status}`)}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">
                    {participantsLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      `${acceptedParticipants.length}/10`
                    )}
                  </span>
                </div>
                
                {userHasJoined ? (
                  <div className="flex items-center gap-2">
                    {/* League Creator: Add Players Button */}
                    {user?.id === league.createdBy && (
                      <Button
                        onClick={() => setShowAddPlayers(true)}
                        size="sm"
                        variant="outline"
                        className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        {t('match.addPlayers')}
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => setShowMatchDetails(true)}
                      size="sm"
                      variant="outline"
                      className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {t('match.view')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* League Creator: Add Players Button (even when not joined) */}
                    {user?.id === league.createdBy && (
                      <Button
                        onClick={() => setShowAddPlayers(true)}
                        size="sm"
                        variant="outline"
                        className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        {t('match.addPlayers')}
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleJoinMatch}
                      disabled={joinMatchMutation.isPending || isMatchFull}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                    >
                      {joinMatchMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {joinMatchMutation.isPending 
                        ? t('common.joining') 
                        : isMatchFull 
                          ? t('match.full') 
                          : t('match.join')
                      }
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showMatchDetails} onOpenChange={setShowMatchDetails}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                {t('match.details')} - {formatDate(match.date)}
              </DialogTitle>
            </DialogHeader>
            <TeamAssignmentPreview 
              match={match} 
              user={user}
              players={players}
              league={league}
            />
          </DialogContent>
        </Dialog>

        {/* Add Players Modal */}
        <AddPlayersToMatchModal
          isOpen={showAddPlayers}
          onClose={() => setShowAddPlayers(false)}
          match={match}
          players={players}
          participants={participants}
        />
      </>
    );
  }

  // No active match - show create match call-to-action
  if (league.createdBy === user?.id) {
    return (
      <Card className="mx-4 my-4 bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">{t('match.noActiveMatch')}</h3>
              <p className="text-slate-400 text-sm">{t('match.createMatchDescription')}</p>
            </div>
            
            <Dialog open={showCreateMatch} onOpenChange={setShowCreateMatch}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('match.createMatch')}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">{t('match.createMatch')}</DialogTitle>
                </DialogHeader>
                <CreateMatchForm 
                  leagueId={league.id}
                  onSuccess={() => {
                    setShowCreateMatch(false);
                    onMatchAction?.();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-4 my-4 bg-slate-800/50 border-slate-700">
      <CardContent className="p-4">
        <div className="text-center">
          <h3 className="text-white font-medium mb-2">{t('match.noActiveMatch')}</h3>
          <p className="text-slate-400 text-sm">{t('match.waitingForMatch')}</p>
        </div>
      </CardContent>
    </Card>
  );
}