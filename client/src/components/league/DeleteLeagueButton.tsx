import React from "react";
import { useState } from "react";
import { Button } from '../ui/button';
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
} from '../ui/alert-dialog';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { useLocation } from "wouter";
import { Trash2 } from "lucide-react";
import type { League } from "@shared/schema";

interface DeleteLeagueButtonProps {
  league: League;
  isLeagueCreator: boolean;
}

export default function DeleteLeagueButton({ league, isLeagueCreator }: DeleteLeagueButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const deleteLeagueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/leagues/${league.id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "League deleted",
        description: "The league and all its data have been successfully deleted.",
      });
      // Invalidate queries and redirect to overview
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setLocation("/overview");
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

  if (!isLeagueCreator) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4 mr-1" />
          Delete League
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete League?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this league? This will permanently remove all matches, 
            players, tier lists, lineups, and stats associated with this league. This action 
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteLeagueMutation.mutate()}
            disabled={deleteLeagueMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteLeagueMutation.isPending ? "Deleting..." : "Delete League"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}