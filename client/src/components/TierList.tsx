import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Player } from '@shared/schema';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface PlayerCardProps {
  player: Player;
  isDragging?: boolean;
}

function PlayerCard({ player, isDragging }: PlayerCardProps) {
  return (
    <div className={`bg-secondary border border-gray-600 rounded-xl p-3 cursor-move hover:border-accent-blue transition-all duration-300 hover:shadow-lg hover:shadow-accent-blue/20 group ${isDragging ? 'opacity-50' : ''}`}>
      <div className="text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-accent-blue to-accent-purple rounded-full mx-auto mb-2 flex items-center justify-center text-white font-semibold text-xl">
          {player.emoji}
        </div>
        <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">{player.name}</p>
      </div>
    </div>
  );
}

function SortablePlayerCard({ player }: { player: Player }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PlayerCard player={player} isDragging={isDragging} />
    </div>
  );
}

function AvailablePlayersPool({ players }: { players: Player[] }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'available',
  });
  const { t } = useTranslation();

  return (
    <div 
      ref={setNodeRef}
      className={`bg-secondary/30 border border-gray-600/50 rounded-2xl p-6 ${isOver ? 'border-accent-blue bg-accent-blue/10' : ''}`}
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
        {t('tierlist.availablePlayers')}
      </h3>
      {players.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {players.map(player => (
            <SortablePlayerCard key={player.id} player={player} />
          ))}
        </div>
      ) : (
        <div className="text-center text-text-secondary py-8">
          {t('tierlist.allPlayersRanked')}
        </div>
      )}
    </div>
  );
}

interface DropZoneProps {
  title: string;
  description: string;
  position: number;
  players: Player[];
  bgClass: string;
  borderClass: string;
  numberBg: string;
}

function DropZone({ title, description, position, players, bgClass, borderClass, numberBg }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `tier${position === 4 ? 'Rest' : position}`,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex items-center space-x-4 ${bgClass} ${borderClass} rounded-xl p-4 min-h-[80px] transition-all duration-200 hover:border-opacity-50 ${isOver ? 'border-accent-blue bg-accent-blue/10' : ''}`}
    >
      <div className={`w-12 h-12 ${numberBg} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
        {position}
      </div>
      <div className="flex-1">
        {players.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {players.map(player => (
              <SortablePlayerCard key={player.id} player={player} />
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center text-text-secondary hover:border-accent-blue/50 transition-colors">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

interface TierListProps {
  players: Player[];
  onSubmit: (ranking: number[]) => void;
}

export default function TierList({ players, onSubmit }: TierListProps) {
  const { t } = useTranslation();
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>(players);
  const [tier1, setTier1] = useState<Player[]>([]);
  const [tier2, setTier2] = useState<Player[]>([]);
  const [tier3, setTier3] = useState<Player[]>([]);
  const [tierRest, setTierRest] = useState<Player[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const allTierPlayers = [...tier1, ...tier2, ...tier3, ...tierRest];
  const activePlayer = activeId ? allTierPlayers.find(p => p.id === activeId) || availablePlayers.find(p => p.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id as string;

    // Find which tier the dragged item is coming from
    const fromAvailable = availablePlayers.find(p => p.id === activeId);
    const fromTier1 = tier1.find(p => p.id === activeId);
    const fromTier2 = tier2.find(p => p.id === activeId);
    const fromTier3 = tier3.find(p => p.id === activeId);
    const fromTierRest = tierRest.find(p => p.id === activeId);

    const draggedPlayer = fromAvailable || fromTier1 || fromTier2 || fromTier3 || fromTierRest;
    if (!draggedPlayer) return;

    // Remove from current location
    if (fromAvailable) {
      setAvailablePlayers(prev => prev.filter(p => p.id !== activeId));
    } else if (fromTier1) {
      setTier1(prev => prev.filter(p => p.id !== activeId));
    } else if (fromTier2) {
      setTier2(prev => prev.filter(p => p.id !== activeId));
    } else if (fromTier3) {
      setTier3(prev => prev.filter(p => p.id !== activeId));
    } else if (fromTierRest) {
      setTierRest(prev => prev.filter(p => p.id !== activeId));
    }

    // Add to new location
    switch (overId) {
      case 'tier1':
        setTier1(prev => [...prev, draggedPlayer]);
        break;
      case 'tier2':
        setTier2(prev => [...prev, draggedPlayer]);
        break;
      case 'tier3':
        setTier3(prev => [...prev, draggedPlayer]);
        break;
      case 'tierRest':
        setTierRest(prev => [...prev, draggedPlayer]);
        break;
      case 'available':
        setAvailablePlayers(prev => [...prev, draggedPlayer]);
        break;
    }
  }

  function handleSubmit() {
    const ranking = [...tier1, ...tier2, ...tier3, ...tierRest].map(p => p.id);
    onSubmit(ranking);
  }

  const canSubmit = allTierPlayers.length === players.length;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* Available Players Pool */}
        <AvailablePlayersPool players={availablePlayers} />

        {/* Ranking Positions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-text-primary flex items-center">
            <svg className="w-5 h-5 mr-2 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            {t('tierlist.myRanking')}
          </h3>

          <div className="space-y-3">
            <div id="tier1">
              <DropZone
                title="1"
                description={t('tierlist.dragHere')}
                position={1}
                players={tier1}
                bgClass="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10"
                borderClass="border border-yellow-500/30"
                numberBg="bg-gradient-to-br from-yellow-400 to-yellow-600"
              />
            </div>

            <div id="tier2">
              <DropZone
                title="2"
                description={t('tierlist.secondBest')}
                position={2}
                players={tier2}
                bgClass="bg-gradient-to-r from-gray-400/10 to-gray-500/10"
                borderClass="border border-gray-400/30"
                numberBg="bg-gradient-to-br from-gray-400 to-gray-600"
              />
            </div>

            <div id="tier3">
              <DropZone
                title="3"
                description={t('tierlist.thirdBest')}
                position={3}
                players={tier3}
                bgClass="bg-gradient-to-r from-amber-600/10 to-amber-700/10"
                borderClass="border border-amber-600/30"
                numberBg="bg-gradient-to-br from-amber-600 to-amber-800"
              />
            </div>

            <div id="tierRest">
              <DropZone
                title="4+"
                description={t('tierlist.restPlayers')}
                position={4}
                players={tierRest}
                bgClass="bg-secondary/30"
                borderClass="border border-gray-600/50"
                numberBg="bg-gradient-to-br from-accent-blue to-accent-purple"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center pt-6">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-gradient-to-r from-accent-green to-accent-blue text-white font-semibold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-accent-green/25 transform hover:scale-105 transition-all duration-300 focus:ring-2 focus:ring-accent-green focus:ring-offset-2 focus:ring-offset-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {t('tierlist.submit')}
          </Button>
        </div>
      </div>

      <DragOverlay>
        {activePlayer ? <PlayerCard player={activePlayer} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
