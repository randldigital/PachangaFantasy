import { useParams, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar, ArrowLeft, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { insertMatchSchema, type InsertMatch } from '@shared/schema';

export default function CreateMatch() {
  const { id: leagueId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertMatch>({
    resolver: zodResolver(insertMatchSchema),
    defaultValues: {
      leagueId: parseInt(leagueId!),
      date: new Date(),
      lineupBudget: 100,
    },
  });

  const createMatchMutation = useMutation({
    mutationFn: async (data: InsertMatch) => {
      const response = await apiRequest('POST', '/api/matches', data);
      return response.json();
    },
    onSuccess: (match) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues', leagueId, 'matches'] });
      toast({
        title: 'Success!',
        description: 'Match created successfully',
      });
      setLocation(`/matches/${match.id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create match',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: InsertMatch) => {
    createMatchMutation.mutate({
      ...data,
      leagueId: parseInt(leagueId!),
    });
  };

  return (
    <div className="min-h-screen bg-[#121212] text-[#e0e0e0] p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation(`/leagues/${leagueId}/dashboard`)}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to League
          </Button>
          <h1 className="text-3xl font-bold mb-2">Create New Match</h1>
          <p className="text-gray-400">Set up a new match for your league</p>
        </div>

        {/* Create Match Form */}
        <Card className="bg-[#1e1e1e] border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Match Details
            </CardTitle>
            <CardDescription>
              Configure the match settings and budget for player lineups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Match Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : field.value}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                          className="bg-[#2a2a2a] border-gray-600 text-white"
                        />
                      </FormControl>
                      <FormDescription>
                        Select when the match will take place
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lineupBudget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Lineup Budget (Millions)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          className="bg-[#2a2a2a] border-gray-600 text-white"
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum total value for each player's 5-player lineup
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation(`/leagues/${leagueId}/dashboard`)}
                    className="flex-1 border-gray-600 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMatchMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  >
                    {createMatchMutation.isPending ? 'Creating...' : 'Create Match'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#1e1e1e] border-gray-700">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">How it works</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Players join the match</li>
                <li>• Teams auto-balance at 10 players</li>
                <li>• Set lineups within budget</li>
                <li>• Submit stats after match</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-[#1e1e1e] border-gray-700">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">Scoring System</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Goals: +3 points</li>
                <li>• Assists: +2 points</li>
                <li>• Team Win: +1 point</li>
                <li>• Stats require verification</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}