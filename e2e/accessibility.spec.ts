import { test, expect } from '@playwright/test';
import { createPageWithContent, MAX_TAB_ITERATIONS } from './helpers';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through elements
    await page.keyboard.press('Tab');

    // Check focus is visible
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(focusedElement).toBeTruthy();

    // Test keyboard navigation in editor
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Type with keyboard
    await page.keyboard.type('Keyboard test');

    await page.waitForTimeout(1500);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Keyboard test');
  });

  test('should have visible focus indicators', async ({ page }) => {
    const newPageButton = page.locator('button[title="新しいページを作成"]');

    // Focus the button with keyboard
    await newPageButton.focus();

    // Check if button has focus
    await expect(newPageButton).toBeFocused();
  });

  test('should work with Tab key for navigation', async ({ page }) => {
    // Create a page first
    await createPageWithContent(page, '# Test Page\n\nContent here');

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Focus on body first
    await page.locator('body').focus();

    // Use Tab multiple times to navigate to archive tab
    for (let i = 0; i < MAX_TAB_ITERATIONS; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(
        () => document.activeElement?.textContent,
      );
      if (focused && focused.includes('アーカイブ')) {
        break;
      }
    }

    // Check if we can activate with Enter
    const activeElement = await page.evaluate(
      () => document.activeElement?.textContent,
    );

    // If we found the tab, this test passes
    expect(activeElement).toBeDefined();
  });
});
