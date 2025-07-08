import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Users, Clock, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddPlayersToMatchModal from "./AddPlayersToMatchModal";
import type { Match, User, Player } from "@shared/schema";

interface ParticipantWithUser {
  matchId: number;
  userId: number;
  status: string;
  username: string;
  userRole: string;
}

interface TeamAssignmentPreviewProps {
  match: Match;
  user?: User;
  players?: Player[];
}

export default function TeamAssignmentPreview({ match, user, players = [] }: TeamAssignmentPreviewProps) {
  const { t } = useTranslation();
  const [showAddPlayers, setShowAddPlayers] = useState(false);

  const { data: participants = [], isLoading } = useQuery<ParticipantWithUser[]>({
    queryKey: [`/api/matches/${match.id}/participants`],
    queryFn: async () => {
      const response = await fetch(`/api/matches/${match.id}/participants`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch participants');
      return response.json();
    }
  });

  const acceptedParticipants = participants.filter(p => p.status === 'accepted');
  
  // Simple round-robin assignment for preview (odd/even index)
  const teamA = acceptedParticipants.filter((_, index) => index % 2 === 0);
  const teamB = acceptedParticipants.filter((_, index) => index % 2 === 1);

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const isMatchSoon = () => {
    const matchDate = new Date(match.date);
    const now = new Date();
    const timeDiff = matchDate.getTime() - now.getTime();
    return timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000; // Within 24 hours
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            <div className="h-5 w-32 bg-slate-600 animate-pulse rounded"></div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-slate-600 animate-pulse rounded"></div>
            <div className="h-32 bg-slate-600 animate-pulse rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            {t('match.teamAssignment')} ({acceptedParticipants.length}/10)
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Admin: Add Players Button */}
            {user?.role === 'admin' && (
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
            
            {isMatchSoon() && (
              <Badge variant="outline" className="border-orange-500 text-orange-400">
                <Clock className="w-3 h-3 mr-1" />
                {t('match.startingSoon')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {acceptedParticipants.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('match.noParticipants')}</p>
            <p className="text-sm mt-1">{t('match.beFirstToJoin')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Team A */}
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-blue-400 text-sm font-medium flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    {t('match.teamA')} ({teamA.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teamA.map((participant) => (
                    <div key={participant.userId} className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/5">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-blue-600 text-white text-xs">
                          {getInitials(participant.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{participant.username}</p>
                        {participant.userRole === 'admin' && (
                          <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                            {t('common.admin')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {teamA.length < 5 && (
                    <div className="text-center py-2 text-slate-500 text-sm border-2 border-dashed border-slate-600 rounded-lg">
                      {t('match.awaitingPlayers', { count: 5 - teamA.length })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Team B */}
              <Card className="bg-red-500/10 border-red-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-red-400 text-sm font-medium flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    {t('match.teamB')} ({teamB.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teamB.map((participant) => (
                    <div key={participant.userId} className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-red-600 text-white text-xs">
                          {getInitials(participant.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{participant.username}</p>
                        {participant.userRole === 'admin' && (
                          <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
                            {t('common.admin')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {teamB.length < 5 && (
                    <div className="text-center py-2 text-slate-500 text-sm border-2 border-dashed border-slate-600 rounded-lg">
                      {t('match.awaitingPlayers', { count: 5 - teamB.length })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {acceptedParticipants.length >= 10 && (
              <div className="text-center">
                <Badge className="bg-emerald-600 text-white">
                  {t('match.readyToStart')}
                </Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
      
      {/* Add Players Modal */}
      <AddPlayersToMatchModal
        isOpen={showAddPlayers}
        onClose={() => setShowAddPlayers(false)}
        match={match}
        players={players}
        participants={participants}
      />
    </Card>
  );
}