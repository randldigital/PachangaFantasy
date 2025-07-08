import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await expect(page).toHaveURL('/login');
  });

  test('should allow user registration with valid data', async ({ page }) => {
    await page.goto('/register');
    
    // Fill registration form
    await page.fill('input[type="text"]', 'testuser123');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Select role
    await page.click('[role="combobox"]');
    await page.click('text=Player');
    
    // Submit registration
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=testuser123')).toBeVisible();
  });

  test('should show validation errors for invalid registration', async ({ page }) => {
    await page.goto('/register');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=Required')).toBeVisible();
  });

  test('should allow login with valid credentials', async ({ page }) => {
    // First register a user
    await page.goto('/register');
    await page.fill('input[type="text"]', 'loginuser');
    await page.fill('input[type="email"]', 'login@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Player');
    await page.click('button[type="submit"]');
    
    // Logout
    await page.click('text=Logout');
    
    // Now test login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'login@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=loginuser')).toBeVisible();
  });

  test('should show error for invalid login credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should navigate between login and register pages', async ({ page }) => {
    await page.goto('/login');
    
    // Click register link
    await page.click('text=Register');
    await expect(page).toHaveURL('/register');
    
    // Click login link
    await page.click('text=Login');
    await expect(page).toHaveURL('/login');
  });
});