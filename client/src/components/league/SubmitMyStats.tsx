import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Target, Users, CheckCircle } from "lucide-react";
import type { Match, StatReport } from "@shared/schema";

interface SubmitMyStatsProps {
  match: Match;
  userId: number;
  isParticipant: boolean;
}

export default function SubmitMyStats({ match, userId, isParticipant }: SubmitMyStatsProps) {
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState<string>("");
  const [assists, setAssists] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user has already submitted stats
  const { data: statReports = [] } = useQuery<StatReport[]>({
    queryKey: ['/api/matches', match.id, 'stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/matches/${match.id}/stats`);
      return response.json();
    },
    enabled: match.status === 'completed',
  });

  const userStats = statReports.find(report => report.userId === userId);
  const hasSubmitted = !!userStats;

  const submitStatsMutation = useMutation({
    mutationFn: async () => {
      const goalsValue = parseInt(goals) || 0;
      const assistsValue = parseInt(assists) || 0;
      
      if (goalsValue < 0 || assistsValue < 0) {
        throw new Error("Goals and assists must be 0 or greater");
      }

      const response = await apiRequest('POST', `/api/matches/${match.id}/stats`, {
        goals: goalsValue,
        assists: assistsValue
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Stats submitted successfully!",
        description: `Goals: ${goals || '0'}, Assists: ${assists || '0'}`,
      });
      // Invalidate stats query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/matches', match.id, 'stats'] });
      setOpen(false);
      setGoals("");
      setAssists("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error submitting stats",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Only show for participants when match is completed
  if (!isParticipant || match.status !== 'completed') {
    return null;
  }

  // Show submitted status if already submitted
  if (hasSubmitted) {
    return (
      <Card className="bg-[#1e1e1e] border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-5 w-5" />
            Stats Submitted
          </CardTitle>
          <CardDescription>
            You have successfully submitted your match statistics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Goals:</span>
            <span className="font-medium">{userStats.goals || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Assists:</span>
            <span className="font-medium">{userStats.assists || 0}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <FileText className="h-4 w-4 mr-2" />
          Submit My Stats
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Submit Your Match Stats
          </DialogTitle>
          <DialogDescription>
            Enter your personal statistics for this match. Be honest - this affects everyone's scores!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="goals" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Goals Scored
            </Label>
            <Input
              id="goals"
              type="number"
              min="0"
              placeholder="0"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="assists" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assists
            </Label>
            <Input
              id="assists"
              type="number"
              min="0"
              placeholder="0"
              value={assists}
              onChange={(e) => setAssists(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="bg-[#2a2a2a] p-3 rounded-lg">
            <p className="text-xs text-gray-400">
              💡 Remember: Goals = 3 points, Assists = 2 points. 
              Captain gets 2x points!
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => submitStatsMutation.mutate()}
            disabled={submitStatsMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitStatsMutation.isPending ? "Submitting..." : "Submit Stats"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}