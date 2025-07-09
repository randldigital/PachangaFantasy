import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AddPlayerFormProps {
  leagueId: number;
  isLeagueCreator: boolean;
}

export default function AddPlayerForm({ leagueId, isLeagueCreator }: AddPlayerFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [playerEmoji, setPlayerEmoji] = useState('⚽');
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const addPlayerMutation = useMutation({
    mutationFn: async (data: { name: string; emoji: string }) => {
      const response = await apiRequest('POST', `/api/players/${leagueId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('common.success'),
        description: 'Player added successfully',
      });
      setPlayerName('');
      setPlayerEmoji('⚽');
      queryClient.invalidateQueries({ queryKey: ['/api/players', leagueId] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to add player',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    addPlayerMutation.mutate({
      name: playerName.trim(),
      emoji: playerEmoji,
    });
  };

  if (!isLeagueCreator) {
    return null;
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Add Player to League
        </CardTitle>
        <CardDescription className="text-gray-400">
          Add a new player to participate in tier lists and matches
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <Label htmlFor="playerName" className="text-white">
                Player Name
              </Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter player name"
                className="bg-gray-700 border-gray-600 text-white"
                maxLength={25}
                required
              />
            </div>
            <div>
              <Label htmlFor="playerEmoji" className="text-white">
                Emoji
              </Label>
              <Input
                id="playerEmoji"
                value={playerEmoji}
                onChange={(e) => setPlayerEmoji(e.target.value)}
                placeholder="⚽"
                className="bg-gray-700 border-gray-600 text-white text-center"
                maxLength={2}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={addPlayerMutation.isPending || !playerName.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {addPlayerMutation.isPending ? 'Adding...' : 'Add Player'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}