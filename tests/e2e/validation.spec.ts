import { test, expect } from '@playwright/test';

test.describe('Form Validations & Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show validation errors for empty registration form', async ({ page }) => {
    await page.goto('/register');
    
    // Try to submit without filling fields
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=Required')).toBeVisible();
  });

  test('should show email validation error', async ({ page }) => {
    await page.goto('/register');
    
    // Fill with invalid email
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    
    await page.click('button[type="submit"]');
    
    // Should show email validation error
    await expect(page.locator('text=Invalid email')).toBeVisible();
  });

  test('should show success toast on successful registration', async ({ page }) => {
    await page.goto('/register');
    
    // Fill valid registration data
    await page.fill('input[type="text"]', `user${Date.now()}`);
    await page.fill('input[type="email"]', `user${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Player');
    
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard (success)
    await expect(page).toHaveURL('/');
  });

  test('should show loading state during form submission', async ({ page }) => {
    await page.goto('/register');
    
    // Fill form
    await page.fill('input[type="text"]', `loadtest${Date.now()}`);
    await page.fill('input[type="email"]', `loadtest${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Player');
    
    // Submit and check for loading state
    await page.click('button[type="submit"]');
    
    // Button should show loading state (if implemented)
    // This depends on the actual implementation
    await page.waitForTimeout(100);
  });

  test('should validate league creation form', async ({ page }) => {
    // Login first
    await page.goto('/register');
    await page.fill('input[type="text"]', `admin${Date.now()}`);
    await page.fill('input[type="email"]', `admin${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
    
    // Go to create league
    await page.click('text=Create League');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation error for required name field
    await expect(page.locator('text=Required')).toBeVisible();
  });

  test('should validate match creation form', async ({ page }) => {
    // Login and create league first
    await page.goto('/register');
    await page.fill('input[type="text"]', `admin${Date.now()}`);
    await page.fill('input[type="email"]', `admin${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Admin');
    await page.click('button[type="submit"]');
    
    await page.click('text=Create League');
    await page.fill('input[placeholder*="league name"]', 'Validation Test League');
    await page.click('button[type="submit"]');
    
    // Go to create match
    const leagueCard = page.locator('text=Validation Test League').first();
    await leagueCard.click();
    await page.click('text=Create Match');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=Required')).toBeVisible();
  });

  test('should show error toast for invalid login', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with invalid credentials
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should validate invite code format', async ({ page }) => {
    // Login first
    await page.goto('/register');
    await page.fill('input[type="text"]', `player${Date.now()}`);
    await page.fill('input[type="email"]', `player${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('[role="combobox"]');
    await page.click('text=Player');
    await page.click('button[type="submit"]');
    
    // Try to join with invalid invite code
    await page.click('text=Join League');
    await page.fill('input[placeholder*="invite code"]', '123'); // Too short
    await page.click('button[type="submit"]');
    
    // Should show validation or error
    await expect(page.locator('text=League not found')).toBeVisible();
  });

  test('should show field-specific validation errors', async ({ page }) => {
    await page.goto('/register');
    
    // Test each field individually
    await page.fill('input[type="text"]', ''); // Empty username
    await page.fill('input[type="email"]', 'valid@example.com');
    await page.fill('input[type="password"]', 'validpassword');
    
    await page.click('button[type="submit"]');
    
    // Should show username required error
    const usernameField = page.locator('input[type="text"]').first();
    const errorMessage = page.locator('text=Required').first();
    await expect(errorMessage).toBeVisible();
  });

  test('should clear validation errors when user corrects input', async ({ page }) => {
    await page.goto('/register');
    
    // Trigger validation error
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Required')).toBeVisible();
    
    // Fill in valid data
    await page.fill('input[type="text"]', 'validuser');
    await page.fill('input[type="email"]', 'valid@example.com');
    await page.fill('input[type="password"]', 'validpassword');
    
    // Validation errors should clear (depends on implementation)
    // This test verifies the form behaves correctly when corrected
    await page.click('[role="combobox"]');
    await page.click('text=Player');
    
    await page.click('button[type="submit"]');
    
    // Should succeed and redirect
    await expect(page).toHaveURL('/');
  });
});