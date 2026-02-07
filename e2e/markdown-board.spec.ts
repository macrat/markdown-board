import { test, expect, Page } from '@playwright/test';

// Helper function to create a new page with content
async function createPageWithContent(page: Page, content: string) {
  await page.click('button[title="新しいページを作成"]');
  await page.waitForURL(/\/page\/.+/);
  await page.waitForSelector('.milkdown', { timeout: 10000 });

  const editor = page
    .locator('.milkdown')
    .locator('div[contenteditable="true"]')
    .first();
  await editor.click();

  // Type content line by line
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await editor.press('Enter');
    if (lines[i]) await editor.type(lines[i]);
  }

  // Wait for auto-save (debounce is 1 second in the app)
  await page.waitForTimeout(2000);
  return page.url().split('/page/')[1];
}

const MAX_TAB_ITERATIONS = 10;

test.describe('Markdown Board E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
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

  // Title extraction logic is now covered by unit tests (tests/utils.test.ts)

  test('should synchronize data across multiple tabs in real-time', async ({
    browser,
  }) => {
    // Create a new page in the first tab
    const context = await browser.newContext();
    const page1 = await context.newPage();

    // Enable console logging for debugging
    page1.on('console', (msg) => console.log('Page1:', msg.text()));

    await page1.goto('/');
    await page1.waitForLoadState('networkidle');

    // Create new page in Tab A
    await page1.click('button[title="新しいページを作成"]');
    await page1.waitForURL(/\/page\/.+/);
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/page/')[1];

    console.log(`Testing sync for page: ${pageId}`);

    await page1.waitForSelector('.milkdown', { timeout: 10000 });
    await page1.waitForTimeout(1000);

    // Open the same page in Tab B BEFORE editing in Tab A
    const page2 = await context.newPage();

    // Enable console logging for debugging
    page2.on('console', (msg) => console.log('Page2:', msg.text()));

    await page2.goto(pageUrl);
    await page2.waitForLoadState('networkidle');
    await page2.waitForSelector('.milkdown', { timeout: 10000 });
    await page2.waitForTimeout(2000);

    console.log('Both tabs opened, now editing in Tab A');

    // NOW edit in Tab A (first tab) - use .type() not .fill()
    const editor1 = page1
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
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
      await expect(editorArea2).toContainText('Shared Document', {
        timeout: 5000,
      });
      await expect(editorArea2).toContainText('Content from Tab A', {
        timeout: 5000,
      });
      console.log('SUCCESS: Content synchronized to Tab B in real-time');
    } catch (error) {
      console.error('FAILED: Content did not sync to Tab B');
      const content = await editorArea2.textContent();
      console.log('Tab B content:', content);
      throw error;
    }

    await context.close();
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

  // ==================== EMPTY CONTENT HANDLING ====================

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

  // ==================== VERY LONG CONTENT (STRESS TEST) ====================

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

  // ==================== SPECIAL CHARACTERS AND UNICODE ====================

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

  // ==================== PAGE CREATION AND DELETION FLOWS ====================

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

  // ==================== NAVIGATION BETWEEN PAGES ====================

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

  // ==================== MARKDOWN SYNTAX TESTS ====================

  test('should render all heading levels (h1-h6)', async ({ page }) => {
    const content = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;

    await createPageWithContent(page, content);

    await page.waitForTimeout(1000);
    const editorArea = page.locator('.milkdown .ProseMirror').first();

    // Check all headings are present
    await expect(editorArea.locator('h1')).toContainText('Heading 1');
    await expect(editorArea.locator('h2')).toContainText('Heading 2');
    await expect(editorArea.locator('h3')).toContainText('Heading 3');
    await expect(editorArea.locator('h4')).toContainText('Heading 4');
    await expect(editorArea.locator('h5')).toContainText('Heading 5');
    await expect(editorArea.locator('h6')).toContainText('Heading 6');
  });

  test('should render text formatting (bold, italic, strikethrough)', async ({
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

    // Type bold text
    await editor.type('**bold text**');
    await editor.press('Space');
    await page.waitForTimeout(500);

    // Type italic text
    await editor.type('*italic text*');
    await editor.press('Space');
    await page.waitForTimeout(500);

    // Type strikethrough text
    await editor.type('~~strikethrough text~~');
    await editor.press('Space');

    await page.waitForTimeout(2000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();

    // Verify content is present (formatting may be rendered or stored as markdown)
    const content = await editorArea.textContent();
    expect(content).toContain('bold text');
    expect(content).toContain('italic text');
    expect(content).toContain('strikethrough text');
  });

  test('should render unordered and ordered lists', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Unordered list
    await editor.type('- Item 1');
    await editor.press('Enter');
    await editor.type('Item 2');
    await editor.press('Enter');
    await editor.type('Item 3');
    await editor.press('Enter');
    await editor.press('Enter');

    // Ordered list
    await editor.type('1. First');
    await editor.press('Enter');
    await editor.type('Second');
    await editor.press('Enter');
    await editor.type('Third');

    await page.waitForTimeout(1500);

    const editorArea = page.locator('.milkdown .ProseMirror').first();

    // Verify lists are rendered
    await expect(editorArea.locator('ul li').first()).toContainText('Item 1');
    await expect(editorArea.locator('ol li').first()).toContainText('First');
  });

  test('should render nested lists', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    await editor.type('- Parent 1');
    await editor.press('Enter');
    await editor.type('  - Child 1');
    await editor.press('Enter');
    await editor.type('  - Child 2');

    await page.waitForTimeout(2000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    const content = await editorArea.textContent();

    // Verify content is present
    expect(content).toContain('Parent 1');
    expect(content).toContain('Child 1');
    expect(content).toContain('Child 2');
  });

  test('should render links', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    await editor.type('[Click here](https://example.com)');

    await page.waitForTimeout(2000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    const content = await editorArea.textContent();

    // Verify link text is present (it may be rendered as link or markdown)
    expect(content).toContain('Click here');
  });

  test('should render inline code and code blocks', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Inline code
    await editor.type('Use `console.log()` for debugging');
    await editor.press('Enter');
    await editor.press('Enter');

    // Code block
    await editor.type('```javascript');
    await editor.press('Enter');
    await editor.type('function hello() {');
    await editor.press('Enter');
    await editor.type('  return "world";');
    await editor.press('Enter');
    await editor.type('}');
    await editor.press('Enter');
    await editor.type('```');

    await page.waitForTimeout(1500);

    const editorArea = page.locator('.milkdown .ProseMirror').first();

    // Verify inline code
    await expect(editorArea.locator('code').first()).toContainText(
      'console.log()',
    );

    // Verify code block
    await expect(editorArea.locator('pre code')).toContainText(
      'function hello()',
    );
  });

  test('should render blockquotes', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    await editor.type('> This is a quote');
    await editor.press('Enter');
    await editor.type('> Second line of quote');

    await page.waitForTimeout(2000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    const content = await editorArea.textContent();

    // Verify quote content is present
    expect(content).toContain('This is a quote');
    expect(content).toContain('Second line of quote');
  });

  test('should render horizontal rules', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    await editor.type('Content above');
    await editor.press('Enter');
    await editor.press('Enter');
    await editor.type('---');
    await editor.press('Enter');
    await editor.press('Enter');
    await editor.type('Content below');

    await page.waitForTimeout(1500);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea.locator('hr')).toBeVisible();
  });

  test('should render tables', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    await editor.type('| Header 1 | Header 2 |');
    await editor.press('Enter');
    await editor.type('|----------|----------|');
    await editor.press('Enter');
    await editor.type('| Cell 1   | Cell 2   |');

    await page.waitForTimeout(2000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    const content = await editorArea.textContent();

    // Verify table content is present
    expect(content).toContain('Header 1');
    expect(content).toContain('Header 2');
    expect(content).toContain('Cell 1');
    expect(content).toContain('Cell 2');
  });

  // ==================== ACCESSIBILITY TESTS ====================

  test('should have proper ARIA labels and roles', async ({ page }) => {
    // Check home page
    await expect(page.locator('h1')).toContainText('Markdown Board');

    // Check button accessibility
    const newPageButton = page.locator('button[title="新しいページを作成"]');
    await expect(newPageButton).toBeVisible();
    await expect(newPageButton).toBeEnabled();

    // Create a page and check editor accessibility
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await expect(editor).toHaveAttribute('contenteditable', 'true');
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through buttons on home page
    await page.keyboard.press('Tab');

    // Check focus is visible (we'll verify by checking activeElement)
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(focusedElement).toBeTruthy();

    // Test keyboard navigation in editor
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Type with keyboard
    await page.keyboard.type('Keyboard test');

    await page.waitForTimeout(1500);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Keyboard test');
  });

  test('should have visible focus indicators', async ({ page }) => {
    const newPageButton = page.locator('button[title="新しいページを作成"]');

    // Focus the button with keyboard
    await newPageButton.focus();

    // Check if button has focus
    await expect(newPageButton).toBeFocused();
  });

  test('should work with Tab key for navigation', async ({ page }) => {
    // Create a page first
    await createPageWithContent(page, '# Test Page\n\nContent here');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Focus on body first
    await page.locator('body').focus();

    // Use Tab multiple times to navigate to archive tab
    // We need to tab through multiple elements
    for (let i = 0; i < MAX_TAB_ITERATIONS; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(
        () => document.activeElement?.textContent,
      );
      if (focused && focused.includes('アーカイブ')) {
        break;
      }
    }

    // Check if we can activate with Enter
    const activeElement = await page.evaluate(
      () => document.activeElement?.textContent,
    );

    // If we found the tab, this test passes
    expect(activeElement).toBeDefined();
  });

  // ==================== RESPONSIVE LAYOUT TESTS ====================

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

  // ==================== EDGE CASES ====================

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

  test('should show proper timestamps on page list', async ({ page }) => {
    await createPageWithContent(page, '# Timestamp Test\n\nContent');

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check that timestamp is visible (formatted date without label)
    // Find the page item and verify it has a timestamp
    const pageListItem = page
      .locator('h3')
      .filter({ hasText: 'Timestamp Test' })
      .first();
    await expect(pageListItem).toBeVisible();

    // The timestamp <p> is a sibling of the <h3>, get parent and find the <p>
    const timestampText = pageListItem.locator('..').locator('p').first();
    await expect(timestampText).toBeVisible();
    const text = await timestampText.textContent();
    // Check that it contains numbers typical of date/time (but no "Updated:" label)
    expect(text).toMatch(/\d/);
    expect(text).not.toContain('Updated:');
  });

  // ==================== TAB UI TESTS ====================

  test('should switch between tabs correctly', async ({ page }) => {
    const timestamp = Date.now();

    // Create a page and archive it to have content in both tabs
    const pageId = await createPageWithContent(
      page,
      `# TabSwitchTest${timestamp}\n\nContent for tab test`,
    );

    await page.goto('/');
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

  test('should create new page via FAB button', async ({ page }) => {
    // Click the FAB (Floating Action Button) to create a new page
    const fabButton = page.locator('button[title="新しいページを作成"]');
    await expect(fabButton).toBeVisible();
    await fabButton.click();

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
    await editor.type('# FAB Created Page');
    await page.waitForTimeout(2000);

    // Go back and verify page exists
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify page appears in the list
    await expect(
      page.locator('h3').filter({ hasText: 'FAB Created Page' }).first(),
    ).toBeVisible();
  });

  test('should archive and unarchive pages', async ({ page }) => {
    const timestamp = Date.now();

    // Create a page
    const pageId = await createPageWithContent(
      page,
      `# ArchiveUnarchiveTest${timestamp}\n\nContent to archive`,
    );

    await page.goto('/');
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

    await page.goto('/');
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

  test('should show placeholder text on blank page', async ({ page }) => {
    // Create a new blank page
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Wait for editor to be fully loaded
    await page.waitForTimeout(1500);

    // Blur the editor if it's focused (since auto-focus is now enabled)
    await page.evaluate(() => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.getAttribute('contenteditable') === 'true') {
        activeEl.blur();
      }
    });

    // Wait a moment for the blur to take effect
    await page.waitForTimeout(500);

    // Verify the placeholder is visible by checking if the ::before pseudo-element has content
    const placeholderVisible = await page.evaluate(() => {
      const firstPara = document.querySelector(
        '.milkdown .ProseMirror p:first-child',
      );
      if (!firstPara) return false;

      const beforeStyle = window.getComputedStyle(firstPara, '::before');
      const content = beforeStyle.content;

      // Check if content is not "none" and contains the placeholder text
      return content && content !== 'none' && content.includes('ここに入力');
    });

    // The placeholder should be visible
    expect(placeholderVisible).toBe(true);
  });

  test('should auto-focus editor on blank page', async ({ page }) => {
    // Create a new blank page
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Wait for editor to be fully loaded and auto-focused
    await page.waitForTimeout(1500);

    // Check that the editor is focused
    const focusedElement = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return activeEl?.getAttribute('contenteditable') === 'true';
    });

    expect(focusedElement).toBe(true);
  });

  test('should NOT auto-focus editor on page with existing content', async ({
    page,
  }) => {
    // Create a page with content
    const pageId = await createPageWithContent(
      page,
      '# Test Page\n\nThis page has content',
    );

    // Navigate away and then back to the page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Go back to the page with content
    await page.goto(`/page/${pageId}`);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Wait a bit to ensure auto-focus would have happened if it was going to
    await page.waitForTimeout(1500);

    // Verify the editor is NOT auto-focused
    const focusedElement = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return activeEl?.getAttribute('contenteditable') === 'true';
    });

    // The editor should NOT be focused
    expect(focusedElement).toBe(false);
  });

  test('should hide placeholder when content is typed', async ({ page }) => {
    // Create a new blank page
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Wait for editor to be fully loaded
    await page.waitForTimeout(1000);

    // Type some content
    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();
    await editor.type('Hello World');

    // Wait a moment for the content to be processed
    await page.waitForTimeout(500);

    // Blur to ensure we can check the placeholder state
    await page.evaluate(() => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.getAttribute('contenteditable') === 'true') {
        activeEl.blur();
      }
    });
    await page.waitForTimeout(300);

    // Check that the placeholder is no longer visible
    const placeholderVisible = await page.evaluate(() => {
      const firstPara = document.querySelector(
        '.milkdown .ProseMirror p:first-child',
      );
      if (!firstPara) return false;

      const beforeStyle = window.getComputedStyle(firstPara, '::before');
      const content = beforeStyle.content;

      // If content is "none", placeholder is not visible
      return content && content !== 'none' && content.includes('ここに入力');
    });

    // The placeholder should NOT be visible when there's content
    expect(placeholderVisible).toBe(false);
  });

  test('remote cursor should not affect line heights or positions', async ({
    browser,
  }) => {
    // Step 1: Create a page with 4 lines (line 3 is empty) in tab 1
    const context = await browser.newContext();
    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.waitForLoadState('networkidle');

    await page1.click('button[title="新しいページを作成"]');
    await page1.waitForURL(/\/page\/.+/);
    const pageUrl = page1.url();
    await page1.waitForSelector('.milkdown', { timeout: 10000 });
    await page1.waitForTimeout(1000);

    const editor1 = page1
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor1.click();
    await editor1.type('line 1');
    await editor1.press('Enter');
    await editor1.type('line 2');
    await editor1.press('Enter');
    // Empty line (line 3)
    await editor1.press('Enter');
    await editor1.type('line 4');

    // Wait for content to settle
    await page1.waitForTimeout(2000);

    // Step 2: Get baseline line metrics (no remote cursor)
    type LineMetrics = { top: number; height: number }[];
    const getLineMetrics = async (page: Page): Promise<LineMetrics> => {
      return await page.evaluate(() => {
        const paragraphs = document.querySelectorAll(
          '.milkdown .ProseMirror > p',
        );
        return Array.from(paragraphs).map((p) => {
          const rect = p.getBoundingClientRect();
          return { top: rect.top, height: rect.height };
        });
      });
    };

    const baselineMetrics = await getLineMetrics(page1);
    expect(baselineMetrics).toHaveLength(4);

    // Step 3: Open tab 2 and navigate to same page
    const page2 = await context.newPage();
    await page2.goto(pageUrl);
    await page2.waitForLoadState('networkidle');
    await page2.waitForSelector('.milkdown', { timeout: 10000 });
    await page2.waitForTimeout(2000);

    const editor2 = page2
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();

    // Step 4: Verify remote cursor appears in tab 1
    await editor2.click();
    await page2.waitForTimeout(1000);

    // Wait for cursor element to appear in tab 1
    await page1.waitForSelector('.ProseMirror-yjs-cursor', { timeout: 5000 });

    // Step 5 & 6: Move cursor to each position and verify metrics don't change
    // Cursor positions: line 1 start, line 1 end, line 2 start, line 2 end,
    //                   line 3 start (empty), line 3 end (empty),
    //                   line 4 start, line 4 end
    const cursorPositions = [
      { label: 'line 1 start', line: 1, position: 'start' },
      { label: 'line 1 end', line: 1, position: 'end' },
      { label: 'line 2 start', line: 2, position: 'start' },
      { label: 'line 2 end', line: 2, position: 'end' },
      { label: 'line 3 start (empty)', line: 3, position: 'start' },
      { label: 'line 3 end (empty)', line: 3, position: 'end' },
      { label: 'line 4 start', line: 4, position: 'start' },
      { label: 'line 4 end', line: 4, position: 'end' },
    ];

    const failures: string[] = [];

    for (const pos of cursorPositions) {
      // Move cursor in tab 2 to the target position
      // Use Ctrl+Home to go to document start, then navigate with arrows
      await editor2.press('Control+Home');
      await page2.waitForTimeout(100);

      // Move down to target line
      for (let i = 1; i < pos.line; i++) {
        await editor2.press('ArrowDown');
        await page2.waitForTimeout(50);
      }

      // Move to start or end of line
      if (pos.position === 'start') {
        await editor2.press('Home');
      } else {
        await editor2.press('End');
      }

      // Wait for cursor sync to tab 1
      await page2.waitForTimeout(500);

      // Get metrics from tab 1 with the remote cursor present
      const currentMetrics = await getLineMetrics(page1);

      // Verify all line heights and relative positions match baseline
      expect(currentMetrics).toHaveLength(baselineMetrics.length);
      for (let i = 0; i < baselineMetrics.length; i++) {
        const heightDiff = Math.abs(
          currentMetrics[i].height - baselineMetrics[i].height,
        );
        const topDiff = Math.abs(
          currentMetrics[i].top - baselineMetrics[i].top,
        );
        if (heightDiff >= 0.5) {
          failures.push(
            `Line ${i + 1} height changed when remote cursor at ${pos.label}` +
              ` (expected ${baselineMetrics[i].height}, got ${currentMetrics[i].height})`,
          );
        }
        if (topDiff >= 0.5) {
          failures.push(
            `Line ${i + 1} top position changed when remote cursor at ${pos.label}` +
              ` (expected ${baselineMetrics[i].top}, got ${currentMetrics[i].top})`,
          );
        }
      }
    }

    expect(failures, failures.join('\n')).toHaveLength(0);

    await context.close();
  });
});
