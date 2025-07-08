import { test, expect } from '@playwright/test';

test.describe('Quick Smoke Tests', () => {
  test('should load the application successfully', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login or show app
    const currentUrl = page.url();
    expect(currentUrl.includes('/login') || currentUrl === 'http://localhost:5000/').toBeTruthy();
  });

  test('should be able to register and access dashboard', async ({ page }) => {
    await page.goto('/register');
    
    // Fill registration form
    const timestamp = Date.now();
    await page.fill('input[type="text"]', `smoketest${timestamp}`);
    await page.fill('input[type="email"]', `smoketest${timestamp}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    
    // Select role
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    
    // Submit registration
    await page.click('button[type="submit"]');
    
    // Should be on dashboard
    await expect(page).toHaveURL('/');
    
    // Should see Create League and Join League buttons
    await expect(page.locator('text=Create League')).toBeVisible();
    await expect(page.locator('text=Join League')).toBeVisible();
  });

  test('should create a league and navigate to it', async ({ page }) => {
    // Register first
    await page.goto('/register');
    const timestamp = Date.now();
    await page.fill('input[type="text"]', `admin${timestamp}`);
    await page.fill('input[type="email"]', `admin${timestamp}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
    
    // Create league
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Smoke Test League');
    await page.click('button[type="submit"]');
    
    // Should return to dashboard with new league
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Smoke Test League')).toBeVisible();
    
    // Click on league
    const leagueCard = page.locator('text=Smoke Test League').first();
    await leagueCard.click();
    
    // Should be on league detail page
    await expect(page.url()).toMatch(/\/leagues\/\d+$/);
    
    // Should see league actions
    await expect(page.locator('text=Create Match')).toBeVisible();
    await expect(page.locator('text=Tier List')).toBeVisible();
  });

  test('should handle tier list page navigation', async ({ page }) => {
    // Register and create league
    await page.goto('/register');
    const timestamp = Date.now();
    await page.fill('input[type="text"]', `tiertest${timestamp}`);
    await page.fill('input[type="email"]', `tiertest${timestamp}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
    
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Tier Test League');
    await page.click('button[type="submit"]');
    
    // Go to league and then tier list
    const leagueCard = page.locator('text=Tier Test League').first();
    await leagueCard.click();
    
    await page.click('text=Tier List');
    
    // Should be on tier list page
    await expect(page.url()).toMatch(/\/leagues\/\d+\/tierlist$/);
    await expect(page.locator('text=Tier List')).toBeVisible();
  });

  test('should handle match creation flow', async ({ page }) => {
    // Register and create league
    await page.goto('/register');
    const timestamp = Date.now();
    await page.fill('input[type="text"]', `matchtest${timestamp}`);
    await page.fill('input[type="email"]', `matchtest${timestamp}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
    
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Match Test League');
    await page.click('button[type="submit"]');
    
    // Go to league and create match
    const leagueCard = page.locator('text=Match Test League').first();
    await leagueCard.click();
    
    await page.click('text=Create Match');
    
    // Should be on create match page
    await expect(page.url()).toMatch(/\/leagues\/\d+\/create-match$/);
    
    // Fill match form
    await page.fill('input[type="date"]', '2025-08-15');
    await page.fill('input[type="time"]', '19:00');
    await page.click('button[type="submit"]');
    
    // Should return to league with new match
    await expect(page.url()).toMatch(/\/leagues\/\d+$/);
    await expect(page.locator('text=August 15')).toBeVisible();
  });
});