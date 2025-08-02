import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should register a new user', async ({ page }) => {
    // Navigate to register page
    await page.click('text=Register');
    
    // Fill registration form
    await page.fill('[data-testid="name-input"]', 'Test User');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.fill('[data-testid="confirm-password-input"]', 'testpassword123');
    
    // Submit form
    await page.click('[data-testid="register-button"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-name"]')).toContainText('Test User');
  });

  test('should login existing user', async ({ page }) => {
    // Navigate to login page
    await page.click('text=Login');
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    
    // Submit form
    await page.click('[data-testid="login-button"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
  });

  test('should handle login errors', async ({ page }) => {
    await page.click('text=Login');
    
    // Try invalid credentials
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid email or password');
  });

  test('should logout user', async ({ page }) => {
    // Login first
    await page.click('text=Login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');
    
    // Should redirect to home
    await expect(page).toHaveURL('/');
  });

  test('should update user profile', async ({ page }) => {
    // Login first
    await page.click('text=Login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to profile
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Profile');
    
    // Update profile
    await page.fill('[data-testid="name-input"]', 'Updated Test User');
    await page.click('[data-testid="save-profile-button"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="name-input"]')).toHaveValue('Updated Test User');
  });

  test('should change password', async ({ page }) => {
    // Login first
    await page.click('text=Login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to profile
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Profile');
    
    // Change password
    await page.click('text=Change Password');
    await page.fill('[data-testid="current-password-input"]', 'testpassword123');
    await page.fill('[data-testid="new-password-input"]', 'newpassword123');
    await page.fill('[data-testid="confirm-new-password-input"]', 'newpassword123');
    await page.click('[data-testid="change-password-button"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});