import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Test for Issue: 他のユーザーのカーソルが空行にあるとき、その行の下に不自然な空白が発生する
 * (When another user's cursor is on an empty line, an unnatural blank space appears below that line)
 *
 * This test verifies that when one user's cursor is on an empty line,
 * the other user doesn't see excessive blank space below that line.
 */

// Helper to create a new page and return its ID
async function createNewPage(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.click('button[title="新しいページを作成"]');
  await page.waitForURL(/\/page\/.+/);
  await page.waitForSelector('.milkdown', { timeout: 10000 });
  const url = page.url();
  return url.split('/page/')[1];
}

test.describe('Collaborative Cursor on Empty Line', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let user1Page: Page;
  let user2Page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create two browser contexts to simulate two different users
    context1 = await browser.newContext();
    context2 = await browser.newContext();

    user1Page = await context1.newPage();
    user2Page = await context2.newPage();
  });

  test.afterEach(async () => {
    await context1?.close();
    await context2?.close();
  });

  test('should not show extra blank space when cursor is on empty line', async () => {
    // User 1: Create a new page
    const pageId = await createNewPage(user1Page);

    // User 1: Type content with an empty line
    const editor1 = user1Page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor1.click();

    // Type: Line 1 → Enter → Enter (empty line) → Line 3
    await editor1.type('Line 1 with some text');
    await editor1.press('Enter');
    await editor1.press('Enter'); // Create empty line
    await editor1.type('Line 3 with some text');

    // Wait for content to sync
    await user1Page.waitForTimeout(2000);

    // Get the Y coordinate of line 3 BEFORE collaborator joins
    const editorContent = await user1Page.locator('.ProseMirror').first();
    const paragraphsBeforeCollab = await editorContent.locator('p').all();
    expect(paragraphsBeforeCollab.length).toBe(3);
    const line3BeforeCollab = await paragraphsBeforeCollab[2].boundingBox();
    expect(line3BeforeCollab).not.toBeNull();
    const line3YBeforeCollab = line3BeforeCollab!.y;
    
    console.log(`[Test] Line 3 Y coordinate WITHOUT collaborator: ${line3YBeforeCollab}`);

    // User 2: Open the same page
    await user2Page.goto(`/page/${pageId}`);
    await user2Page.waitForLoadState('networkidle');
    await user2Page.waitForSelector('.milkdown', { timeout: 10000 });

    // Wait for Yjs sync
    await user2Page.waitForTimeout(2000);

    // User 2: Position cursor on the empty line (line 2)
    const editor2 = user2Page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor2.click();

    // Move cursor to line 2 (the empty line)
    await user2Page.keyboard.press('ArrowDown'); // Move from line 1 to line 2

    // Wait a moment for cursor position to sync
    await user1Page.waitForTimeout(1500);

    // Take a screenshot from User 1's perspective
    await user1Page.screenshot({
      path: '/tmp/collab-cursor-empty-line-user1.png',
      fullPage: true,
    });

    // Get the Y coordinate of line 3 AFTER collaborator's cursor is on line 2
    const paragraphsAfterCollab = await editorContent.locator('p').all();
    expect(paragraphsAfterCollab.length).toBe(3);
    const line3AfterCollab = await paragraphsAfterCollab[2].boundingBox();
    expect(line3AfterCollab).not.toBeNull();
    const line3YAfterCollab = line3AfterCollab!.y;
    
    console.log(`[Test] Line 3 Y coordinate WITH collaborator on line 2: ${line3YAfterCollab}`);
    console.log(`[Test] Y coordinate difference: ${line3YAfterCollab - line3YBeforeCollab}px`);

    // Verify that the collaborative cursor is visible
    const collabCursor = await user1Page
      .locator('.ProseMirror-yjs-cursor')
      .first();
    await expect(collabCursor).toBeVisible();

    // CRITICAL TEST: Line 3's Y position should NOT change when collaborator's cursor appears on line 2
    // If Y coordinate increases, it means extra spacing is being added below the empty line
    // With the buggy CSS (.ProseMirror-yjs-cursor + .ProseMirror-trailingBreak), 
    // the Y coordinate would increase because the trailing break in the empty line gets hidden,
    // causing layout issues
    expect(line3YAfterCollab).toBe(line3YBeforeCollab);
  });

  test('should properly handle cursor on line with text', async () => {
    // User 1: Create a new page
    const pageId = await createNewPage(user1Page);

    // User 1: Type content with multiple lines
    const editor1 = user1Page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor1.click();

    await editor1.type('Line 1 with text');
    await editor1.press('Enter');
    await editor1.type('Line 2 with text');
    await editor1.press('Enter');
    await editor1.type('Line 3 with text');

    // Wait for content to sync
    await user1Page.waitForTimeout(2000);

    // User 2: Open the same page
    await user2Page.goto(`/page/${pageId}`);
    await user2Page.waitForLoadState('networkidle');
    await user2Page.waitForSelector('.milkdown', { timeout: 10000 });
    await user2Page.waitForTimeout(2000);

    // User 2: Position cursor on line 2 (with text)
    const editor2 = user2Page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor2.click();
    await user2Page.keyboard.press('ArrowDown'); // Move to line 2

    // Wait for cursor sync
    await user1Page.waitForTimeout(1000);

    // Take screenshot
    await user1Page.screenshot({
      path: '/tmp/collab-cursor-text-line-user1.png',
      fullPage: true,
    });

    // Verify collaborative cursor is visible
    const collabCursor = await user1Page
      .locator('.ProseMirror-yjs-cursor')
      .first();
    await expect(collabCursor).toBeVisible();

    // Get all paragraphs and verify they have reasonable heights
    const editorContent = await user1Page.locator('.ProseMirror').first();
    const paragraphs = await editorContent.locator('p').all();

    for (const paragraph of paragraphs) {
      const box = await paragraph.boundingBox();
      if (box) {
        // Each line with text should have reasonable height
        expect(box.height).toBeLessThan(60);
        expect(box.height).toBeGreaterThan(20);
      }
    }
  });
});
