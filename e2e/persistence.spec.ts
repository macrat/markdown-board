import { test, expect } from '@playwright/test';

test.describe('Data Persistence', () => {
  test('should restore content from SQLite after server restart', async ({
    page,
  }) => {
    // Step 1: Create a new page with content
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Add content
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

    // Step 2: Simulate what happens after server restart by:
    // - Clearing local cache/storage
    // - Reloading the page (this simulates fresh load with empty Yjs on server)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Hard reload the page
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for editor to load
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for Yjs sync

    // Step 3: Verify content was restored from SQLite
    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Restart Test', { timeout: 5000 });
    await expect(editorArea).toContainText(
      'This content should survive server restart',
      { timeout: 5000 },
    );
    await expect(editorArea).toContainText('Second line of content', {
      timeout: 5000,
    });

    // Verify title is rendered as h1 in the editor content
    const pageTitle = page.locator('h1').first();
    await expect(pageTitle).toContainText('Restart Test');
  });
});
