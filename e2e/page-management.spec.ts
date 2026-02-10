import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Page Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('should handle empty page creation correctly', async ({ page }) => {
    // We're already on a new page. Don't add any content.
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
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
    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();
    await editor.type('   ');
    await page.waitForTimeout(2000);

    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Should show "Untitled" for whitespace-only pages
    await expect(
      page.locator('h3').filter({ hasText: 'Untitled' }).first(),
    ).toBeVisible();
  });

  test('should handle very long content without performance issues', async ({
    page,
  }) => {
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
      const pageId = await createPageWithContent(
        page,
        `# MultiPage ${timestamp}-${i}\n\nContent for page ${i}`,
      );
      pageIds.push(pageId);
    }

    // Navigate to new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify all pages are listed in sidebar
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

    // Create second page
    await createPageWithContent(
      page,
      `# Second Page ${timestamp}\n\nContent of second page`,
    );

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Navigate to first page via sidebar
    await page
      .locator('h3')
      .filter({ hasText: `First Page ${timestamp}` })
      .click();
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    let editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Content of first page');

    // Navigate to second page via sidebar
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

  test('should create new page via sidebar create button', async ({ page }) => {
    // Click the create button in the sidebar
    const createButton = page.locator('button[title="新しいページを作成"]');
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Wait for navigation to new page
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Verify editor is ready
    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await expect(editor).toBeVisible();

    // Add some content
    await editor.click();
    await editor.type('# Create Button Page');
    await page.waitForTimeout(2000);

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify page appears in the sidebar list
    await expect(
      page.locator('h3').filter({ hasText: 'Create Button Page' }).first(),
    ).toBeVisible();
  });

  test('should archive and unarchive pages', async ({ page }) => {
    const timestamp = Date.now();

    // Create a page
    const pageId = await createPageWithContent(
      page,
      `# ArchiveUnarchiveTest${timestamp}\n\nContent to archive`,
    );

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify page is in recent list
    const pageItem = page.locator(`[data-testid="page-item-${pageId}"]`);
    await expect(pageItem).toBeVisible();

    // Click archive icon on the page item
    const archiveButton = pageItem.locator('button[title="アーカイブ"]');
    await archiveButton.click();
    await page.waitForTimeout(1000);

    // Verify page disappeared from recent list
    await expect(pageItem).not.toBeVisible();

    // Switch to archive tab
    const archiveTab = page.locator('button:has-text("アーカイブ")');
    await archiveTab.click();
    await page.waitForTimeout(500);

    // Verify page is in archive list
    const archiveItem = page.locator(`[data-testid="archive-item-${pageId}"]`);
    await expect(archiveItem).toBeVisible();

    // Click unarchive icon
    const unarchiveButton = archiveItem.locator(
      'button[title="アーカイブを解除"]',
    );
    await unarchiveButton.click();
    await page.waitForTimeout(1000);

    // Verify page disappeared from archive list
    await expect(archiveItem).not.toBeVisible();

    // Switch back to recent tab
    const recentTab = page.locator('button:has-text("最新")');
    await recentTab.click();
    await page.waitForTimeout(500);

    // Verify page is back in recent list
    await expect(pageItem).toBeVisible();
  });

  test('should show toast notification on archive and cancel it', async ({
    page,
  }) => {
    const timestamp = Date.now();

    // Create a page
    const pageId = await createPageWithContent(
      page,
      `# ToastTest${timestamp}\n\nContent for toast test`,
    );

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify page is in recent list
    const pageItem = page.locator(`[data-testid="page-item-${pageId}"]`);
    await expect(pageItem).toBeVisible();

    // Click archive icon
    const archiveButton = pageItem.locator('button[title="アーカイブ"]');
    await archiveButton.click();

    // Verify toast notification appears
    const toast = page.locator('text=アーカイブしました');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Click cancel button on the toast
    const cancelButton = page.locator('button:has-text("キャンセル")');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await page.waitForTimeout(1000);

    // Verify page is back in recent list (archive was cancelled)
    await expect(pageItem).toBeVisible();
  });
});
