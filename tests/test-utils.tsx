import React, { ReactElement, ReactNode, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../client/src/components/ui/tooltip';
import type { User, League, Player, Match } from '../shared/schema';

// --- Mock Auth Context ---
interface MockAuthContextType {
  user: User | null;
  login: () => void;
  register: () => void;
  logout: () => void;
  loading: boolean;
}
const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);
export function useAuth() {
  const context = useContext(MockAuthContext);
  if (!context) throw new Error('useAuth must be used within a MockAuthProvider');
  return context;
}
const MockAuthProvider = ({ children, user = null }: { children: ReactNode; user?: User | null }) => (
  <MockAuthContext.Provider value={{
    user,
    login: () => {},
    register: () => {},
    logout: () => {},
    loading: false,
  }}>
    {children}
  </MockAuthContext.Provider>
);

// --- Query Client ---
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

interface CustomRenderOptions {
  initialUser?: User | null;
}

const AllTheProviders = ({ children, initialUser = null }: { children: ReactNode; initialUser?: User | null }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider user={initialUser}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </MockAuthProvider>
    </QueryClientProvider>
  );
};

import { render as rtlRender, RenderOptions } from '@testing-library/react';
const render = (ui: ReactElement, options: CustomRenderOptions = {}) => {
  const { initialUser, ...renderOptions } = options;
  return rtlRender(ui, {
    wrapper: (props) => <AllTheProviders {...props} initialUser={initialUser} />, ...renderOptions,
  });
};

// --- Mock Data Generators ---
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  password: 'password',
  role: 'player',
  leagueId: null,
  ...overrides,
});
export const createMockLeague = (overrides: Partial<League> = {}): League => ({
  id: 1,
  name: 'Test League',
  description: '',
  inviteCode: 'TEST123',
  createdBy: 1,
  status: 'open',
  participants: [1],
  createdAt: new Date(),
  ...overrides,
});
export const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 1,
  name: 'Test Player',
  emoji: '⚽',
  marketValue: 50,
  leagueId: 1,
  createdBy: 1,
  userId: 1,
  ...overrides,
});
export const createMockMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 1,
  leagueId: 1,
  date: new Date('2025-01-15T10:00:00Z'),
  lineupBudget: 100,
  status: 'open',
  matchTeams: null,
  finalScore: null,
  createdBy: 1,
  createdAt: new Date(),
  ...overrides,
});
export const createMockPlayers = (count: number = 5): Player[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockPlayer({
      id: index + 1,
      name: `Player ${index + 1}`,
      marketValue: 10 + (index * 10),
      userId: index + 1,
    })
  );
};

// --- Export everything from testing-library ---
export * from '@testing-library/react';
export { render };