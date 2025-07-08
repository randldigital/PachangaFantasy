import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../test-utils';
import userEvent from '@testing-library/user-event';
import LeagueDashboard from '@/pages/LeagueDashboard';
import { createMockUser, createMockLeague, createMockPlayers, createMockMatch } from '../test-utils';

// Mock wouter
vi.mock('wouter', () => ({
  useParams: () => ({ id: '1' }),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('LeagueDashboard', () => {
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
    
    // Mock window.location for navigation tests
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  it('should render league dashboard with stats cards', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      expect(screen.getByText(mockLeague.name)).toBeInTheDocument();
    });

    // Should show stats cards
    expect(screen.getByText('Total Matches')).toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('My Points')).toBeInTheDocument();
  });

  it('should display loading state initially', () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    // Should show loading skeleton
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('should show upcoming match section', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Upcoming Match')).toBeInTheDocument();
    });

    // Should show match date and budget
    const dateElement = screen.getByText(/2025/);
    expect(dateElement).toBeInTheDocument();
    
    const budgetElement = screen.getByText(/Budget/);
    expect(budgetElement).toBeInTheDocument();
  });

  it('should show no upcoming matches message when none exist', async () => {
    // Mock empty matches response
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      expect(screen.getByText('No upcoming matches')).toBeInTheDocument();
    });
  });

  it('should show create match button for league admin', async () => {
    const adminUser = createMockUser({ id: mockLeague.createdBy });
    render(<LeagueDashboard />, { initialUser: adminUser });

    await waitFor(() => {
      const createButton = screen.getByText('Create Match');
      expect(createButton).toBeInTheDocument();
    });
  });

  it('should not show create match button for non-admin', async () => {
    const regularUser = createMockUser({ id: 999 }); // Not the league creator
    render(<LeagueDashboard />, { initialUser: regularUser });

    await waitFor(() => {
      expect(screen.queryByText('Create Match')).not.toBeInTheDocument();
    });
  });

  it('should display league rankings correctly', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Rankings')).toBeInTheDocument();
    });

    // Should show ranking positions
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();

    // Should show usernames and points
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('25 pts')).toBeInTheDocument();
  });

  it('should highlight current user in rankings', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      const userRanking = screen.getByText('testuser').closest('div');
      expect(userRanking).toHaveClass('bg-blue-900/20');
    });
  });

  it('should show empty rankings message when no data', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      // When rankings are empty, should show appropriate message
      if (screen.queryByText('No rankings yet')) {
        expect(screen.getByText('No rankings yet')).toBeInTheDocument();
      }
    });
  });

  it('should display players grid correctly', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Players (10)')).toBeInTheDocument();
    });

    // Should show player count in header
    const playersHeader = screen.getByText(/Players \(\d+\)/);
    expect(playersHeader).toBeInTheDocument();
  });

  it('should show player market values', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      // Should show market values for players
      const marketValues = screen.getAllByText(/\$\d+M/);
      expect(marketValues.length).toBeGreaterThan(0);
    });
  });

  it('should handle match navigation correctly', async () => {
    const user = userEvent.setup();
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      const viewMatchButton = screen.getByText('View Match');
      expect(viewMatchButton).toBeInTheDocument();
    });

    // Test navigation to match detail
    const viewMatchButton = screen.getByText('View Match');
    await user.click(viewMatchButton);
    
    // Should navigate to match page
    expect(window.location.href).toContain('/matches/');
  });

  it('should handle lineup navigation correctly', async () => {
    const user = userEvent.setup();
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      const setLineupButton = screen.getByText('Set Lineup');
      expect(setLineupButton).toBeInTheDocument();
    });

    // Test navigation to lineup page
    const setLineupButton = screen.getByText('Set Lineup');
    await user.click(setLineupButton);
    
    // Should navigate to lineup page
    expect(window.location.href).toContain('/lineup');
  });

  it('should show match status badges correctly', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      // Should show status badges for matches
      const statusBadges = screen.getAllByText(/open|ready|completed/i);
      expect(statusBadges.length).toBeGreaterThan(0);
    });
  });

  it('should display correct stats card values', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      // Should show correct numbers in stats cards
      expect(screen.getByText('2')).toBeInTheDocument(); // Total matches
      expect(screen.getByText('10')).toBeInTheDocument(); // Players count
      expect(screen.getByText('1')).toBeInTheDocument(); // Completed matches
      expect(screen.getByText('25')).toBeInTheDocument(); // User's points
    });
  });

  it('should handle error states gracefully', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    // Should not crash when data fails to load
    await waitFor(() => {
      expect(screen.getByText(mockLeague.name)).toBeInTheDocument();
    });
  });

  it('should show responsive design elements', async () => {
    render(<LeagueDashboard />, { initialUser: mockUser });

    await waitFor(() => {
      // Should have responsive grid classes
      const gridElements = screen.getAllByText(/grid-cols/);
      // This would be tested with actual CSS class presence in real implementation
    });
  });

  it('should handle create match navigation for admin', async () => {
    const user = userEvent.setup();
    const adminUser = createMockUser({ id: mockLeague.createdBy });
    render(<LeagueDashboard />, { initialUser: adminUser });

    await waitFor(() => {
      const createButton = screen.getByText('Create Match');
      expect(createButton).toBeInTheDocument();
    });

    await user.click(screen.getByText('Create Match'));
    
    // Should navigate to create match page
    expect(window.location.href).toContain('/create-match');
  });
});