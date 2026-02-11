import { test, expect, Page } from '@playwright/test';

/**
 * リアルタイム同期に関するE2Eテスト。
 *
 * Yjs CRDTとWebSocketによる複数タブ間のリアルタイム同期を検証する。
 * 複数のブラウザコンテキスト（タブ）間でのWebSocket通信と、
 * ProseMirrorエディタのDOM同期が必要なため、jsdomでは原理的にテストできない。
 */
test.describe('Real-time Sync', () => {
  /**
   * タブAで入力したコンテンツがタブBにリアルタイムで反映されることを
   * 検証する。
   *
   * 同じページを2つのタブで開き、一方で入力した内容がリロードなしで
   * もう一方に表示されることを確認する。WebSocket経由のYjs同期と
   * 複数ブラウザコンテキストが必要なため、E2Eテストでしか検証できない。
   */
  test('should synchronize data across multiple tabs in real-time', async ({
    browser,
  }) => {
    // Create a new page in the first tab
    const context = await browser.newContext();
    const page1 = await context.newPage();

    // Enable console logging for debugging
    page1.on('console', (msg) => console.log('Page1:', msg.text()));

    await page1.goto('/');
    await page1.waitForURL(/\/p\/.+/);
    await page1.waitForLoadState('networkidle');

    const pageUrl = page1.url();
    const pageId = pageUrl.split('/p/')[1];

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

  /**
   * リモートカーソル（他タブのカーソル表示）が行の高さや位置に
   * 影響を与えないことを検証する。
   *
   * タブ2のカーソルを各行の先頭・末尾・空行に移動させ、タブ1での
   * 各行のgetBoundingClientRect()が変わらないことを確認する。
   * リモートカーソル要素（.ProseMirror-yjs-cursor）のCSSが行の
   * レイアウトを崩さないことを保証する。複数ブラウザコンテキスト間の
   * WebSocket同期と実際のDOM位置計算が必要なため、E2Eテストが必要。
   */
  test('remote cursor should not affect line heights or positions', async ({
    browser,
  }) => {
    // Step 1: Create a page with 4 lines (line 3 is empty) in tab 1
    const context = await browser.newContext();
    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.waitForURL(/\/p\/.+/);
    await page1.waitForLoadState('networkidle');

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
