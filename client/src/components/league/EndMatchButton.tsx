import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CircleStop, Target } from "lucide-react";
import type { Match } from "@shared/schema";

interface EndMatchButtonProps {
  match: Match;
  leagueId: number;
  isLeagueCreator: boolean;
}

export default function EndMatchButton({ match, leagueId, isLeagueCreator }: EndMatchButtonProps) {
  const [open, setOpen] = useState(false);
  const [finalScore, setFinalScore] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const endMatchMutation = useMutation({
    mutationFn: async () => {
      const scoreValue = parseInt(finalScore);
      if (isNaN(scoreValue) || scoreValue < 0) {
        throw new Error("Please enter a valid final score (0 or greater)");
      }
      
      // End match with final score
      const endResponse = await apiRequest('POST', `/api/matches/${match.id}/end`);
      const endData = await endResponse.json();
      
      // Validate goals with final score
      const validateResponse = await apiRequest('POST', `/api/matches/${match.id}/validate-goals`, {
        finalScore: scoreValue
      });
      
      return { endData, validateData: await validateResponse.json() };
    },
    onSuccess: (data) => {
      toast({
        title: "Match ended successfully",
        description: `Final score recorded: ${finalScore} goals. Participants can now submit their stats.`,
      });
      // Invalidate queries to refresh the match data
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches", match.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches", match.id, "stats"] });
      setOpen(false);
      setFinalScore("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Only show for league creators and when match is not already completed
  if (!isLeagueCreator || match.status === 'completed') {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700">
          <CircleStop className="h-4 w-4 mr-1" />
          End Match
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            End Match & Enter Final Score
          </AlertDialogTitle>
          <AlertDialogDescription>
            Enter the total number of goals scored in this match. This will end the match and 
            allow participants to submit their individual stats.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="finalScore">Total Goals Scored</Label>
            <Input
              id="finalScore"
              type="number"
              min="0"
              placeholder="Enter total goals (e.g., 8)"
              value={finalScore}
              onChange={(e) => setFinalScore(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setFinalScore("")}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => endMatchMutation.mutate()}
            disabled={endMatchMutation.isPending || !finalScore.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {endMatchMutation.isPending ? "Ending Match..." : "End Match"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}