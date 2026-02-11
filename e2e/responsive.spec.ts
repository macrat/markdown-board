import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

/**
 * レスポンシブレイアウトに関するE2Eテスト。
 *
 * ビューポートサイズの変更、長いテキストの折り返し、モバイル・タブレット
 * 画面でのUI表示など、実際のブラウザレンダリングエンジンによるレイアウト
 * 計算が必要なテストをまとめている。jsdomにはレイアウトエンジンがないため、
 * これらはE2Eテストでしか検証できない。
 */
test.describe('Responsive Layout', () => {
  /**
   * 1000文字の長い行を含むコンテンツで水平スクロールが発生しないことを
   * 検証する。
   *
   * scrollWidthとclientWidthを比較し、コンテンツがビューポート内に
   * 収まっていることを確認する。CSSのword-wrapやoverflow処理を含む
   * 実際のレイアウト計算が必要なため、jsdomではテストできない。
   */
  test('should handle very long lines without breaking layout', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const longLine = 'a'.repeat(1000);
    const content = `# Long Line Test\n\n${longLine}`;

    await createPageWithContent(page, content);

    await page.waitForTimeout(1000);

    const hasHorizontalScroll = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  /**
   * モバイルサイズ（375x667、iPhone SE相当）のビューポートで
   * ハンバーガーメニューが表示され、サイドバーが非表示であることを検証する。
   *
   * ハンバーガーメニューをクリックするとサイドバーが表示されることも確認する。
   * 実際のビューポートサイズ変更とCSSメディアクエリの評価が必要なため、
   * jsdomではテストできない。
   */
  test('should show hamburger menu on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');

    // Hamburger menu should be visible on mobile
    await expect(page.locator('.hamburger-menu-button')).toBeVisible();

    // Sidebar create button should not be directly visible (hidden on mobile)
    const createButton = page.locator('button[title="新しいページを作成"]');
    await expect(createButton).not.toBeVisible();

    // Open hamburger menu
    await page.locator('.hamburger-menu-button').click();
    await page.waitForTimeout(300);

    // Now sidebar should be visible with create button
    await expect(createButton).toBeVisible();
  });

  /**
   * タブレットサイズ（768x1024、iPad相当）のビューポートで
   * サイドバーが直接表示されることを検証する。
   *
   * ハンバーガーメニューが非表示であり、サイドバーの新規作成ボタンが
   * 可視状態であることを確認する。実際のビューポートサイズ変更と
   * レンダリングが必要なため、jsdomではテストできない。
   */
  test('should show sidebar on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.waitForURL(/\/page\/.+/);
    await page.waitForLoadState('networkidle');

    // Sidebar should be visible without hamburger menu
    await expect(
      page.locator('button[title="新しいページを作成"]'),
    ).toBeVisible();

    // Hamburger menu should be hidden on tablet
    await expect(page.locator('.hamburger-menu-button')).not.toBeVisible();
  });
});
