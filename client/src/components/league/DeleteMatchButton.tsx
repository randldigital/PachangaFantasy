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
import { Trash2 } from "lucide-react";
import type { Match } from "@shared/schema";

interface DeleteMatchButtonProps {
  match: Match;
  leagueId: number;
  isLeagueCreator: boolean;
}

export default function DeleteMatchButton({ match, leagueId, isLeagueCreator }: DeleteMatchButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMatchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/matches/${match.id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Match deleted",
        description: "The match has been successfully deleted.",
      });
      
      // Manually remove the match from the cache immediately
      queryClient.setQueryData(["/api/leagues", leagueId, "matches"], (oldData: any) => {
        if (!oldData) return [];
        return oldData.filter((m: any) => m.id !== match.id);
      });
      
      // Invalidate and refetch queries to refresh the match list immediately
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches", match.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      
      // Force immediate refetch with stale time reset
      queryClient.refetchQueries({ queryKey: ["/api/leagues", leagueId, "matches"] });
      queryClient.refetchQueries({ queryKey: ["/api/leagues", leagueId] });
      
      setOpen(false);
      
      // If we're currently viewing the match that was deleted, redirect to league dashboard
      if (window.location.pathname.includes(`/matches/${match.id}`)) {
        setTimeout(() => {
          window.location.href = `/leagues/${leagueId}`;
        }, 100);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!isLeagueCreator) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4 mr-1" />
          Delete Match
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Match?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this match? This will permanently remove all lineups, 
            stats, and scores associated with this match. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMatchMutation.mutate()}
            disabled={deleteMatchMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteMatchMutation.isPending ? "Deleting..." : "Delete Match"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}