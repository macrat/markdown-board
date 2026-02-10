import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Responsive Layout', () => {
  test('should handle very long lines without breaking layout', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const longLine = 'a'.repeat(1000);
    const content = `# Long Line Test\n\n${longLine}`;

    await createPageWithContent(page, content);

    await page.waitForTimeout(1000);

    const hasHorizontalScroll = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toBeVisible();
    await expect(
      page.locator('button[title="新しいページを作成"]'),
    ).toBeVisible();
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toBeVisible();
    await expect(
      page.locator('button[title="新しいページを作成"]'),
    ).toBeVisible();
  });
});
