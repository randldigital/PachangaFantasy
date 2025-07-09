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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Target, CheckCircle } from "lucide-react";
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
        title: "✅ Stats submitted successfully!",
        description: `Goals: ${goals || '0'}, Assists: ${assists || '0'}`,
        duration: 5000,
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
      <div className="flex items-center gap-3 px-4 py-3 bg-green-600/20 border border-green-500/50 rounded-lg">
        <CheckCircle className="h-5 w-5 text-green-400" />
        <div>
          <p className="text-green-400 font-medium">Stats Submitted ✅</p>
          <p className="text-sm text-green-300">
            Goals: {userStats.goals || 0} | Assists: {userStats.assists || 0}
          </p>
        </div>
      </div>
    );
  }

  // Show submit stats button with enhanced visibility
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-3 shadow-lg"
        >
          <Target className="h-5 w-5 mr-2" />
          Submit My Stats
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Target className="h-5 w-5 text-blue-400" />
            Submit Your Match Statistics
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Enter your goals and assists from this match. These will be used for scoring calculations.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="goals" className="text-slate-200">Goals Scored</Label>
            <Input
              id="goals"
              type="number"
              min="0"
              placeholder="0"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="assists" className="text-slate-200">Assists Made</Label>
            <Input
              id="assists"
              type="number"
              min="0"
              placeholder="0"
              value={assists}
              onChange={(e) => setAssists(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={() => submitStatsMutation.mutate()}
            disabled={submitStatsMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitStatsMutation.isPending ? "Submitting..." : "Submit Stats"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}