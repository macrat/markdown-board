import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('should handle rapid navigation without data loss', async ({ page }) => {
    await createPageWithContent(page, '# Rapid Test\n\nContent to preserve');

    // Rapidly navigate back and forth
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // Click on the page item to navigate
    await page.locator('h3').filter({ hasText: 'Rapid Test' }).first().click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForTimeout(300);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // Click on the page item again
    await page.locator('h3').filter({ hasText: 'Rapid Test' }).first().click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify content is still there
    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Content to preserve');
  });

  test('should handle very long lines without breaking layout', async ({
    page,
  }) => {
    const longLine = 'a'.repeat(1000);
    const content = `# Long Line Test\n\n${longLine}`;

    await createPageWithContent(page, content);

    await page.waitForTimeout(1000);

    // Check that the page doesn't have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });

    // Long text should wrap, not cause horizontal scroll
    expect(hasHorizontalScroll).toBe(false);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if main elements are visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(
      page.locator('button[title="新しいページを作成"]'),
    ).toBeVisible();
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toBeVisible();
    await expect(
      page.locator('button[title="新しいページを作成"]'),
    ).toBeVisible();
  });
});
