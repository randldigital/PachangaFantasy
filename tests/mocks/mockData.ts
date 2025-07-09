import type { User, League, Match, Player, TierList } from '../../shared/schema';

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'player',
    leagueId: null,
    ...overrides,
  };
}

export function createMockLeague(overrides: Partial<League> = {}): League {
  return {
    id: 1,
    name: 'Test League',
    description: 'Test league description',
    inviteCode: 'TEST123',
    createdBy: 1,
    status: 'open',
    participants: [1, 2, 3],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 1,
    leagueId: 1,
    date: new Date('2025-01-15T10:00:00Z'),
    lineupBudget: 100,
    status: 'open',
    matchTeams: null,
    createdBy: 1,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'Test Player',
    leagueId: 1,
    marketValue: 50,
    emoji: '⚽',
    createdBy: 1,
    userId: null,
    ...overrides,
  };
}

export function createMockTierList(overrides: Partial<TierList> = {}): TierList {
  return {
    id: 1,
    leagueId: 1,
    userId: 1,
    playerOrder: [1, 2, 3],
    submitted: false,
    ...overrides,
  };
}