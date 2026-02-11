import { Page } from '@playwright/test';

export async function createPageWithContent(page: Page, content: string) {
  // Listen for Yjs sync completion before triggering navigation,
  // so we don't miss the event that fires during page initialization.
  const syncComplete = page.waitForEvent('console', {
    predicate: (msg) =>
      msg.text().includes('[Yjs] Sync complete') ||
      msg.text().includes('[Yjs] Sync timeout'),
    timeout: 15000,
  });

  await page.click('button[title="新しいページを作成"]');
  await page.waitForURL(/\/page\/.+/);

  // Wait for Yjs WebSocket sync to complete. This confirms the WebSocket
  // is connected, so typed content will be sent to the server immediately.
  await syncComplete;

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

  // Wait for the server to process WebSocket messages. Since the WebSocket
  // is confirmed connected (sync above), each keystroke's Yjs update is
  // sent immediately via broadcastMessage.
  await page.waitForTimeout(2000);
  return page.url().split('/page/')[1];
}
