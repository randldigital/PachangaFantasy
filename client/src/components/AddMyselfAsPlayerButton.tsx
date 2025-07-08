import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { UserPlus, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AddMyselfAsPlayerButtonProps {
  leagueId: number;
}

export default function AddMyselfAsPlayerButton({ leagueId }: AddMyselfAsPlayerButtonProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check if user is already a player
  const { data: userPlayerStatus, isLoading } = useQuery({
    queryKey: ['userPlayerStatus', leagueId],
    queryFn: async () => {
      const response = await fetch(`/api/leagues/${leagueId}/check-user-player`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to check user player status');
      return response.json();
    }
  });

  // Add user as player mutation
  const addMyselfMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/leagues/${leagueId}/add-me-as-player`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['userPlayerStatus', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['/api/players', leagueId] });
      toast({
        title: '¡Éxito!',
        description: `Te has agregado como jugador: ${data.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo agregar como jugador',
        variant: 'destructive',
      });
    }
  });

  const handleAddMyself = () => {
    addMyselfMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
      </div>
    );
  }

  // Don't show if user is already a player
  if (userPlayerStatus?.isPlayer) {
    return (
      <div className="bg-gradient-to-r from-accent-green/10 to-accent-green/5 border border-accent-green/20 rounded-xl p-4 text-center">
        <div className="inline-flex items-center text-accent-green font-medium">
          <Check className="w-5 h-5 mr-2" />
          Ya eres jugador en esta liga
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-accent-purple/10 to-accent-blue/10 border border-accent-purple/20 rounded-xl p-4 text-center">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-text-primary mb-1">¿Quieres participar?</h3>
        <p className="text-sm text-text-secondary">Agrégarte como jugador para ser incluido en las clasificaciones</p>
      </div>
      <Button
        onClick={handleAddMyself}
        disabled={addMyselfMutation.isPending}
        className="bg-gradient-to-r from-accent-purple to-accent-blue hover:from-accent-purple/90 hover:to-accent-blue/90 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:transform-none disabled:hover:shadow-lg"
      >
        {addMyselfMutation.isPending ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Agregando...
          </>
        ) : (
          <>
            <UserPlus className="w-5 h-5 mr-2" />
            Agregarme como jugador
          </>
        )}
      </Button>
    </div>
  );
}