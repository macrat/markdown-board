import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  // ==================== Placeholder ====================

  test('should show placeholder text on blank page', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.getAttribute('contenteditable') === 'true') {
        activeEl.blur();
      }
    });
    await page.waitForTimeout(500);

    const placeholderVisible = await page.evaluate(() => {
      const firstPara = document.querySelector(
        '.milkdown .ProseMirror p:first-child',
      );
      if (!firstPara) return false;

      const afterStyle = window.getComputedStyle(firstPara, '::after');
      const content = afterStyle.content;

      return content && content !== 'none' && content.includes('ここに入力');
    });

    expect(placeholderVisible).toBe(true);
  });

  test('should display placeholder on the first line (not second line)', async ({
    page,
  }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.getAttribute('contenteditable') === 'true') {
        activeEl.blur();
      }
    });
    await page.waitForTimeout(500);

    const positions = await page.evaluate(() => {
      const firstPara = document.querySelector(
        '.milkdown .ProseMirror p:first-child',
      ) as HTMLElement;
      if (!firstPara) return null;

      const afterStyle = window.getComputedStyle(firstPara, '::after');
      const content = afterStyle.content;

      if (!content || content === 'none' || !content.includes('ここに入力')) {
        return null;
      }

      return {
        afterPosition: afterStyle.position,
        afterTop: afterStyle.top,
        afterLeft: afterStyle.left,
      };
    });

    expect(positions).not.toBeNull();
    if (positions) {
      expect(positions.afterPosition).toBe('absolute');
      expect(positions.afterTop).toBe('0px');
      expect(positions.afterLeft).toBe('0px');
    }
  });

  test('should hide placeholder when content is typed', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const editor = page
      .locator('.milkdown')
      .locator('div[contenteditable="true"]')
      .first();
    await editor.click();
    await editor.type('Hello World');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.getAttribute('contenteditable') === 'true') {
        activeEl.blur();
      }
    });
    await page.waitForTimeout(300);

    const placeholderVisible = await page.evaluate(() => {
      const firstPara = document.querySelector(
        '.milkdown .ProseMirror p:first-child',
      );
      if (!firstPara) return false;

      const afterStyle = window.getComputedStyle(firstPara, '::after');
      const content = afterStyle.content;

      return content && content !== 'none' && content.includes('ここに入力');
    });

    expect(placeholderVisible).toBe(false);
  });

  // ==================== Auto-focus ====================

  test('should auto-focus editor on blank page', async ({ page }) => {
    await page.click('button[title="新しいページを作成"]');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1500);

    const focusedElement = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return activeEl?.getAttribute('contenteditable') === 'true';
    });

    expect(focusedElement).toBe(true);
  });

  test('should NOT auto-focus editor on page with existing content', async ({
    page,
  }) => {
    const pageId = await createPageWithContent(
      page,
      '# Test Page\n\nThis page has content',
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.goto(`/page/${pageId}`);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(1500);

    const focusedElement = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return activeEl?.getAttribute('contenteditable') === 'true';
    });

    expect(focusedElement).toBe(false);
  });

  // ==================== Long Content ====================

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

    await editor.type('# Stress Test Document');
    await editor.press('Enter');
    await editor.press('Enter');

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

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Stress Test Document');
    await expect(editorArea).toContainText('Section 1');
    await expect(editorArea).toContainText('Section 10');
  });

  // ==================== Focus Indicator ====================

  test('should have visible focus indicators', async ({ page }) => {
    const newPageButton = page.locator('button[title="新しいページを作成"]');
    await newPageButton.focus();
    await expect(newPageButton).toBeFocused();
  });
});
