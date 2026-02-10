import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('should handle special characters correctly', async ({ page }) => {
    const specialContent = `# Special Characters Test

Special chars: !@#$%^&*()_+-={}[]|\\:";'<>?,./
Math symbols: ∑∏∫∂∞≈≠≤≥±×÷
Arrows: ←→↑↓↔↕⇐⇒⇑⇓
Currency: $€£¥₹₽`;

    await createPageWithContent(page, specialContent);

    // Go back and return
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click on the page item to navigate
    await page
      .locator('h3')
      .filter({ hasText: 'Special Characters Test' })
      .first()
      .click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText(
      'Special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./',
    );
    await expect(editorArea).toContainText('∑∏∫∂∞≈≠≤≥±×÷');
    await expect(editorArea).toContainText('←→↑↓↔↕⇐⇒⇑⇓');
  });

  test('should handle unicode characters (emoji, international)', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const unicodeContent = `# Unicode Test ${timestamp} 🌍

Emoji: 😀😃😄😁🎉🎊🎈🎁
Japanese: こんにちは世界
Arabic: مرحبا بالعالم
Hebrew: שלום עולם
Chinese: 你好世界
Russian: Привет мир`;

    await createPageWithContent(page, unicodeContent);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify title includes emoji and timestamp - use first() for strict mode
    await expect(
      page.locator('h3').filter({ hasText: '🌍' }).first(),
    ).toBeVisible();

    // Click on the page item to navigate
    await page.locator('h3').filter({ hasText: '🌍' }).first().click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('😀😃😄😁🎉🎊🎈🎁');
    await expect(editorArea).toContainText('こんにちは世界');
    await expect(editorArea).toContainText('مرحبا بالعالم');
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

  test('should handle markdown with HTML-like tags in text', async ({
    page,
  }) => {
    const content = `# HTML Tags Test

Text with <div> and <script> tags should be escaped
Also test <img> and <a> tags`;

    await createPageWithContent(page, content);

    await page.waitForTimeout(1000);
    const editorArea = page.locator('.milkdown .ProseMirror').first();

    // Content should be present as text, not rendered as HTML
    await expect(editorArea).toContainText('<div>');
    await expect(editorArea).toContainText('<script>');
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
