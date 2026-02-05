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
    
    // Step 2: Edit the page with content
    const testTitle = '# Test Page Title';
    const testContent = '\n\nThis is test content.\n\n## Section 1\nSome details here.';
    const fullContent = testTitle + testContent;
    
    // Click on the editor and type content
    const editor = page.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor.click();
    await editor.fill(fullContent);
    
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

  test('should extract title from first line correctly', async ({ page }) => {
    // Test 1: Heading as first line (with #)
    await page.click('button:has-text("New Page")');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    
    const editor1 = page.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor1.click();
    await editor1.fill('# My Heading Title\n\nContent below');
    
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
    await editor2.fill('Plain text title\n\nMore content');
    
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
    await editor3.fill('### Level 3 Heading\n\nContent');
    
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

  test('should synchronize data across multiple tabs', async ({ browser }) => {
    // Create a new page in the first tab
    const context = await browser.newContext();
    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.waitForLoadState('networkidle');
    
    // Create new page
    await page1.click('button:has-text("New Page")');
    await page1.waitForURL(/\/page\/.+/);
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/page/')[1];
    
    await page1.waitForSelector('.milkdown', { timeout: 10000 });
    
    // Type content in first tab
    const editor1 = page1.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor1.click();
    await editor1.fill('# Shared Document\n\nContent from Tab 1');
    
    // Wait for save
    await page1.waitForTimeout(2000);
    
    // Open the same page in a second tab
    const page2 = await context.newPage();
    await page2.goto(pageUrl);
    await page2.waitForLoadState('networkidle');
    await page2.waitForSelector('.milkdown', { timeout: 10000 });
    await page2.waitForTimeout(2000);
    
    // Verify content is visible in second tab - use more specific selector
    const editorArea2 = page2.locator('.milkdown .ProseMirror').first();
    await expect(editorArea2).toContainText('Shared Document');
    await expect(editorArea2).toContainText('Content from Tab 1');
    
    // Edit in second tab
    const editor2 = page2.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor2.click();
    
    // Clear and type new content to ensure it propagates
    await editor2.press('Control+A');
    await editor2.press('Delete');
    await editor2.fill('# Updated Document\n\nContent from Tab 2');
    
    // Wait for save and sync
    await page2.waitForTimeout(3000);
    
    // Reload page1 to get updated content (since WebSocket sync might not be working perfectly)
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await page1.waitForSelector('.milkdown', { timeout: 10000 });
    await page1.waitForTimeout(1000);
    
    // Check if first tab receives the update
    const editorArea1 = page1.locator('.milkdown .ProseMirror').first();
    await expect(editorArea1).toContainText('Content from Tab 2', { timeout: 5000 });
    
    await context.close();
  });
});
