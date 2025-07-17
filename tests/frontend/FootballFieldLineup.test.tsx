import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FootballFieldLineup from '../../client/src/components/league/FootballFieldLineup';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('FootballFieldLineup', () => {
  it('renders 5 player nodes and highlights the captain', () => {
    const players = [
      { id: 1, name: 'A', emoji: '🧤' },
      { id: 2, name: 'B', emoji: '🛡️' },
      { id: 3, name: 'C', emoji: '⚡' },
      { id: 4, name: 'D', emoji: '🔥' },
      { id: 5, name: 'E', emoji: '🎯' },
    ];
    const lineup = {
      id: 1,
      matchId: 1,
      userId: 1,
      playerIds: [1, 2, 3, 4, 5],
      captainId: 3,
      totalCost: 0,
      createdAt: new Date(),
    };
    render(<FootballFieldLineup lineup={lineup} players={players} />);
    // Assert 5 player nodes (including captain)
    expect(screen.getAllByTestId('lineup-player').length + screen.getAllByTestId('lineup-player-captain').length).toBe(5);
    // Assert captain is highlighted and correct
    const captainNode = screen.getByTestId('lineup-player-captain');
    expect(captainNode).toBeTruthy();
    expect(captainNode.innerHTML).toMatch(/C\)/); // Captain badge
    // Assert captain's name is correct
    expect(captainNode.textContent).toMatch(/C/);
    expect(captainNode.textContent).toMatch(players[2].name);
    // Assert captain node has highlight class
    if (captainNode) {
      const highlightDiv = captainNode.querySelector('div');
      expect(highlightDiv && highlightDiv.className).toMatch(/bg-yellow-400/);
    }
  });
}); 