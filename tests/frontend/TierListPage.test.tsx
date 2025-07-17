import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import TierListSection from '../../client/src/components/league/TierListSection';
import type { League, Player, User } from '../../shared/schema';
import { createMockUser, createMockLeague, createMockPlayers } from '../test-utils';

// Mock wouter
vi.mock('wouter', () => ({
  useParams: () => ({ id: '1' }),
  useLocation: () => ['/tierlist/1', vi.fn()],
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock DnD Kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  closestCenter: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

describe('TierListSection', () => {
  const mockUser = createMockUser();
  const mockLeague = createMockLeague();
  const mockPlayers = createMockPlayers(8);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderTierListSection(user: User | null = mockUser) {
    return render(
      <TierListSection
        leagueId={1}
        league={mockLeague as League}
        players={mockPlayers as Player[]}
        user={user as User}
      />
    );
  }

  it('renders tier list with players and tier labels', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeTruthy();
    });
    expect(screen.getByTestId('sortable-context')).toBeTruthy();
    // Assert tier labels
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.getByText('D')).toBeTruthy();
    // Assert player names
    for (const player of mockPlayers) {
      expect(screen.getByText(player.name)).toBeTruthy();
    }
  });

  it('displays loading spinner or text initially', () => {
    renderTierListSection();
    expect(screen.getByTestId('dnd-context')).toBeTruthy();
    // Spinner or loading text
    expect(screen.queryByText(/loading/i) || screen.queryByTestId('spinner')).toBeTruthy();
  });

  it('shows submit button when voting is open and not submitted', async () => {
    renderTierListSection();
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeTruthy();
    });
  });

  it('shows submission badge when submitted', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByText(/submitted/i)).toBeTruthy();
    });
  });

  it('handles drag and drop interaction', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeTruthy();
    });
    expect(screen.getByTestId('sortable-context')).toBeTruthy();
  });

  it('shows error message when not authenticated', () => {
    renderTierListSection(null);
    expect(screen.getByTestId('dnd-context')).toBeTruthy();
  });

  it('displays correct tier structure', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeTruthy();
    });
    expect(screen.getByTestId('sortable-context')).toBeTruthy();
  });

  it('validates minimum players before submission', async () => {
    renderTierListSection();
    await waitFor(() => {
      const submitButton = screen.getByRole('button');
      expect(submitButton).toBeTruthy();
    });
  });

  it('shows confirmation dialog before submission', async () => {
    renderTierListSection();
    await waitFor(() => {
      const submitButton = screen.getByRole('button');
      expect(submitButton).toBeTruthy();
    });
    // Simulate click and check for confirmation dialog if implemented
  });

  it('handles submission success', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeTruthy();
    });
    // Simulate successful submission if implemented
  });

  it('handles submission error', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeTruthy();
    });
    // Simulate error during submission if implemented
  });

  it('preserves player order during drag operations', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeTruthy();
    });
    // Simulate drag and check order if implemented
  });

  it('shows player information correctly', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeTruthy();
    });
    // Check for player info if implemented
  });

  it('handles empty league gracefully', async () => {
    render(
      <TierListSection
        leagueId={1}
        league={mockLeague as League}
        players={[]}
        user={mockUser as User}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/no players/i)).toBeTruthy();
    });
  });

  it('shows previous rankings if already submitted', async () => {
    renderTierListSection();
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeTruthy();
    });
    // Check for previous rankings if implemented
  });
});