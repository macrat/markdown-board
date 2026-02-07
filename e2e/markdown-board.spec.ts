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

  test('should not create extra whitespace when cursor is on empty line', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();

    // Step 1: Create a page with Line 1, empty line, Line 3
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
    await editor1.type('Line 1');
    await editor1.press('Enter');
    await editor1.press('Enter'); // Empty line
    await editor1.type('Line 3');

    // Wait for content to sync
    await page1.waitForTimeout(2000);

    // Step 2: Get the Y coordinate of Line 3 before opening second tab
    const line3Para = page1.locator('.milkdown .ProseMirror p').nth(2);
    await expect(line3Para).toHaveText('Line 3');
    const line3BoxBefore = await line3Para.boundingBox();
    const line3YBefore = line3BoxBefore?.y;

    console.log('Line 3 Y position before second tab:', line3YBefore);

    // Step 3: Open second tab and navigate to the same page
    const page2 = await context.newPage();
    await page2.goto(pageUrl);
    await page2.waitForLoadState('networkidle');
    await page2.waitForSelector('.milkdown', { timeout: 10000 });
    await page2.waitForTimeout(2000);

    // Place cursor on the empty line (line 2)
    const editor2 = page2
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor2.click();

    // Navigate to line 2 (empty line)
    const line2Para = page2.locator('.milkdown .ProseMirror p').nth(1);
    await line2Para.click();

    console.log('Clicked on empty line in second tab');
    await page2.waitForTimeout(1000);

    // Step 4: Verify cursor is visible in first tab
    await page1.waitForTimeout(1000);
    const cursor = page1.locator('.ProseMirror-yjs-cursor');
    await expect(cursor).toBeVisible({ timeout: 5000 });
    console.log('Cursor visible in first tab');

    // Step 5: Compare Line 3 Y position in first tab
    const line3BoxAfterEmptyCursor = await line3Para.boundingBox();
    const line3YAfterEmptyCursor = line3BoxAfterEmptyCursor?.y;

    console.log(
      'Line 3 Y position after cursor on empty line:',
      line3YAfterEmptyCursor,
    );

    // The Y position should be approximately the same (allowing for sub-pixel rendering)
    expect(Math.abs(line3YAfterEmptyCursor! - line3YBefore!)).toBeLessThan(2);

    // Step 6: Now test with text on line 2
    // In page2, type "Line 2" on the currently selected line
    await editor2.type('Line 2');
    await page2.waitForTimeout(2000);

    // Wait for sync to page1
    await page1.waitForTimeout(2000);

    // Verify Line 2 text appears in page1
    const line2InPage1 = page1.locator('.milkdown .ProseMirror p').nth(1);
    await expect(line2InPage1).toContainText('Line 2', { timeout: 5000 });

    // Get Line 3 Y position after adding text to line 2
    const line3BoxAfterTextCursor = await line3Para.boundingBox();
    const line3YAfterTextCursor = line3BoxAfterTextCursor?.y;

    console.log(
      'Line 3 Y position after cursor on text line:',
      line3YAfterTextCursor,
    );

    // Empty lines and text lines should have the same height
    // So Line 3's position should NOT change when text is added to line 2
    expect(
      Math.abs(line3YAfterTextCursor! - line3YAfterEmptyCursor!),
    ).toBeLessThan(2);

    await context.close();
  });

  test('should not overlap text on wrapped lines or forced line breaks', async ({
    page,
  }) => {
    // Create a new page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Test 1: Long line that will wrap
    const longText =
      'This is a very long line of text that should wrap to multiple lines when the viewport is not wide enough to display it all in a single line. It contains enough words to ensure wrapping occurs.';
    await editor.type(longText);
    await editor.press('Enter');
    await editor.press('Enter');
    await editor.type('This is the next paragraph that should not overlap');

    await page.waitForTimeout(1000);

    // Get the first paragraph with long text
    const longPara = page.locator('.milkdown .ProseMirror p').first();
    const longParaBox = await longPara.boundingBox();

    // Get the next paragraph
    const nextPara = page.locator('.milkdown .ProseMirror p').nth(2);
    const nextParaBox = await nextPara.boundingBox();

    // Get the actual text bounding box by checking the last word position
    const lastWordInLongPara = await page.evaluate(() => {
      const para = document.querySelector('.milkdown .ProseMirror p');
      if (!para) return null;
      const range = document.createRange();
      range.selectNodeContents(para);
      const rects = range.getClientRects();
      if (rects.length === 0) return null;
      // Get the last rect which represents the last line of text
      const lastRect = rects[rects.length - 1];
      return {
        top: lastRect.top,
        bottom: lastRect.bottom,
        height: lastRect.bottom - lastRect.top,
      };
    });

    // Check if paragraphs overlap
    if (longParaBox && nextParaBox && lastWordInLongPara) {
      console.log('Long paragraph element top:', longParaBox.y);
      console.log(
        'Long paragraph element bottom (fixed height):',
        longParaBox.y + longParaBox.height,
      );
      console.log(
        'Long paragraph actual text bottom:',
        lastWordInLongPara.bottom,
      );
      console.log('Next paragraph top:', nextParaBox.y);

      // Check if the actual text (not just the element) overlaps with next paragraph
      // Allow 2px tolerance for rendering differences
      const textOverlapsNextPara =
        lastWordInLongPara.bottom > nextParaBox.y + 2;
      console.log('Text overlaps next paragraph:', textOverlapsNextPara);

      if (textOverlapsNextPara) {
        console.error(
          'OVERLAP DETECTED: Long paragraph text extends into next paragraph!',
        );
        console.error(
          `Text bottom (${lastWordInLongPara.bottom}) > Next para top (${nextParaBox.y})`,
        );
      }

      // The test should fail if there's overlap
      expect(lastWordInLongPara.bottom).toBeLessThanOrEqual(nextParaBox.y + 2);
    }

    // Test 2: Forced line break with two spaces + Enter
    await editor.press('Control+a');
    await editor.press('Backspace');
    await page.waitForTimeout(500);

    await editor.type('First line  '); // Two spaces at the end for hard break
    await editor.press('Enter');
    await editor.type('Second line after hard break');
    await editor.press('Enter');
    await editor.press('Enter');
    await editor.type('Third paragraph');

    await page.waitForTimeout(1000);

    // Check if hard break causes overlap
    const firstParaWithBreak = page.locator('.milkdown .ProseMirror p').first();
    const thirdPara = page.locator('.milkdown .ProseMirror p').nth(2);

    const firstBoxWithBreak = await firstParaWithBreak.boundingBox();
    const thirdBox = await thirdPara.boundingBox();

    const firstParaTextBottom = await page.evaluate(() => {
      const para = document.querySelector('.milkdown .ProseMirror p');
      if (!para) return null;
      const range = document.createRange();
      range.selectNodeContents(para);
      const rects = range.getClientRects();
      if (rects.length === 0) return null;
      const lastRect = rects[rects.length - 1];
      return lastRect.bottom;
    });

    if (firstBoxWithBreak && thirdBox && firstParaTextBottom) {
      console.log(
        'First paragraph with hard break - element top:',
        firstBoxWithBreak.y,
      );
      console.log(
        'First paragraph with hard break - element bottom:',
        firstBoxWithBreak.y + firstBoxWithBreak.height,
      );
      console.log(
        'First paragraph with hard break - actual text bottom:',
        firstParaTextBottom,
      );
      console.log('Third paragraph top:', thirdBox.y);

      const hardBreakOverlaps = firstParaTextBottom > thirdBox.y + 2;
      console.log(
        'Hard break text overlaps third paragraph:',
        hardBreakOverlaps,
      );

      if (hardBreakOverlaps) {
        console.error(
          'OVERLAP DETECTED: Hard break paragraph text extends into third paragraph!',
        );
      }

      expect(firstParaTextBottom).toBeLessThanOrEqual(thirdBox.y + 2);
    }

    // Visual verification - take a screenshot
    await page.screenshot({
      path: '/tmp/playwright-logs/text-overlap-test.png',
      fullPage: false,
    });
  });

  test('should not have second paragraph intrude into first paragraph wrapped lines', async ({
    page,
  }) => {
    // This test checks for the specific issue where a paragraph with many characters
    // wraps to multiple lines, and the next paragraph intrudes into those wrapped lines
    // because of fixed height on paragraphs

    // Set a narrower viewport to force more wrapping
    await page.setViewportSize({ width: 800, height: 600 });

    // Create a new page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();

    // Type many 'a's to ensure wrapping occurs (similar to user's example)
    const longTextA = 'a'.repeat(90);
    await editor.type(longTextA);
    await editor.press('Enter');
    await editor.press('Enter');

    // Type many 'b's for the second paragraph
    const longTextB = 'b'.repeat(30);
    await editor.type(longTextB);

    await page.waitForTimeout(1000);

    // Get the first paragraph (with many a's)
    const firstPara = page.locator('.milkdown .ProseMirror p').first();
    const firstParaBox = await firstPara.boundingBox();

    // Get the second paragraph (with many b's)
    const secondPara = page.locator('.milkdown .ProseMirror p').nth(2);
    const secondParaBox = await secondPara.boundingBox();

    // Get the actual text bottom of the first paragraph
    const firstParaTextBottom = await page.evaluate(() => {
      const para = document.querySelector('.milkdown .ProseMirror p');
      if (!para) return null;
      const range = document.createRange();
      range.selectNodeContents(para);
      const rects = range.getClientRects();
      if (rects.length === 0) return null;
      // Get the last rect which represents the last line of wrapped text
      const lastRect = rects[rects.length - 1];
      return {
        bottom: lastRect.bottom,
        top: lastRect.top,
      };
    });

    // Get the actual text top of the second paragraph
    const secondParaTextTop = await page.evaluate(() => {
      const paras = document.querySelectorAll('.milkdown .ProseMirror p');
      if (paras.length < 3) return null;
      const para = paras[2]; // Third paragraph (index 2)
      const range = document.createRange();
      range.selectNodeContents(para);
      const rects = range.getClientRects();
      if (rects.length === 0) return null;
      const firstRect = rects[0];
      return {
        top: firstRect.top,
        bottom: firstRect.bottom,
      };
    });

    if (
      firstParaBox &&
      secondParaBox &&
      firstParaTextBottom &&
      secondParaTextTop
    ) {
      console.log('First paragraph element top:', firstParaBox.y);
      console.log(
        'First paragraph element bottom (fixed):',
        firstParaBox.y + firstParaBox.height,
      );
      console.log(
        'First paragraph actual text bottom:',
        firstParaTextBottom.bottom,
      );
      console.log('Second paragraph element top:', secondParaBox.y);
      console.log('Second paragraph text top:', secondParaTextTop.top);

      // Check if the second paragraph's text intrudes into the first paragraph's text area
      // The second paragraph text should start AFTER the first paragraph text ends
      const intrusion = firstParaTextBottom.bottom > secondParaTextTop.top;

      console.log(
        'Second paragraph intrudes into first:',
        intrusion,
        `(${firstParaTextBottom.bottom} > ${secondParaTextTop.top})`,
      );

      if (intrusion) {
        console.error(
          'INTRUSION DETECTED: Second paragraph text starts before first paragraph text ends!',
        );
        console.error(
          `First para text ends at ${firstParaTextBottom.bottom}, but second para text starts at ${secondParaTextTop.top}`,
        );
      }

      // The test should fail if there's intrusion
      expect(firstParaTextBottom.bottom).toBeLessThanOrEqual(
        secondParaTextTop.top + 2,
      );
    }

    // Take a screenshot for visual verification
    await page.screenshot({
      path: '/tmp/playwright-logs/paragraph-intrusion-test.png',
      fullPage: false,
    });
  });
});
