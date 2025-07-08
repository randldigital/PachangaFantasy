import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Users, Trophy, DollarSign } from "lucide-react";
import type { Match, Player, Lineup } from "@shared/schema";

interface LineupFormData {
  playerIds: number[];
  formation: string;
  strategy: string;
  budget: number;
}

export default function LineupPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [formation, setFormation] = useState("4-4-2");
  const [strategy, setStrategy] = useState("");
  const [budget, setBudget] = useState(100);

  // Fetch match details
  const { data: match, isLoading: matchLoading, error: matchError } = useQuery<Match>({
    queryKey: [`/api/matches/${matchId}`],
    enabled: !!matchId
  });

  // Debug logging
  console.log('LineupPage - matchId:', matchId);
  console.log('LineupPage - match:', match);
  console.log('LineupPage - matchLoading:', matchLoading);
  console.log('LineupPage - matchError:', matchError);

  // Fetch available players for the league
  const { data: players, isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: [`/api/players/${match?.leagueId}`],
    enabled: !!match?.leagueId
  });

  // Fetch existing lineup
  const { data: existingLineup, isLoading: lineupLoading } = useQuery<Lineup>({
    queryKey: [`/api/matches/${matchId}/lineup`],
    enabled: !!matchId
  });

  // Create/update lineup mutation
  const lineupMutation = useMutation({
    mutationFn: async (data: LineupFormData) => {
      return apiRequest(`/api/matches/${matchId}/lineup`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lineup saved successfully!"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/matches/${matchId}/lineup`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save lineup",
        variant: "destructive"
      });
    }
  });

  // Load existing lineup data
  if (existingLineup && selectedPlayers.length === 0) {
    const playerIds = Array.isArray(existingLineup.playerIds) ? existingLineup.playerIds : [];
    setSelectedPlayers(playerIds);
    setFormation(existingLineup.formation || "4-4-2");
    setStrategy(existingLineup.strategy || "");
    setBudget(existingLineup.budget || 100);
  }

  const handlePlayerToggle = (playerId: number) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else if (prev.length < 11) {
        return [...prev, playerId];
      } else {
        toast({
          title: "Maximum players reached",
          description: "You can only select up to 11 players",
          variant: "destructive"
        });
        return prev;
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedPlayers.length !== 11) {
      toast({
        title: "Invalid lineup",
        description: "Please select exactly 11 players",
        variant: "destructive"
      });
      return;
    }

    lineupMutation.mutate({
      playerIds: selectedPlayers,
      formation,
      strategy,
      budget
    });
  };

  const calculateTotalCost = () => {
    if (!players) return 0;
    return selectedPlayers.reduce((total, playerId) => {
      const player = players.find(p => p.id === playerId);
      return total + (player?.marketValue || 0);
    }, 0);
  };

  const totalCost = calculateTotalCost();
  const isOverBudget = totalCost > budget;

  if (matchLoading || playersLoading || lineupLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Match not found</CardTitle>
            <CardDescription>The requested match could not be found.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Match Lineup</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{match.title}</CardTitle>
          <CardDescription>
            {new Date(match.date).toLocaleDateString()} at {new Date(match.date).toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Player Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Available Players
            </CardTitle>
            <CardDescription>
              Select 11 players for your lineup ({selectedPlayers.length}/11 selected)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {players?.map(player => (
              <div
                key={player.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedPlayers.includes(player.id)
                    ? 'bg-accent border-accent-light'
                    : 'hover:bg-card-secondary'
                }`}
                onClick={() => handlePlayerToggle(player.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-sm text-text-secondary">
                      Position: {player.position || 'Not specified'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-mono">{player.marketValue || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Lineup Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Lineup Configuration
            </CardTitle>
            <CardDescription>
              Configure your team formation and strategy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="formation">Formation</Label>
                <select
                  id="formation"
                  value={formation}
                  onChange={(e) => setFormation(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="4-4-2">4-4-2</option>
                  <option value="4-3-3">4-3-3</option>
                  <option value="3-5-2">3-5-2</option>
                  <option value="4-5-1">4-5-1</option>
                  <option value="3-4-3">3-4-3</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget</Label>
                <Input
                  id="budget"
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategy">Strategy (Optional)</Label>
                <Textarea
                  id="strategy"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  placeholder="Describe your team strategy..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Total Cost:</span>
                  <span className={`font-mono ${isOverBudget ? 'text-red-500' : 'text-green-500'}`}>
                    {totalCost} / {budget}
                  </span>
                </div>
                {isOverBudget && (
                  <p className="text-sm text-red-500">
                    Your lineup exceeds the budget. Please adjust your selection.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={lineupMutation.isPending || selectedPlayers.length !== 11 || isOverBudget}
                className="w-full"
              >
                {lineupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Lineup
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Selected Players Preview */}
      {selectedPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Players ({selectedPlayers.length}/11)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {selectedPlayers.map(playerId => {
                const player = players?.find(p => p.id === playerId);
                return player ? (
                  <div
                    key={player.id}
                    className="p-2 rounded bg-accent text-sm flex justify-between items-center"
                  >
                    <span>{player.name}</span>
                    <span className="font-mono">{player.marketValue || 0}</span>
                  </div>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}