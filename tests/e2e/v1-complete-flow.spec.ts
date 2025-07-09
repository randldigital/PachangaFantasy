import { test, expect } from '@playwright/test';

/**
 * End-to-End Tests for Pachanga Fantasy v1.0
 * Tests complete user journeys through the application
 */

test.describe('Pachanga Fantasy v1.0 - Complete User Flow', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testUsername = `testuser_${Date.now()}`;
  const leagueName = `Test League ${Date.now()}`;

  test('complete user journey: register → create league → add players → create match → lineup → scoring', async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Step 1: Register new user
    await page.click('text=Register');
    await page.fill('input[name="username"]', testUsername);
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Verify login success and redirect to overview
    await expect(page).toHaveURL('/overview');
    await expect(page.getByText(testUsername)).toBeVisible();

    // Step 2: Create a new league
    await page.click('text=Create League');
    await page.fill('input[name="name"]', leagueName);
    await page.fill('textarea[name="description"]', 'Test league for E2E testing');
    await page.click('button[type="submit"]');

    // Verify league creation and redirect to league detail
    await expect(page.getByText(leagueName)).toBeVisible();
    await expect(page.getByText('Invite Code')).toBeVisible();

    // Step 3: Add players to league (creator automatically added)
    await page.click('text=Add Player');
    await page.fill('input[name="name"]', 'Test Player 1');
    await page.selectOption('select[name="emoji"]', '⚽');
    await page.click('button:has-text("Add Player")');

    // Add more players for a full test
    await page.click('text=Add Player');
    await page.fill('input[name="name"]', 'Test Player 2');
    await page.selectOption('select[name="emoji"]', '🥅');
    await page.click('button:has-text("Add Player")');

    // Verify players are added
    await expect(page.getByText('Test Player 1')).toBeVisible();
    await expect(page.getByText('Test Player 2')).toBeVisible();
    await expect(page.getByText('👑')).toBeVisible(); // Creator crown

    // Step 4: Create a match
    await page.click('text=Create Match');
    await page.fill('input[type="datetime-local"]', '2025-07-15T19:00');
    await page.fill('input[name="lineupBudget"]', '100');
    await page.click('button:has-text("Create Match")');

    // Verify match creation
    await expect(page.getByText('Open')).toBeVisible();
    await expect(page.getByText('Budget: 100')).toBeVisible();

    // Step 5: Join the match
    await page.click('text=Join Match');
    
    // Verify participation
    await expect(page.getByText('Joined')).toBeVisible();

    // Step 6: Create lineup
    await page.click('text=Create Lineup');

    // Select 5 players for lineup (including captain)
    const playerElements = page.locator('[data-testid="player-card"]');
    const playerCount = await playerElements.count();
    
    for (let i = 0; i < Math.min(5, playerCount); i++) {
      await playerElements.nth(i).click();
    }

    // Select captain (first selected player)
    await page.click('[data-testid="captain-selector"]');
    await page.selectOption('[data-testid="captain-selector"]', '0');

    // Save lineup
    await page.click('button:has-text("Save Lineup")');

    // Verify lineup saved
    await expect(page.getByText('Lineup Saved')).toBeVisible();
    await expect(page.getByText('Captain')).toBeVisible();

    // Step 7: Admin goal validation
    await page.click('text=Admin Controls');
    await page.fill('input[name="totalGoals"]', '3');
    await page.click('button:has-text("Validate Goals")');

    // Verify goal validation
    await expect(page.getByText('Goals validated')).toBeVisible();

    // Step 8: Calculate scores
    await page.click('button:has-text("Calculate Scores")');

    // Verify score calculation
    await expect(page.getByText('Scores calculated')).toBeVisible();

    // Step 9: View leaderboard
    await page.click('text=Leaderboard');

    // Verify leaderboard display
    await expect(page.getByText('Rankings')).toBeVisible();
    await expect(page.getByText(testUsername)).toBeVisible();
  });

  test('tier list functionality', async ({ page }) => {
    // Setup: login as existing user and navigate to tier list
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to league and tier list
    await page.goto('/overview');
    await page.click(`text=${leagueName}`);
    await page.click('text=Tier List');

    // Test drag and drop functionality
    const playerItems = page.locator('[data-testid="draggable-player"]');
    const tierS = page.locator('[data-testid="tier-S"]');
    const tierA = page.locator('[data-testid="tier-A"]');

    // Drag first player to S tier
    if (await playerItems.count() > 0) {
      await playerItems.first().dragTo(tierS);
      
      // Verify player moved to S tier
      const sTierPlayers = tierS.locator('[data-testid="draggable-player"]');
      await expect(sTierPlayers).toHaveCount(1);
    }

    // Submit tier list
    await page.click('button:has-text("Submit Tier List")');
    
    // Verify submission
    await expect(page.getByText('Tier list submitted')).toBeVisible();
  });

  test('responsive design and navigation', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Should show mobile navigation
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    
    // Test navigation menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.getByText('Overview')).toBeVisible();
    await expect(page.getByText('Leagues')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    
    // Should show desktop navigation
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('error handling and validation', async ({ page }) => {
    await page.goto('/login');
    
    // Test invalid login
    await page.fill('input[name="email"]', 'invalid@email.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.getByText('Invalid credentials')).toBeVisible();
    
    // Test form validation
    await page.goto('/register');
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.getByText('Username is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('league permissions and access control', async ({ page }) => {
    // Login as existing user
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Go to league
    await page.goto('/overview');
    await page.click(`text=${leagueName}`);

    // Creator should see admin controls
    await expect(page.getByText('Creator Controls')).toBeVisible();
    await expect(page.getByText('Add Player')).toBeVisible();
    await expect(page.getByText('Create Match')).toBeVisible();

    // Test that non-creators cannot access admin functions
    // This would require a second user account for full testing
  });
});

test.describe('Visual Regression Tests', () => {
  test('homepage layout', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('league dashboard layout', async ({ page }) => {
    // Would need to login and navigate to league first
    await page.goto('/login');
    // Screenshot after login flow...
  });

  test('tier list drag interface', async ({ page }) => {
    // Would need to navigate to tier list page
    // Screenshot of tier list interface...
  });
});