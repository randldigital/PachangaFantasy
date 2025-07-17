import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '../test-utils';
import userEvent from '@testing-library/user-event';
import LeagueHub from '../../client/src/pages/LeagueHub';
import { createMockUser, createMockLeague, createMockPlayers, createMockMatch } from '../test-utils';

// Mock wouter
vi.mock('wouter', () => ({
  useParams: () => ({ id: '1' }),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LeagueHub (Tabbed League Dashboard)', () => {
  const mockUser = createMockUser();
  const mockLeague = createMockLeague();
  const mockPlayers = createMockPlayers(10);
  const mockMatches = [
    createMockMatch({ id: 1, status: 'open' }),
    createMockMatch({ id: 2, status: 'completed', date: new Date('2025-01-10T10:00:00Z') })
  ];
  const mockRankings = [
    { userId: 1, username: 'testuser', totalPoints: 25 },
    { userId: 2, username: 'player2', totalPoints: 18 },
    { userId: 3, username: 'player3', totalPoints: 12 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner and text initially', () => {
    render(<LeagueHub />, { initialUser: mockUser });
    expect(screen.getByText(/loading/i)).toBeTruthy();
    expect(screen.getByRole('status') || screen.getByTestId('spinner')).toBeTruthy();
  });

  it('renders header with league name, invite code, and participant count', async () => {
    render(<LeagueHub />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText(mockLeague.name)).toBeTruthy();
    });
    expect(screen.getByText(mockLeague.inviteCode)).toBeTruthy();
    expect(screen.getByText(String(mockLeague.participants.length))).toBeTruthy();
  });

  it('renders all main tabs and bottom navigation', async () => {
    render(<LeagueHub />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText(/lineup/i)).toBeTruthy();
      expect(screen.getByText(/clasificacion/i)).toBeTruthy();
      expect(screen.getByText(/historial/i)).toBeTruthy();
      expect(screen.getByText(/tierlist/i)).toBeTruthy();
    });
    // Bottom nav (mobile)
    expect(screen.getByRole('navigation') || screen.getByTestId('mobile-bottom-nav')).toBeTruthy();
  });

  it('renders match context header with date, time, and status', async () => {
    render(<LeagueHub />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText(/open|ready|completed/i)).toBeTruthy();
    });
    expect(screen.getByText(/calendar/i)).toBeTruthy();
    expect(screen.getByText(/clock/i)).toBeTruthy();
  });

  it('renders team assignment preview if active match exists', async () => {
    render(<LeagueHub />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText(/team assignment|preview/i)).toBeTruthy();
    });
  });

  it('renders lineup tab with player list and budget', async () => {
    render(<LeagueHub />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText(/lineup/i)).toBeTruthy();
    });
    // Should show 5 player slots (or whatever the lineup size is)
    expect(screen.getAllByTestId('lineup-player').length + screen.getAllByTestId('lineup-player-captain').length).toBeGreaterThan(0);
    expect(screen.getByText(/budget/i)).toBeTruthy();
  });

  it('renders clasificacion tab with leaderboard and user highlight', async () => {
    render(<LeagueHub />, { initialUser: mockUser });
    // Switch to clasificacion tab
    const clasificacionTab = screen.getByText(/clasificacion/i);
    fireEvent.click(clasificacionTab);
    await waitFor(() => {
      expect(screen.getByText(/leaderboard|clasificacion/i)).toBeTruthy();
    });
    // User highlight (ring or badge)
    expect(screen.getByText(mockUser.username)).toBeTruthy();
  });

  it('renders historial tab with match history', async () => {
    render(<LeagueHub />, { initialUser: mockUser });
    // Switch to historial tab
    const historialTab = screen.getByText(/historial/i);
    fireEvent.click(historialTab);
    await waitFor(() => {
      expect(screen.getByText(/calendar/i)).toBeTruthy();
    });
    expect(screen.getByText(/status|completed|open|ready/i)).toBeTruthy();
  });

  it('renders tierlist tab', async () => {
    render(<LeagueHub />, { initialUser: mockUser });
    // Switch to tierlist tab
    const tierlistTab = screen.getByText(/tierlist/i);
    fireEvent.click(tierlistTab);
    await waitFor(() => {
      expect(screen.getByText(/tierlist/i)).toBeTruthy();
    });
  });

  it('shows not found message if league does not exist', async () => {
    // Simulate not found by mocking useQuery to return no league
    vi.mocked(require('@tanstack/react-query').useQuery).mockReturnValue({ data: null, isLoading: false });
    render(<LeagueHub />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeTruthy();
    });
  });
});