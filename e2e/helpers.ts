import { Page } from '@playwright/test';

export async function createPageWithContent(page: Page, content: string) {
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

export const MAX_TAB_ITERATIONS = 10;
