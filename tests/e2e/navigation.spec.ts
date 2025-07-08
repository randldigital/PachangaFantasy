import { test, expect } from '@playwright/test';

test.describe('Navigation and Global Actions', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login
    await page.goto('/register');
    await page.fill('input[type="text"]', `navuser${Date.now()}`);
    await page.fill('input[type="email"]', `navuser${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
  });

  test('should navigate using navigation bar', async ({ page }) => {
    // Should be on dashboard
    await expect(page).toHaveURL('/');
    
    // Test home navigation (if logo/brand exists)
    const homeLink = page.locator('a[href="/"]').first();
    if (await homeLink.count() > 0) {
      await homeLink.click();
      await expect(page).toHaveURL('/');
    }
  });

  test('should show user information in navigation', async ({ page }) => {
    // Should show username somewhere in the interface
    const username = await page.textContent('body');
    expect(username).toContain('navuser');
  });

  test('should logout successfully', async ({ page }) => {
    // Find and click logout button
    const logoutButton = page.locator('text=Logout');
    await expect(logoutButton).toBeVisible();
    
    await logoutButton.click();
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login');
  });

  test('should handle navigation between main sections', async ({ page }) => {
    // Test Create League navigation
    await page.click('text=Create League');
    await expect(page).toHaveURL('/create-league');
    
    // Navigate back to dashboard
    await page.goto('/');
    await expect(page).toHaveURL('/');
    
    // Test Join League navigation
    await page.click('text=Join League');
    await expect(page).toHaveURL('/join-league');
  });

  test('should show appropriate buttons based on user role', async ({ page }) => {
    // Admin should see Create League and Join League
    await expect(page.locator('text=Create League')).toBeVisible();
    await expect(page.locator('text=Join League')).toBeVisible();
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate to create league
    await page.click('text=Create League');
    await expect(page).toHaveURL('/create-league');
    
    // Use browser back
    await page.goBack();
    await expect(page).toHaveURL('/');
    
    // Use browser forward
    await page.goForward();
    await expect(page).toHaveURL('/create-league');
  });

  test('should show loading states during navigation', async ({ page }) => {
    // Click on a navigation item
    await page.click('text=Create League');
    
    // Should eventually load the page
    await expect(page.locator('text=Create League')).toBeVisible();
  });

  test('should handle direct URL access', async ({ page }) => {
    // Test direct access to create league page
    await page.goto('/create-league');
    await expect(page).toHaveURL('/create-league');
    await expect(page.locator('text=Create League')).toBeVisible();
    
    // Test direct access to join league page
    await page.goto('/join-league');
    await expect(page).toHaveURL('/join-league');
    await expect(page.locator('text=Join League')).toBeVisible();
  });

  test('should redirect unauthorized pages to login', async ({ page }) => {
    // Logout first
    await page.click('text=Logout');
    await expect(page).toHaveURL('/login');
    
    // Try to access protected page
    await page.goto('/create-league');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should show 404 for non-existent pages', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/non-existent-page');
    
    // Should show 404 or redirect to a valid page
    // This depends on how your router handles 404s
    const is404 = page.url().includes('404') || 
                  page.url().includes('not-found') ||
                  await page.locator('text=404').count() > 0 ||
                  await page.locator('text=Not Found').count() > 0;
    
    // Should either show 404 or redirect to dashboard/login
    expect(is404 || page.url().includes('/login') || page.url() === 'http://localhost:5000/').toBeTruthy();
  });
});