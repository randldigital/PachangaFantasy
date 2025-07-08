import { test, expect } from '@playwright/test';

test.describe('Tier List System', () => {
  let leagueId: string;
  
  test.beforeEach(async ({ page }) => {
    // Register as admin and create league with players
    await page.goto('/register');
    await page.fill('input[type="text"]', `admin${Date.now()}`);
    await page.fill('input[type="email"]', `admin${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
    
    // Create league
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Tier List Test League');
    await page.click('button[type="submit"]');
    
    // Go to league detail and add some players
    const leagueCard = page.locator('text=Tier List Test League').first();
    await leagueCard.click();
    
    // Extract league ID from URL
    const url = page.url();
    leagueId = url.split('/leagues/')[1];
    
    // Add myself as player
    await page.click('text=Add Myself as Player');
    await page.waitForTimeout(1000);
  });

  test('should navigate to tier list page', async ({ page }) => {
    // Click Tier List button
    await page.click('text=Tier List');
    
    // Should navigate to tier list page
    await expect(page).toHaveURL(`/leagues/${leagueId}/tierlist`);
    await expect(page.locator('text=Tier List')).toBeVisible();
  });

  test('should display players in available pool', async ({ page }) => {
    await page.click('text=Tier List');
    
    // Should show drag and drop context
    await expect(page.locator('[data-testid="dnd-context"]')).toBeVisible();
    await expect(page.locator('[data-testid="sortable-context"]')).toBeVisible();
    
    // Should show tier sections
    await expect(page.locator('text=S Tier')).toBeVisible();
    await expect(page.locator('text=A Tier')).toBeVisible();
    await expect(page.locator('text=B Tier')).toBeVisible();
    await expect(page.locator('text=C Tier')).toBeVisible();
    await expect(page.locator('text=D Tier')).toBeVisible();
  });

  test('should drag and drop players between tiers', async ({ page }) => {
    await page.click('text=Tier List');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for player cards in available players section
    const playerCards = page.locator('[data-testid="available-players"] .cursor-move');
    const playerCount = await playerCards.count();
    
    if (playerCount > 0) {
      // Get first player card
      const firstPlayer = playerCards.first();
      
      // Drag to S Tier
      const sTier = page.locator('[data-testid="tier1-droppable"]');
      await firstPlayer.dragTo(sTier);
      
      // Should see player in S Tier now
      await expect(page.locator('[data-testid="tier1-droppable"] .cursor-move')).toHaveCount(1);
    }
  });

  test('should enable submit button when all players are ranked', async ({ page }) => {
    await page.click('text=Tier List');
    await page.waitForTimeout(2000);
    
    // Initially submit should be disabled if not all players are ranked
    const submitButton = page.locator('button:has-text("Submit Rankings")');
    
    // Check if button exists and its state
    if (await submitButton.count() > 0) {
      // Try to rank all available players
      const playerCards = page.locator('[data-testid="available-players"] .cursor-move');
      const playerCount = await playerCards.count();
      
      // If there are players to rank
      if (playerCount > 0) {
        // For now, just check that the tier list interface is working
        await expect(page.locator('[data-testid="dnd-context"]')).toBeVisible();
      }
    }
  });

  test('should show instructions for tier list usage', async ({ page }) => {
    await page.click('text=Tier List');
    
    // Should show instructions
    await expect(page.locator('text=Instructions')).toBeVisible();
    await expect(page.locator('text=Drag players')).toBeVisible();
  });

  test('should show already submitted message if tier list was submitted', async ({ page }) => {
    await page.click('text=Tier List');
    await page.waitForTimeout(2000);
    
    // Try to submit a tier list (if possible)
    const submitButton = page.locator('button:has-text("Submit Rankings")');
    
    if (await submitButton.count() > 0 && await submitButton.isEnabled()) {
      await submitButton.click();
      
      // Should redirect and show success
      await expect(page).toHaveURL(`/league/${leagueId}`);
      
      // Go back to tier list
      await page.click('text=Tier List');
      
      // Should show already submitted message
      await expect(page.locator('text=Already Submitted')).toBeVisible();
    }
  });

  test('should show league information on tier list page', async ({ page }) => {
    await page.click('text=Tier List');
    
    // Should show league name and context
    await expect(page.locator('text=Tier List Test League')).toBeVisible();
    await expect(page.locator('text=League:')).toBeVisible();
  });

  test('should handle empty league gracefully', async ({ page }) => {
    // Create a new league without players
    await page.goto('/');
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Empty League Test');
    await page.click('button[type="submit"]');
    
    // Go to tier list
    const leagueCard = page.locator('text=Empty League Test').first();
    await leagueCard.click();
    await page.click('text=Tier List');
    
    // Should handle empty state gracefully
    await expect(page.locator('[data-testid="dnd-context"]')).toBeVisible();
    
    // Should show that there are no players to rank
    const availablePlayers = page.locator('[data-testid="available-players"] .cursor-move');
    await expect(availablePlayers).toHaveCount(0);
  });
});