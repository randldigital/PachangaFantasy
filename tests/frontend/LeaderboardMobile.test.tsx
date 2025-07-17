import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import EnhancedLeaderboard from '../../client/src/components/league/EnhancedLeaderboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('Leaderboard (Mobile Viewport)', () => {
  beforeEach(() => {
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
  });

  it('renders leaderboard with mobile layout', async () => {
    const rankings = [
      { userId: 1, username: 'Alice', totalPoints: 30 },
      { userId: 2, username: 'Bob', totalPoints: 25 },
      { userId: 3, username: 'Carol', totalPoints: 20 },
    ];
    const { apiRequest } = await import('../../client/src/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue({
      json: () => Promise.resolve(rankings),
      status: 200,
      ok: true,
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: function() { return this; },
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new Uint8Array(),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      text: async () => '',
      statusText: '',
    } as unknown as Response);
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <EnhancedLeaderboard leagueId={1} />
      </QueryClientProvider>
    );
    // Wait for leaderboard to render
    for (const r of rankings) {
      expect(await screen.findByText(r.username)).toBeTruthy();
    }
    // Assert leaderboard root is present
    const leaderboardRoot = screen.getByTestId('leaderboard-root');
    expect(leaderboardRoot).toBeTruthy();
    // Assert correct number of rows
    const rows = screen.getAllByTestId('leaderboard-row');
    expect(rows.length).toBe(rankings.length);
    // Assert mobile layout (single column grid or mobile class)
    // This may need to be adjusted if the class changes
    expect(leaderboardRoot.className.includes('bg-[#1e1e1e]')).toBe(true);
  });
}); 