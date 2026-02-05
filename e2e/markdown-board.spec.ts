import { test, expect } from '@playwright/test';

test.describe('Markdown Board E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should persist data through create → edit → home → return workflow', async ({ page }) => {
    // Step 1: Create a new page
    await page.click('button:has-text("New Page")');
    await page.waitForURL(/\/page\/.+/);
    
    // Wait for editor to load
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    
    // Step 2: Edit the page with content by TYPING (not fill) to trigger proper markdown parsing
    const editor = page.locator('.milkdown').locator('div[contenteditable="true"]').first();
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
    
    // Extract the page ID from URL
    const url = page.url();
    const pageId = url.split('/page/')[1];
    
    // Step 3: Go back to home
    await page.click('button:has-text("← Back")');
    await page.waitForURL('/');
    await page.waitForTimeout(500);
    
    // Verify the page appears in the list with correct title (should be without #)
    const pageListItems = page.locator('h3').filter({ hasText: 'Test Page Title' });
    await expect(pageListItems.first()).toBeVisible();
    
    // Check that title does NOT contain # symbol
    const titleText = await pageListItems.first().textContent();
    expect(titleText).not.toContain('#');
    expect(titleText).toContain('Test Page Title');
    
    // Step 4: Return to the page
    await page.locator('button:has-text("Open")').first().click();
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
    await page.click('button:has-text("New Page")');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    
    const editor = page.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor.click();
    
    // Type content that will be escaped by Milkdown
    // When you type "a# hello" and delete "a", Milkdown keeps it as plain text "\# hello"
    await editor.type('a# hello');
    await editor.press('Home');
    await editor.press('Delete');
    
    // Wait for save
    await page.waitForTimeout(2000);
    
    // Go back to home
    await page.click('button:has-text("← Back")');
    await page.waitForURL('/');
    await page.waitForTimeout(500);
    
    // The title should be "# hello" (the literal text with hash symbol)
    // because Milkdown saved it as "\# hello" (escaped)
    const pageListItems = page.locator('h3').filter({ hasText: '# hello' });
    await expect(pageListItems.first()).toBeVisible();
    
    const titleText = await pageListItems.first().textContent();
    // Title should contain the # symbol because it's escaped text, not a heading
    expect(titleText).toContain('# hello');
  });

  test('should extract title from first line correctly', async ({ page }) => {
    // Test 1: Heading as first line (with #)
    await page.click('button:has-text("New Page")');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    
    const editor1 = page.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor1.click();
    // Type naturally to trigger markdown parsing
    await editor1.type('# My Heading Title');
    await editor1.press('Enter');
    await editor1.press('Enter');
    await editor1.type('Content below');
    
    await page.waitForTimeout(2000); // Wait for save
    
    await page.click('button:has-text("← Back")');
    await page.waitForURL('/');
    await page.waitForTimeout(500);
    
    // Title should be "My Heading Title" (without #)
    const title1 = page.locator('h3').filter({ hasText: 'My Heading Title' }).first();
    await expect(title1).toBeVisible();
    const title1Text = await title1.textContent();
    expect(title1Text).not.toContain('#');
    
    // Test 2: Regular text as first line
    await page.click('button:has-text("New Page")');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    
    const editor2 = page.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor2.click();
    await editor2.type('Plain text title');
    await editor2.press('Enter');
    await editor2.press('Enter');
    await editor2.type('More content');
    
    await page.waitForTimeout(2000); // Wait for save
    
    await page.click('button:has-text("← Back")');
    await page.waitForURL('/');
    await page.waitForTimeout(500);
    
    // Title should be "Plain text title"
    await expect(page.locator('h3').filter({ hasText: 'Plain text title' }).first()).toBeVisible();
    
    // Test 3: Multiple # in heading
    await page.click('button:has-text("New Page")');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    
    const editor3 = page.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor3.click();
    await editor3.type('### Level 3 Heading');
    await editor3.press('Enter');
    await editor3.press('Enter');
    await editor3.type('Content');
    
    await page.waitForTimeout(2000); // Wait for save
    
    await page.click('button:has-text("← Back")');
    await page.waitForURL('/');
    await page.waitForTimeout(500);
    
    // Title should be "Level 3 Heading" (without ###)
    const title3 = page.locator('h3').filter({ hasText: 'Level 3 Heading' }).first();
    await expect(title3).toBeVisible();
    const title3Text = await title3.textContent();
    expect(title3Text).not.toContain('#');
  });

  test('should synchronize data across multiple tabs in real-time', async ({ browser }) => {
    // Create a new page in the first tab
    const context = await browser.newContext();
    const page1 = await context.newPage();
    
    // Enable console logging for debugging
    page1.on('console', msg => console.log('Page1:', msg.text()));
    
    await page1.goto('/');
    await page1.waitForLoadState('networkidle');
    
    // Create new page in Tab A
    await page1.click('button:has-text("New Page")');
    await page1.waitForURL(/\/page\/.+/);
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/page/')[1];
    
    console.log(`Testing sync for page: ${pageId}`);
    
    await page1.waitForSelector('.milkdown', { timeout: 10000 });
    await page1.waitForTimeout(1000);
    
    // Open the same page in Tab B BEFORE editing in Tab A
    const page2 = await context.newPage();
    
    // Enable console logging for debugging
    page2.on('console', msg => console.log('Page2:', msg.text()));
    
    await page2.goto(pageUrl);
    await page2.waitForLoadState('networkidle');
    await page2.waitForSelector('.milkdown', { timeout: 10000 });
    await page2.waitForTimeout(2000);
    
    console.log('Both tabs opened, now editing in Tab A');
    
    // NOW edit in Tab A (first tab) - use .type() not .fill()
    const editor1 = page1.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor1.click();
    await editor1.type('# Shared Document');
    await editor1.press('Enter');
    await editor1.press('Enter');
    await editor1.type('Content from Tab A');
    
    console.log('Content typed in Tab A, waiting for sync...');
    
    // Wait for WebSocket sync (should be real-time, not requiring save)
    await page1.waitForTimeout(3000);
    
    // Verify content appears in Tab B WITHOUT reload
    const editorArea2 = page2.locator('.milkdown .ProseMirror').first();
    
    try {
      await expect(editorArea2).toContainText('Shared Document', { timeout: 5000 });
      await expect(editorArea2).toContainText('Content from Tab A', { timeout: 5000 });
      console.log('SUCCESS: Content synchronized to Tab B in real-time');
    } catch (error) {
      console.error('FAILED: Content did not sync to Tab B');
      const content = await editorArea2.textContent();
      console.log('Tab B content:', content);
      throw error;
    }
    
    await context.close();
  });
});
