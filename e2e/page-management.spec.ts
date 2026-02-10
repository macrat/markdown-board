import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Page Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('should handle empty page creation correctly', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Don't add any content, just go back
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Should show "Untitled" for empty pages - check count instead of visibility
    const untitledCount = await page
      .locator('h3')
      .filter({ hasText: 'Untitled' })
      .count();
    expect(untitledCount).toBeGreaterThan(0);
  });

  test('should handle page with only whitespace', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();
    await editor.type('   ');
    await page.waitForTimeout(2000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Should show "Untitled" for whitespace-only pages (use first() to handle multiple Untitled pages)
    await expect(
      page.locator('h3').filter({ hasText: 'Untitled' }).first(),
    ).toBeVisible();
  });

  test('should handle very long content without performance issues', async ({
    page,
  }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Create long content with multiple headings and paragraphs
    await editor.type('# Stress Test Document');
    await editor.press('Enter');
    await editor.press('Enter');

    // Add multiple sections programmatically
    for (let i = 1; i <= 10; i++) {
      await editor.type(`## Section ${i}`);
      await editor.press('Enter');
      await editor.press('Enter');
      await editor.type(
        `This is paragraph 1 of section ${i} with some text content that should be saved properly.`,
      );
      await editor.press('Enter');
      await editor.press('Enter');
      await editor.type(
        `This is paragraph 2 of section ${i} with more text content.`,
      );
      await editor.press('Enter');
      await editor.press('Enter');
    }

    await page.waitForTimeout(2500);

    // Verify content persists
    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Stress Test Document');
    await expect(editorArea).toContainText('Section 1');
    await expect(editorArea).toContainText('Section 10');
  });

  test('should handle creating multiple pages', async ({ page }) => {
    const pageCount = 3;
    const pageIds: string[] = [];
    const timestamp = Date.now();

    for (let i = 1; i <= pageCount; i++) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const pageId = await createPageWithContent(
        page,
        `# MultiPage ${timestamp}-${i}\n\nContent for page ${i}`,
      );
      pageIds.push(pageId);

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    // Verify all pages are listed - check by count
    for (let i = 1; i <= pageCount; i++) {
      const pageExists = await page
        .locator('h3')
        .filter({ hasText: `MultiPage ${timestamp}-${i}` })
        .count();
      expect(pageExists).toBeGreaterThan(0);
    }
  });

  test('should navigate between multiple pages seamlessly', async ({
    page,
  }) => {
    const timestamp = Date.now();
    // Create first page
    await createPageWithContent(
      page,
      `# First Page ${timestamp}\n\nContent of first page`,
    );
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Create second page
    await createPageWithContent(
      page,
      `# Second Page ${timestamp}\n\nContent of second page`,
    );
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Navigate to first page
    await page
      .locator('h3')
      .filter({ hasText: `First Page ${timestamp}` })
      .click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    let editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Content of first page');

    // Go back and navigate to second page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page
      .locator('h3')
      .filter({ hasText: `Second Page ${timestamp}` })
      .click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Content of second page');
  });
});
