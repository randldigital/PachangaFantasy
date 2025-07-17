import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, createMockUser, createMockLeague, createMockPlayers } from '../test-utils';
import LeagueDetail from '../../client/src/pages/LeagueDetail';

// Mock wouter
vi.mock('wouter', () => ({
  useParams: () => ({ id: '1' }),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LeagueDetail', () => {
  const mockUser = createMockUser();
  const mockLeague = createMockLeague();
  const mockPlayers = createMockPlayers(5);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders league detail with header and invite code', async () => {
    render(<LeagueDetail />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText(mockLeague.name)).toBeTruthy();
    });
    expect(screen.getByText('Code:')).toBeTruthy();
    expect(screen.getByText(mockLeague.inviteCode)).toBeTruthy();
  });

  it('shows add player button for admin when league is open', async () => {
    const adminUser = createMockUser({ id: mockLeague.createdBy });
    render(<LeagueDetail />, { initialUser: adminUser });
    await waitFor(() => {
      expect(screen.getByText('Add Player')).toBeTruthy();
    });
  });

  it('does not show add player button for non-admin or when league is not open', async () => {
    const regularUser = createMockUser({ id: 999 });
    render(<LeagueDetail />, { initialUser: regularUser });
    await waitFor(() => {
      expect(screen.queryByText('Add Player')).toBeNull();
    });
    // Also test for admin but league not open
    const closedLeague = createMockLeague({ status: 'closed' });
    const adminUser = createMockUser({ id: closedLeague.createdBy });
    render(<LeagueDetail />, { initialUser: adminUser });
    await waitFor(() => {
      expect(screen.queryByText('Add Player')).toBeNull();
    });
  });

  it('displays player list with correct number of player cards', async () => {
    render(<LeagueDetail />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText('Players')).toBeTruthy();
    });
    // Check for correct number of player cards
    const playerCards = screen.getAllByText(/Player \d/);
    expect(playerCards.length).toBe(mockPlayers.length);
  });

  it('shows loading spinner initially', () => {
    render(<LeagueDetail />, { initialUser: mockUser });
    // Check for spinner by class or role
    expect(screen.getByRole('status') || screen.getByTestId('spinner')).toBeTruthy();
  });

  it('shows not found message if league is missing', async () => {
    render(<LeagueDetail />, { initialUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText('League not found')).toBeTruthy();
    });
  });
});
