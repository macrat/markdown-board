import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Data Persistence', () => {
  test('should restore content from SQLite after server restart', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();
    await editor.type('# Restart Test');
    await editor.press('Enter');
    await editor.press('Enter');
    await editor.type('This content should survive server restart');
    await editor.press('Enter');
    await editor.type('Second line of content');

    // Wait for auto-save
    await page.waitForTimeout(2500);

    // Clear local cache and hard reload to simulate server restart
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Restart Test', { timeout: 5000 });
    await expect(editorArea).toContainText(
      'This content should survive server restart',
      { timeout: 5000 },
    );
    await expect(editorArea).toContainText('Second line of content', {
      timeout: 5000,
    });

    const pageTitle = page.locator('h1').first();
    await expect(pageTitle).toContainText('Restart Test');
  });

  test('should handle rapid navigation without data loss', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await createPageWithContent(page, '# Rapid Test\n\nContent to preserve');

    // Rapidly navigate back and forth
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await page.locator('h3').filter({ hasText: 'Rapid Test' }).first().click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForTimeout(300);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await page.locator('h3').filter({ hasText: 'Rapid Test' }).first().click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Content to preserve');
  });
});
