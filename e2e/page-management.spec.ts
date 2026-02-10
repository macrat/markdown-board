import { test, expect } from '@playwright/test';

test.describe('Page Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
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
});
