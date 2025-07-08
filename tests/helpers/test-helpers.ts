import { Page } from '@playwright/test';
import { User, League, Player, Match } from '@shared/schema';

/**
 * Test utilities for E2E testing
 */

export const TEST_USERS = {
  admin: {
    username: 'testadmin',
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin' as const
  },
  player: {
    username: 'testplayer',
    email: 'player@test.com',
    password: 'password123',
    role: 'player' as const
  }
};

export async function registerAndLogin(page: Page, userType: 'admin' | 'player' = 'admin') {
  const timestamp = Date.now();
  const user = {
    username: `${userType}${timestamp}`,
    email: `${userType}${timestamp}@example.com`,
    password: 'password123',
    role: userType
  };

  await page.goto('/register');
  await page.fill('input[type="text"]', user.username);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('[role="combobox"]');
  await page.click(`text=${userType === 'admin' ? 'Admin' : 'Player'}`);
  await page.click('button[type="submit"]');

  return user;
}

export async function createTestLeague(page: Page, name?: string) {
  const leagueName = name || `Test League ${Date.now()}`;
  
  await page.click('text=Create League');
  await page.fill('input[placeholder*="league name"]', leagueName);
  await page.fill('textarea', `Description for ${leagueName}`);
  await page.click('button[type="submit"]');
  
  return leagueName;
}

export async function joinLeagueWithCode(page: Page, inviteCode: string) {
  await page.click('text=Join League');
  await page.fill('input[placeholder*="invite code"]', inviteCode);
  await page.click('button[type="submit"]');
}

export async function createTestMatch(page: Page, date = '2025-08-15', time = '19:00', budget = 100) {
  await page.click('text=Create Match');
  await page.fill('input[type="date"]', date);
  await page.fill('input[type="time"]', time);
  await page.fill('input[placeholder*="budget"]', budget.toString());
  await page.click('button[type="submit"]');
}

export async function addUserAsPlayer(page: Page) {
  await page.click('text=Add Myself as Player');
  await page.waitForTimeout(1000); // Wait for API call
}

export async function submitTierList(page: Page, playerOrder: number[]) {
  // This would need to simulate drag and drop operations
  // For now, just navigate to tier list page
  await page.click('text=Tier List');
  await page.waitForTimeout(2000);
  
  // Simulate tier list submission if possible
  const submitButton = page.locator('button:has-text("Submit Rankings")');
  if (await submitButton.count() > 0 && await submitButton.isEnabled()) {
    await submitButton.click();
  }
}

export async function waitForToast(page: Page, message?: string) {
  if (message) {
    await page.waitForSelector(`text=${message}`, { timeout: 5000 });
  } else {
    // Wait for any toast to appear
    await page.waitForSelector('[role="alert"]', { timeout: 5000 });
  }
}

export async function logout(page: Page) {
  await page.click('text=Logout');
  await page.waitForURL('/login');
}

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role: 'player',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

export function createMockLeague(overrides: Partial<League> = {}): League {
  return {
    id: 1,
    name: 'Test League',
    description: 'Test league description',
    inviteCode: 'ABC123',
    createdBy: 1,
    participants: [1],
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

export function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'Test Player',
    emoji: '⚽',
    leagueId: 1,
    marketValue: 50,
    createdBy: 1,
    userId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

export function createMockMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 1,
    leagueId: 1,
    date: new Date().toISOString(),
    lineupBudget: 100,
    status: 'upcoming',
    createdBy: 1,
    teamA: [],
    teamB: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

export const TEST_DATABASE = {
  async clear() {
    // This would clear test database if needed
    // Implementation depends on test database setup
  },
  
  async seed() {
    // This would seed test database with sample data
    // Implementation depends on test database setup
  }
};