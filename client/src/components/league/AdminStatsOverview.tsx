import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator, 
  CheckCircle, 
  Clock, 
  Users, 
  Trophy,
  AlertTriangle 
} from "lucide-react";
import type { Match, StatReport } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface AdminStatsOverviewProps {
  match: Match;
  isLeagueCreator: boolean;
}

interface ParticipantDetail {
  matchId: number;
  playerId: number;
  status: string;
  playerName: string;
  userId?: number;
  username?: string;
  userRole?: string;
}

export default function AdminStatsOverview({ match, isLeagueCreator }: AdminStatsOverviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Get match participants
  const { data: participants = [] } = useQuery<ParticipantDetail[]>({
    queryKey: ['/api/matches', match.id, 'participants'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/matches/${match.id}/participants`);
      return response.json();
    },
    enabled: match.status === 'completed',
  });

  // Get stat reports
  const { data: statReports = [] } = useQuery<StatReport[]>({
    queryKey: ['/api/matches', match.id, 'stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/matches/${match.id}/stats`);
      return response.json();
    },
    enabled: match.status === 'completed',
  });

  const calculateScoresMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/matches/${match.id}/calculate-scores`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('stats.calculateSuccess'),
        description: t('stats.calculateSuccessDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', match.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
    },
    onError: (error: unknown) => {
      toast({
        title: t('stats.calculateErrorTitle'),
        description: t('stats.calculateError'),
        variant: 'destructive',
      });
    },
  });

  // Only show to league creators when match is completed
  if (!isLeagueCreator || match.status !== 'completed') {
    return null;
  }

  const acceptedParticipants = participants.filter(p => p.status === 'accepted');
  const participantsWithStats = acceptedParticipants.filter(p => 
    statReports.some(report => report.userId === p.userId)
  );
  const participantsWithoutStats = acceptedParticipants.filter(p => 
    !statReports.some(report => report.userId === p.userId)
  );

  const allStatsSubmitted = acceptedParticipants.length > 0 && participantsWithoutStats.length === 0;
  const someStatsSubmitted = participantsWithStats.length > 0;

  return (
    <Card className="bg-[#1e1e1e] border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-400" />
          Stats Submission Overview
          <Badge variant="secondary" className="ml-auto">
            {participantsWithStats.length}/{acceptedParticipants.length} submitted
          </Badge>
        </CardTitle>
        <CardDescription>
          Track which players have submitted their match statistics
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Participants who submitted stats */}
        {participantsWithStats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Submitted ({participantsWithStats.length})
            </h4>
            <div className="space-y-1">
              {participantsWithStats.map((participant) => {
                const stats = statReports.find(r => r.userId === participant.userId);
                return (
                  <div key={participant.playerId} className="flex items-center justify-between p-2 bg-[#2a2a2a] rounded">
                    <span className="text-sm">{participant.username || participant.playerName}</span>
                    <div className="text-xs text-gray-400">
                      {stats?.goals || 0}G • {stats?.assists || 0}A
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Participants who haven't submitted stats */}
        {participantsWithoutStats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-yellow-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending ({participantsWithoutStats.length})
            </h4>
            <div className="space-y-1">
              {participantsWithoutStats.map((participant) => (
                <div key={participant.playerId} className="flex items-center justify-between p-2 bg-[#2a2a2a] rounded">
                  <span className="text-sm">{participant.username || participant.playerName}</span>
                  <Badge variant="outline" className="text-xs">
                    Waiting
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status alerts */}
        {!someStatsSubmitted && (
          <Alert className="border-yellow-600 bg-yellow-900/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No participants have submitted their stats yet. Players can submit once the match is completed.
            </AlertDescription>
          </Alert>
        )}

        {allStatsSubmitted && (
          <Alert className="border-green-600 bg-green-900/20">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All participants have submitted their stats! You can now calculate final scores.
            </AlertDescription>
          </Alert>
        )}

        {/* Calculate scores button */}
        <div className="pt-4 border-t border-gray-700">
          <Button
            onClick={() => calculateScoresMutation.mutate()}
            disabled={calculateScoresMutation.isPending || !someStatsSubmitted}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {calculateScoresMutation.isPending ? "Calculating..." : "Calculate Final Scores"}
          </Button>
          
          {!allStatsSubmitted && someStatsSubmitted && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              You can calculate scores now, or wait for all participants to submit
            </p>
          )}
        </div>

        {/* Score summary if available */}
        {match.finalScore !== null && match.finalScore !== undefined && (
          <div className="bg-[#2a2a2a] p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Final Score:</span>
              <span className="font-medium">{match.finalScore} goals</span>
            </div>
            {statReports.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Reported Total:</span>
                <span className="font-medium">
                  {statReports.reduce((sum, report) => sum + (report.goals || 0), 0)} goals
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}