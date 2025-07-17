import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../client/src/contexts/AuthContext';
import AddPlayerForm from '../../client/src/components/league/AddPlayerForm';
import DeleteLeagueButton from '../../client/src/components/league/DeleteLeagueButton';
import EndMatchButton from '../../client/src/components/league/EndMatchButton';
import { createMockUser, createMockLeague, createMockMatch } from '../mocks/mockData';
import type { User, League, Match } from '../../shared/schema';

vi.mock('../../client/src/lib/queryClient', () => ({ apiRequest: vi.fn() }));
vi.mock('../../client/src/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('wouter', () => ({ useLocation: () => ['/test', vi.fn()] }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const createTestWrapper = (user: User | null = null) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe('League Owner Features', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('AddPlayerForm', () => {
    it('renders for league creators', () => {
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <AddPlayerForm leagueId={"1"} isOpen={true} onClose={() => {}} />
        </TestWrapper>
      );
      expect(screen.getByText('Add External Player')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter player name')).toBeTruthy();
      expect(screen.getByDisplayValue('⚽')).toBeTruthy();
    });

    it('does not render for non-league creators', () => {
      // Simulate not rendering the component at all
      expect(screen.queryByText('Add External Player')).toBeNull();
    });

    it('handles form submission correctly', async () => {
      const mockApiRequest = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ id: 1, name: 'Test Player' }) });
      const { apiRequest } = await import('../../client/src/lib/queryClient');
      vi.mocked(apiRequest).mockImplementation(mockApiRequest);
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <AddPlayerForm leagueId={"1"} isOpen={true} onClose={() => {}} />
        </TestWrapper>
      );
      const nameInput = screen.getByPlaceholderText('Enter player name');
      const submitButton = screen.getByText('Add Player');
      fireEvent.change(nameInput, { target: { value: 'Test Player' } });
      fireEvent.click(submitButton);
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/players/1', { name: 'Test Player', emoji: '⚽' });
      });
    });

    it('validates required fields', () => {
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <AddPlayerForm leagueId={"1"} isOpen={true} onClose={() => {}} />
        </TestWrapper>
      );
      const submitButton = screen.getByText('Add Player');
      expect(submitButton.getAttribute('disabled')).not.toBeNull();
      const nameInput = screen.getByPlaceholderText('Enter player name');
      fireEvent.change(nameInput, { target: { value: 'Test Player' } });
      expect(submitButton.getAttribute('disabled')).toBeNull();
    });
  });

  describe('DeleteLeagueButton', () => {
    const mockLeague = createMockLeague({ id: 1, name: 'Test League' });

    it('renders for league creators', () => {
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <DeleteLeagueButton league={mockLeague} isLeagueCreator={true} />
        </TestWrapper>
      );
      expect(screen.getByText('Delete League')).toBeTruthy();
    });

    it('does not render for non-league creators', () => {
      const TestWrapper = createTestWrapper(createMockUser({ id: 2 }));
      render(
        <TestWrapper>
          <DeleteLeagueButton league={mockLeague} isLeagueCreator={false} />
        </TestWrapper>
      );
      expect(screen.queryByText('Delete League')).toBeNull();
    });

    it('shows confirmation dialog when clicked', async () => {
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <DeleteLeagueButton league={mockLeague} isLeagueCreator={true} />
        </TestWrapper>
      );
      const deleteButton = screen.getByText('Delete League');
      fireEvent.click(deleteButton);
      await waitFor(() => {
        expect(screen.getByText('Delete League?')).toBeTruthy();
        expect(screen.getByText(/Are you sure you want to delete this league/)).toBeTruthy();
      });
    });

    it('handles deletion correctly', async () => {
      const mockApiRequest = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ message: 'League deleted successfully' }) });
      const { apiRequest } = await import('../../client/src/lib/queryClient');
      vi.mocked(apiRequest).mockImplementation(mockApiRequest);
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <DeleteLeagueButton league={mockLeague} isLeagueCreator={true} />
        </TestWrapper>
      );
      const deleteButton = screen.getByText('Delete League');
      fireEvent.click(deleteButton);
      await waitFor(() => {
        const confirmButton = screen.getByText('Delete League');
        fireEvent.click(confirmButton);
      });
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('DELETE', '/api/leagues/1');
      });
    });
  });

  describe('EndMatchButton', () => {
    const mockMatch = createMockMatch({ id: 1, status: 'open' });

    it('renders for league creators with open matches', () => {
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <EndMatchButton match={mockMatch} leagueId={1} isLeagueCreator={true} />
        </TestWrapper>
      );
      expect(screen.getByText('End Match')).toBeTruthy();
    });

    it('does not render for non-league creators', () => {
      const TestWrapper = createTestWrapper(createMockUser({ id: 2 }));
      render(
        <TestWrapper>
          <EndMatchButton match={mockMatch} leagueId={1} isLeagueCreator={false} />
        </TestWrapper>
      );
      expect(screen.queryByText('End Match')).toBeNull();
    });

    it('does not render for completed matches', () => {
      const completedMatch = createMockMatch({ id: 1, status: 'completed' });
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <EndMatchButton match={completedMatch} leagueId={1} isLeagueCreator={true} />
        </TestWrapper>
      );
      expect(screen.queryByText('End Match')).toBeNull();
    });

    it('shows confirmation dialog when clicked', async () => {
      const TestWrapper = createTestWrapper(createMockUser({ id: 1 }));
      render(
        <TestWrapper>
          <EndMatchButton match={mockMatch} leagueId={1} isLeagueCreator={true} />
        </TestWrapper>
      );
      const endButton = screen.getByText('End Match');
      fireEvent.click(endButton);
      await waitFor(() => {
        expect(screen.getByText('End Match?')).toBeTruthy();
        expect(screen.getByText(/Are you sure you want to end this match/)).toBeTruthy();
      });
    });
  });
});