import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { User, League, Player, Match } from '@shared/schema';

// Create a new QueryClient for each test to avoid cross-test pollution
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialUser?: User | null;
}

const AllTheProviders = ({ 
  children, 
  initialUser = null 
}: { 
  children: React.ReactNode;
  initialUser?: User | null;
}) => {
  const queryClient = createTestQueryClient();
  
  // Mock AuthProvider with test user
  const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const mockAuthValue = {
      user: initialUser,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
    };
    
    return (
      <AuthProvider value={mockAuthValue as any}>
        {children}
      </AuthProvider>
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </MockAuthProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialUser, ...renderOptions } = options;
  
  return render(ui, {
    wrapper: (props) => <AllTheProviders {...props} initialUser={initialUser} />,
    ...renderOptions,
  });
};

// Mock data generators
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'player',
  leagueId: null,
  ...overrides,
});

export const createMockLeague = (overrides: Partial<League> = {}): League => ({
  id: 1,
  name: 'Test League',
  description: 'A test league for unit tests',
  inviteCode: 'TEST123',
  status: 'open',
  createdBy: 1,
  participants: [1],
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

// Database test utilities
export const setupTestDatabase = async () => {
  // This would set up a test database instance
  // For now, we'll use mocks in tests
};

export const cleanupTestDatabase = async () => {
  // This would clean up the test database
};

// API response helpers
export const mockSuccessResponse = <T,>(data: T) => ({
  ok: true,
  status: 200,
  json: async () => data,
});

export const mockErrorResponse = (message: string, status: number = 400) => ({
  ok: false,
  status,
  json: async () => ({ message }),
});

// Export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };