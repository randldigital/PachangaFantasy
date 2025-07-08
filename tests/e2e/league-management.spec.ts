import { test, expect } from '@playwright/test';

test.describe('League Management', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login as admin
    await page.goto('/register');
    await page.fill('input[type="text"]', `admin${Date.now()}`);
    await page.fill('input[type="email"]', `admin${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/');
  });

  test('should create a new league successfully', async ({ page }) => {
    // Click Create League button
    await page.click('text=Create League');
    await expect(page).toHaveURL('/create-league');
    
    // Fill league form
    await page.fill('input[placeholder*="league name"]', 'Test League E2E');
    await page.fill('textarea', 'This is a test league for E2E testing');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard and show new league
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Test League E2E')).toBeVisible();
  });

  test('should display league cards on dashboard', async ({ page }) => {
    // Create a league first
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Dashboard Test League');
    await page.fill('textarea', 'Dashboard test description');
    await page.click('button[type="submit"]');
    
    // Should see league card on dashboard
    await expect(page.locator('text=Dashboard Test League')).toBeVisible();
    await expect(page.locator('text=Dashboard test description')).toBeVisible();
    
    // League card should be clickable
    const leagueCard = page.locator('text=Dashboard Test League').first();
    await leagueCard.click();
    
    // Should navigate to league detail
    await expect(page.url()).toMatch(/\/leagues\/\d+$/);
  });

  test('should join league with invite code', async ({ page }) => {
    // Create a league first
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Join Test League');
    await page.click('button[type="submit"]');
    
    // Get invite code from league detail
    const leagueCard = page.locator('text=Join Test League').first();
    await leagueCard.click();
    
    const inviteCodeElement = page.locator('text=/[A-Z0-9]{6}/').first();
    const inviteCode = await inviteCodeElement.textContent();
    
    // Logout and register as new user
    await page.click('text=Logout');
    await page.goto('/register');
    await page.fill('input[type="text"]', `player${Date.now()}`);
    await page.fill('input[type="email"]', `player${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Player');
    await page.click('button[type="submit"]');
    
    // Join league with invite code
    await page.click('text=Join League');
    await expect(page).toHaveURL('/join-league');
    
    await page.fill('input[placeholder*="invite code"]', inviteCode!);
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard and show joined league
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Join Test League')).toBeVisible();
  });

  test('should show admin actions in league detail', async ({ page }) => {
    // Create a league
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Admin Actions Test');
    await page.click('button[type="submit"]');
    
    // Go to league detail
    const leagueCard = page.locator('text=Admin Actions Test').first();
    await leagueCard.click();
    
    // Should see admin-only buttons
    await expect(page.locator('text=Create Match')).toBeVisible();
    await expect(page.locator('text=Tier List')).toBeVisible();
    await expect(page.locator('text=Add Myself as Player')).toBeVisible();
  });

  test('should add user as player successfully', async ({ page }) => {
    // Create a league
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Player Test League');
    await page.click('button[type="submit"]');
    
    // Go to league detail
    const leagueCard = page.locator('text=Player Test League').first();
    await leagueCard.click();
    
    // Click Add Myself as Player
    await page.click('text=Add Myself as Player');
    
    // Should show success message and button should be disabled
    await expect(page.locator('text=Successfully added')).toBeVisible();
    await expect(page.locator('text=Already added as player')).toBeVisible();
  });

  test('should validate required fields in league creation', async ({ page }) => {
    await page.click('text=Create League');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('text=Required')).toBeVisible();
  });

  test('should show error for invalid invite code', async ({ page }) => {
    await page.click('text=Join League');
    
    // Enter invalid invite code
    await page.fill('input[placeholder*="invite code"]', 'INVALID');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=League not found')).toBeVisible();
  });
});