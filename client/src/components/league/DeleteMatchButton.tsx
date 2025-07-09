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
  onMatchDeleted?: () => void;
}

export default function DeleteMatchButton({ match, leagueId, isLeagueCreator, onMatchDeleted }: DeleteMatchButtonProps) {
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
      
      setOpen(false);
      
      // Force immediate page refresh to ensure UI updates
      window.location.reload();
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