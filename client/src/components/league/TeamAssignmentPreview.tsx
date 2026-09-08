import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import AddPlayersToMatchModal from "./AddPlayersToMatchModal";
import { isJoinableStatus } from "@shared/domain/matchLifecycle";
import type { Match, User, Player } from "@shared/schema";

interface ParticipantWithUser {
  matchId: number;
  playerId: number;
  status: string;
  playerName: string;
  userId?: number;
  username?: string;
}

interface TeamAssignmentPreviewProps {
  match: Match;
  user?: User;
  players?: Player[];
  league?: { createdBy: number };
}

export default function TeamAssignmentPreview({ match, user, players = [], league }: TeamAssignmentPreviewProps) {
  const { t } = useTranslation();
  const [showAddPlayers, setShowAddPlayers] = useState(false);

  const { data: participants = [], isLoading } = useQuery<ParticipantWithUser[]>({
    queryKey: queryKeys.matchParticipants(match.id),
    queryFn: () => api.get<ParticipantWithUser[]>(`/api/matches/${match.id}/participants`),
  });

  const acceptedParticipants = participants.filter((participant) => participant.status === "accepted");
  const canAdd = Boolean(user && league && user.id === league.createdBy && isJoinableStatus(match.status));

  const getInitials = (username: string) => username.substring(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            <div className="h-5 w-32 bg-slate-600 animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            {t("match.participants")} ({acceptedParticipants.length})
          </CardTitle>
          {canAdd && (
            <Button
              onClick={() => setShowAddPlayers(true)}
              size="sm"
              variant="outline"
              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              {t("match.addPlayers")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {acceptedParticipants.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t("match.noParticipants")}</p>
            <p className="text-sm mt-1">{t("match.beFirstToJoin")}</p>
          </div>
        ) : (
          acceptedParticipants.map((participant) => {
            const displayName = participant.username || participant.playerName || "Unknown Player";
            return (
              <div key={participant.playerId} className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/40">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-emerald-600 text-white text-xs">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{displayName}</p>
                </div>
                {!participant.userId && (
                  <Badge variant="outline" className="text-xs border-slate-500/50 text-slate-400">
                    {t("match.player")}
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </CardContent>
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
