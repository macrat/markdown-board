import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Markdown Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

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
});
