import React from "react";
import { Star, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Player, Lineup } from '@shared/schema';

interface FootballFieldLineupProps {
  lineup: Lineup | null;
  players: Player[];
  className?: string;
}

export default function FootballFieldLineup({ lineup, players, className = "" }: FootballFieldLineupProps) {
  if (!lineup || !lineup.playerIds || lineup.playerIds.length === 0) {
    return (
      <Card className={`bg-[#1e1e1e] border-gray-700 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white text-center">Your Lineup</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-gray-400 text-center">
            <div className="text-lg mb-2">No lineup created yet</div>
            <div className="text-sm">Create your lineup to see it here</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get selected players with their data
  const selectedPlayers = lineup.playerIds
    .map(id => players.find(p => p.id === id))
    .filter(Boolean) as Player[];

  const captain = players.find(p => p.id === lineup.captainId);
  const totalCost = lineup.totalCost || 0;

  // Field positions for 5 players (loose formation)
  const fieldPositions = [
    { top: '15%', left: '50%' },  // Forward
    { top: '35%', left: '25%' },  // Left Mid
    { top: '35%', left: '75%' },  // Right Mid
    { top: '60%', left: '35%' },  // Left Back
    { top: '60%', left: '65%' },  // Right Back
  ];

  return (
    <Card className={`bg-[#1e1e1e] border-gray-700 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>Your Lineup</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-yellow-400 border-yellow-400">
              <DollarSign className="h-3 w-3 mr-1" />
              {totalCost}M
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Football Field */}
        <div className="relative w-full h-80 bg-gradient-to-b from-green-600 to-green-700 rounded-lg overflow-hidden">
          {/* Field markings */}
          <div className="absolute inset-0 opacity-30">
            {/* Center circle */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white rounded-full"></div>
            {/* Center line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white"></div>
            {/* Penalty areas */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-16 h-8 border-2 border-white border-b-0"></div>
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-8 border-2 border-white border-t-0"></div>
          </div>

          {/* Players */}
          {selectedPlayers.slice(0, 5).map((player, index) => {
            const isCaptain = captain && player.id === captain.id;
            const position = fieldPositions[index] || { top: '50%', left: '50%' };
            
            return (
              <div
                key={player.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  top: position.top,
                  left: position.left,
                }}
                data-testid={isCaptain ? 'lineup-player-captain' : 'lineup-player'}
              >
                {/* Player circle */}
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                  ${isCaptain 
                    ? 'bg-yellow-400 text-black border-2 border-yellow-300 shadow-lg' 
                    : 'bg-blue-600 text-white border-2 border-blue-400'
                  }
                  transition-all duration-200 hover:scale-110
                `}>
                  {player.emoji || '⚽'}
                  {isCaptain && (
                    <Star className="absolute -top-1 -right-1 h-4 w-4 text-yellow-500 fill-current" />
                  )}
                </div>

                {/* Player name */}
                <div className="mt-1 text-xs text-center text-white font-medium bg-black bg-opacity-60 rounded px-1 py-0.5 min-w-max">
                  {player.name}
                  {isCaptain && (
                    <span className="ml-1 text-yellow-400">(C)</span>
                  )}
                </div>

                {/* Market value */}
                <div className="text-xs text-center text-green-200 font-bold">
                  {player.marketValue || 0}M
                </div>
              </div>
            );
          })}
        </div>

        {/* Lineup Summary */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Players:</span>
              <span className="text-white ml-2">{selectedPlayers.length}/5</span>
            </div>
            <div>
              <span className="text-gray-400">Budget:</span>
              <span className="text-white ml-2">{totalCost}/100M</span>
            </div>
          </div>
          
          {captain && (
            <div className="mt-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-400 fill-current" />
              <span className="text-yellow-400 text-sm font-medium">
                Captain: {captain.name} (2x points)
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}