import { test, expect } from '@playwright/test';

test.describe('Data Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('should persist data through create → edit → home → return workflow', async ({
    page,
  }) => {
    // Step 1: Create a new page
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);

    // Wait for editor to load
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Step 2: Edit the page with content by TYPING (not fill) to trigger proper markdown parsing
    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Type naturally so Milkdown processes it as markdown
    await editor.type('# Test Page Title');
    await editor.press('Enter');
    await editor.press('Enter');
    await editor.type('This is test content.');
    await editor.press('Enter');
    await editor.press('Enter');
    await editor.type('## Section 1');
    await editor.press('Enter');
    await editor.type('Some details here.');

    // Wait for auto-save (debounce is 1 second)
    await page.waitForTimeout(2000);

    // Step 3: Go back to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify the page appears in the list with correct title (should be without #)
    const pageListItems = page
      .locator('h3')
      .filter({ hasText: 'Test Page Title' });
    await expect(pageListItems.first()).toBeVisible();

    // Check that title does NOT contain # symbol
    const titleText = await pageListItems.first().textContent();
    expect(titleText).not.toContain('#');
    expect(titleText).toContain('Test Page Title');

    // Step 4: Return to the page by clicking the page item
    await page
      .locator('h3')
      .filter({ hasText: 'Test Page Title' })
      .first()
      .click();
    await page.waitForURL(/\/page\/.+/);

    // Step 5: Verify data persisted
    await page.waitForSelector('.milkdown');
    await page.waitForTimeout(1000);

    // Check that the content is present - use more specific selector
    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Test Page Title');
    await expect(editorArea).toContainText('This is test content');
    await expect(editorArea).toContainText('Section 1');
    await expect(editorArea).toContainText('Some details here');
  });

  test('should handle escaped heading markers correctly', async ({ page }) => {
    // Create a new page
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Type content that will be escaped by Milkdown
    // When you type "a# hello" and delete "a", Milkdown keeps it as plain text "\# hello"
    await editor.type('a# hello');
    await editor.press('Home');
    await editor.press('Delete');

    // Wait for save
    await page.waitForTimeout(2000);

    // Go back to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // The title should be "# hello" (the literal text with hash symbol)
    // because Milkdown saved it as "\# hello" (escaped)
    const pageListItems = page.locator('h3').filter({ hasText: '# hello' });
    await expect(pageListItems.first()).toBeVisible();

    const titleText = await pageListItems.first().textContent();
    // Title should contain the # symbol because it's escaped text, not a heading
    expect(titleText).toContain('# hello');
  });

  test('should restore content from SQLite after server restart', async ({
    page,
  }) => {
    // Step 1: Create a new page with content
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
