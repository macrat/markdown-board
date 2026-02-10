import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Editor Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
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

    // Verify the placeholder is visible by checking if the ::after pseudo-element has content
    const placeholderVisible = await page.evaluate(() => {
      const firstPara = document.querySelector(
        '.milkdown .ProseMirror p:first-child',
      );
      if (!firstPara) return false;

      const afterStyle = window.getComputedStyle(firstPara, '::after');
      const content = afterStyle.content;

      // Check if content is not "none" and contains the placeholder text
      return content && content !== 'none' && content.includes('ここに入力');
    });

    // The placeholder should be visible
    expect(placeholderVisible).toBe(true);
  });

  test('should display placeholder on the first line (not second line)', async ({
    page,
  }) => {
    // Create a new blank page
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });

    // Wait for editor to be fully loaded
    await page.waitForTimeout(1500);

    // Blur the editor to ensure placeholder is visible
    await page.evaluate(() => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.getAttribute('contenteditable') === 'true') {
        activeEl.blur();
      }
    });

    // Wait a moment for the blur to take effect
    await page.waitForTimeout(500);

    // Verify placeholder position matches the first paragraph
    const positions = await page.evaluate(() => {
      const firstPara = document.querySelector(
        '.milkdown .ProseMirror p:first-child',
      ) as HTMLElement;
      if (!firstPara) return null;

      // Get the bounding rect of the first paragraph
      const paraRect = firstPara.getBoundingClientRect();

      // Get the computed style of the ::after pseudo-element (placeholder)
      const afterStyle = window.getComputedStyle(firstPara, '::after');
      const content = afterStyle.content;

      // Verify placeholder exists
      if (!content || content === 'none' || !content.includes('ここに入力')) {
        return null;
      }

      // Since the ::after is positioned absolutely with top: 0, left: 0,
      // it should be at the same position as the paragraph element
      // We can verify this by checking the positioning style
      const position = afterStyle.position;
      const top = afterStyle.top;
      const left = afterStyle.left;

      return {
        paraTop: paraRect.top,
        paraLeft: paraRect.left,
        afterPosition: position,
        afterTop: top,
        afterLeft: left,
      };
    });

    // Verify we got valid positions
    expect(positions).not.toBeNull();

    if (positions) {
      // The ::after pseudo-element should be positioned absolutely
      expect(positions.afterPosition).toBe('absolute');

      // With top: 0 and left: 0, which means it overlays the first line
      expect(positions.afterTop).toBe('0px');
      expect(positions.afterLeft).toBe('0px');
    }
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

      const afterStyle = window.getComputedStyle(firstPara, '::after');
      const content = afterStyle.content;

      // If content is "none", placeholder is not visible
      return content && content !== 'none' && content.includes('ここに入力');
    });

    // The placeholder should NOT be visible when there's content
    expect(placeholderVisible).toBe(false);
  });
});
