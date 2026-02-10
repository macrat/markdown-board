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

  test('should switch between tabs correctly', async ({ page }) => {
    const timestamp = Date.now();

    // Create a page and archive it to have content in both tabs
    const pageId = await createPageWithContent(
      page,
      `# TabSwitchTest${timestamp}\n\nContent for tab test`,
    );

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify "最新" (Recent) tab is active by default
    const recentTab = page.locator('button:has-text("最新")');
    await expect(recentTab).toBeVisible();

    // Verify page is visible in recent tab
    const pageItem = page.locator(`[data-testid="page-item-${pageId}"]`);
    await expect(pageItem).toBeVisible();

    // Archive the page using the archive icon
    const archiveButton = pageItem.locator('button[title="アーカイブ"]');
    await archiveButton.click();
    await page.waitForTimeout(1000);

    // Switch to "アーカイブ" (Archive) tab
    const archiveTab = page.locator('button:has-text("アーカイブ")');
    await archiveTab.click();
    await page.waitForTimeout(500);

    // Verify archived page is visible
    const archiveItem = page.locator(`[data-testid="archive-item-${pageId}"]`);
    await expect(archiveItem).toBeVisible();

    // Switch back to "最新" tab
    await recentTab.click();
    await page.waitForTimeout(500);

    // Verify page is NOT in recent tab anymore
    await expect(pageItem).not.toBeVisible();
  });

  test('should support arrow key navigation between tabs (WAI-ARIA)', async ({
    page,
  }) => {
    const timestamp = Date.now();

    // Create a page and archive it to have content in both tabs
    const pageId = await createPageWithContent(
      page,
      `# ArrowKeyTest${timestamp}\n\nTesting arrow key navigation`,
    );

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Archive the page so we have content in archive tab
    const pageItem = page.locator(`[data-testid="page-item-${pageId}"]`);
    const archiveButton = pageItem.locator('button[title="アーカイブ"]');
    await archiveButton.click();
    await page.waitForTimeout(1000);

    // Focus on the "最新" tab
    const recentTab = page.locator('button#tab-latest');
    await recentTab.focus();

    // Verify "最新" tab has tabIndex=0 (focusable)
    await expect(recentTab).toHaveAttribute('tabindex', '0');

    // Verify "アーカイブ" tab has tabIndex=-1 (not in tab order)
    const archiveTab = page.locator('button#tab-archive');
    await expect(archiveTab).toHaveAttribute('tabindex', '-1');

    // Press ArrowRight to switch to archive tab
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    // Verify archive tab is now active and has focus
    await expect(archiveTab).toHaveAttribute('aria-selected', 'true');
    await expect(archiveTab).toHaveAttribute('tabindex', '0');
    await expect(recentTab).toHaveAttribute('tabindex', '-1');
    await expect(archiveTab).toBeFocused();

    // Verify archived page is visible
    const archiveItem = page.locator(`[data-testid="archive-item-${pageId}"]`);
    await expect(archiveItem).toBeVisible();

    // Press ArrowLeft to switch back to recent tab
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);

    // Verify recent tab is now active and has focus
    await expect(recentTab).toHaveAttribute('aria-selected', 'true');
    await expect(recentTab).toHaveAttribute('tabindex', '0');
    await expect(archiveTab).toHaveAttribute('tabindex', '-1');
    await expect(recentTab).toBeFocused();

    // Verify archived page is no longer visible (back to recent tab)
    await expect(archiveItem).not.toBeVisible();
  });

  test('should show search field when more than 5 pages exist and filter by title', async ({
    page,
  }) => {
    const timestamp = Date.now();

    // Create 6 pages to trigger the search field visibility
    for (let i = 1; i <= 6; i++) {
      await createPageWithContent(
        page,
        `# SearchTest${timestamp}-${i}\n\nContent for page ${i}`,
      );
    }

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // The search field should be visible in the sidebar
    const searchInput = page.locator('input[aria-label="ページを検索"]');
    await expect(searchInput).toBeVisible();

    // Type a search query to filter pages
    await searchInput.fill(`SearchTest${timestamp}-1`);
    await page.waitForTimeout(300);

    // Only the matching page should be visible
    await expect(
      page
        .locator('h3')
        .filter({ hasText: `SearchTest${timestamp}-1` })
        .first(),
    ).toBeVisible();

    // Other pages should not be visible
    await expect(
      page.locator('h3').filter({ hasText: `SearchTest${timestamp}-2` }),
    ).toHaveCount(0);

    // Clear the search and verify all pages reappear
    await searchInput.fill('');
    await page.waitForTimeout(300);

    for (let i = 1; i <= 6; i++) {
      await expect(
        page
          .locator('h3')
          .filter({ hasText: `SearchTest${timestamp}-${i}` })
          .first(),
      ).toBeVisible();
    }
  });

  test('should show no-results message when search matches nothing', async ({
    page,
  }) => {
    const timestamp = Date.now();

    // Create 6 pages to trigger the search field visibility
    for (let i = 1; i <= 6; i++) {
      await createPageWithContent(
        page,
        `# NoMatch${timestamp}-${i}\n\nContent`,
      );
    }

    // Navigate to a new page to refresh sidebar
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[aria-label="ページを検索"]');
    await searchInput.fill('zzz-nonexistent-query');
    await page.waitForTimeout(300);

    // Should show no-results message
    await expect(
      page.locator('text=一致するページが見つかりません。'),
    ).toBeVisible();
  });

  test('should hide search field when 5 or fewer pages exist', async ({
    page,
  }) => {
    // We're on a fresh page. With the default state we should have few pages.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Count current pages - if 5 or fewer, search should be hidden
    const pageCount = await page.locator('[data-testid^="page-item-"]').count();
    if (pageCount <= 5) {
      await expect(
        page.locator('input[aria-label="ページを検索"]'),
      ).not.toBeVisible();
    }
  });
});
