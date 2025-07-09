import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { UserPlus, Users } from 'lucide-react';

const playerEmojis = ['⚽', '🏃', '🛡️', '🎯', '🥅', '⚡', '🔥', '💎', '👑', '🌟'];

const addPlayerSchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Name must be 30 characters or less"),
  emoji: z.string().default('⚽'),
  isExternal: z.boolean().default(true),
});

type AddPlayerFormData = z.infer<typeof addPlayerSchema>;

interface AddPlayerFormProps {
  leagueId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddPlayerForm({ leagueId, isOpen, onClose }: AddPlayerFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddPlayerFormData>({
    resolver: zodResolver(addPlayerSchema),
    defaultValues: {
      name: '',
      emoji: '⚽',
      isExternal: true,
    },
  });

  const addPlayerMutation = useMutation({
    mutationFn: async (data: AddPlayerFormData) => {
      const response = await apiRequest('POST', `/api/players/${leagueId}`, {
        name: data.name,
        emoji: data.emoji,
        position: 'forward', // Default position for external players
        isExternal: data.isExternal,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players', leagueId] });
      queryClient.refetchQueries({ queryKey: ['/api/players', leagueId] });
      toast({
        title: "Player added successfully!",
        description: "The new player has been added to your league roster.",
      });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error adding player",
        description: error.message || "Failed to add player. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddPlayerFormData) => {
    addPlayerMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <UserPlus className="h-5 w-5 text-blue-400" />
            Add External Player
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Player Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter player name"
                      {...field}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Avatar Emoji</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Choose an emoji" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {playerEmojis.map((emoji) => (
                        <SelectItem key={emoji} value={emoji} className="text-white hover:bg-slate-600">
                          <span className="text-xl mr-2">{emoji}</span>
                          {emoji}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2 text-slate-300">
                <Users className="h-4 w-4" />
                <span className="text-sm">
                  This player will be added to your league roster and can be selected in match lineups.
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addPlayerMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addPlayerMutation.isPending ? "Adding..." : "Add Player"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}