import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { CircleStop } from "lucide-react";
import type { Match } from "@shared/schema";

interface EndMatchButtonProps {
  match: Match;
  leagueId: number;
  isLeagueCreator: boolean;
}

export default function EndMatchButton({ match, leagueId, isLeagueCreator }: EndMatchButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const endMatchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/matches/${match.id}/end`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to end match");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Match ended",
        description: data.message || "Match ended successfully. Participants can now submit stats.",
      });
      // Invalidate queries to refresh the match data
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches", match.id] });
      setOpen(false);
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End Match?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to end this match? This will change the match status to "completed" 
            and allow participants to submit their stats. You can still validate goals later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => endMatchMutation.mutate()}
            disabled={endMatchMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {endMatchMutation.isPending ? "Ending..." : "End Match"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}