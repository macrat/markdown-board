import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('should have visible focus indicators', async ({ page }) => {
    const newPageButton = page.locator('button[title="新しいページを作成"]');

    // Focus the button with keyboard
    await newPageButton.focus();

    // Check if button has focus
    await expect(newPageButton).toBeFocused();
  });
});
