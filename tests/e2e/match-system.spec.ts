import { test, expect } from '@playwright/test';

test.describe('Match System', () => {
  let leagueId: string;
  
  test.beforeEach(async ({ page }) => {
    // Register as admin and create league
    await page.goto('/register');
    await page.fill('input[type="text"]', `admin${Date.now()}`);
    await page.fill('input[type="email"]', `admin${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
    
    // Create league
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Match Test League');
    await page.click('button[type="submit"]');
    
    // Go to league detail
    const leagueCard = page.locator('text=Match Test League').first();
    await leagueCard.click();
    
    // Extract league ID
    const url = page.url();
    leagueId = url.split('/leagues/')[1];
    
    // Add myself as player
    await page.click('text=Add Myself as Player');
    await page.waitForTimeout(1000);
  });

  test('should navigate to create match page', async ({ page }) => {
    // Click Create Match button
    await page.click('text=Create Match');
    
    // Should navigate to create match page
    await expect(page).toHaveURL(`/leagues/${leagueId}/create-match`);
    await expect(page.locator('text=Create Match')).toBeVisible();
  });

  test('should create a match successfully', async ({ page }) => {
    await page.click('text=Create Match');
    
    // Fill match form
    await page.fill('input[type="date"]', '2025-08-15');
    await page.fill('input[type="time"]', '19:00');
    await page.fill('input[placeholder*="budget"]', '150');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to league detail and show new match
    await expect(page).toHaveURL(`/leagues/${leagueId}`);
    await expect(page.locator('text=August 15')).toBeVisible();
  });

  test('should display matches on league dashboard', async ({ page }) => {
    // Create a match first
    await page.click('text=Create Match');
    await page.fill('input[type="date"]', '2025-08-20');
    await page.fill('input[type="time"]', '20:00');
    await page.click('button[type="submit"]');
    
    // Should see match card on league detail
    await expect(page.locator('text=August 20')).toBeVisible();
    await expect(page.locator('text=Budget: 100')).toBeVisible();
    
    // Match card should be clickable
    const matchCard = page.locator('text=August 20').first();
    await matchCard.click();
    
    // Should navigate to match detail
    await expect(page.url()).toMatch(/\/matches\/\d+$/);
  });

  test('should join match successfully', async ({ page }) => {
    // Create a match
    await page.click('text=Create Match');
    await page.fill('input[type="date"]', '2025-08-25');
    await page.fill('input[type="time"]', '18:00');
    await page.click('button[type="submit"]');
    
    // Go to match detail
    const matchCard = page.locator('text=August 25').first();
    await matchCard.click();
    
    // Should see Join Match button
    await expect(page.locator('button:has-text("Join Match")')).toBeVisible();
    
    // Click Join Match
    await page.click('button:has-text("Join Match")');
    
    // Should see confirmation or status update
    await expect(page.locator('text=Joined')).toBeVisible();
  });

  test('should display match participants', async ({ page }) => {
    // Create and join match
    await page.click('text=Create Match');
    await page.fill('input[type="date"]', '2025-08-30');
    await page.click('button[type="submit"]');
    
    const matchCard = page.locator('text=August 30').first();
    await matchCard.click();
    
    await page.click('button:has-text("Join Match")');
    
    // Should show participants section
    await expect(page.locator('text=Participants')).toBeVisible();
    await expect(page.locator('text=admin')).toBeVisible();
  });

  test('should navigate to lineup page from match detail', async ({ page }) => {
    // Create and join match
    await page.click('text=Create Match');
    await page.fill('input[type="date"]', '2025-09-01');
    await page.click('button[type="submit"]');
    
    const matchCard = page.locator('text=September 1').first();
    await matchCard.click();
    
    await page.click('button:has-text("Join Match")');
    
    // Should see View Lineup button
    await expect(page.locator('button:has-text("View Lineup")')).toBeVisible();
    
    // Click View Lineup
    await page.click('button:has-text("View Lineup")');
    
    // Should navigate to lineup page
    await expect(page.url()).toMatch(/\/matches\/\d+\/lineup$/);
    await expect(page.locator('text=Select Your Lineup')).toBeVisible();
  });

  test('should validate required fields in match creation', async ({ page }) => {
    await page.click('text=Create Match');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=Required')).toBeVisible();
  });

  test('should show match information correctly', async ({ page }) => {
    // Create match with specific details
    await page.click('text=Create Match');
    await page.fill('input[type="date"]', '2025-09-05');
    await page.fill('input[type="time"]', '21:30');
    await page.fill('input[placeholder*="budget"]', '200');
    await page.click('button[type="submit"]');
    
    // Go to match detail
    const matchCard = page.locator('text=September 5').first();
    await matchCard.click();
    
    // Should show correct match information
    await expect(page.locator('text=September 5')).toBeVisible();
    await expect(page.locator('text=21:30')).toBeVisible();
    await expect(page.locator('text=Budget: 200')).toBeVisible();
  });

  test('should handle match status transitions', async ({ page }) => {
    // Create match
    await page.click('text=Create Match');
    await page.fill('input[type="date"]', '2025-09-10');
    await page.click('button[type="submit"]');
    
    const matchCard = page.locator('text=September 10').first();
    await matchCard.click();
    
    // Initially should be in upcoming status
    await expect(page.locator('text=upcoming')).toBeVisible();
    
    // After joining, status might change
    await page.click('button:has-text("Join Match")');
    await page.waitForTimeout(1000);
    
    // Should show updated status or participant count
    await expect(page.locator('text=Participants')).toBeVisible();
  });
});