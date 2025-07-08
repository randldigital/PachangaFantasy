import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Users, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CreateMatchForm from "@/components/league/CreateMatchForm";
import type { Match, League, User } from "@shared/schema";

interface MatchContextHeaderProps {
  match?: Match;
  league: League;
  user?: User;
  matches: Match[];
  onMatchAction?: () => void;
}

export default function MatchContextHeader({ 
  match, 
  league, 
  user, 
  matches,
  onMatchAction 
}: MatchContextHeaderProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateMatch, setShowCreateMatch] = useState(false);

  const joinMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      return apiRequest(`/api/matches/${matchId}/join`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: t('match.joined'),
        description: t('match.joinedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/leagues/${league.id}/matches`] });
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
                <span className="text-sm">{/* participants count */}</span>
              </div>
              <Button
                onClick={handleJoinMatch}
                disabled={joinMatchMutation.isPending}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {joinMatchMutation.isPending ? t('common.joining') : t('match.join')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
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