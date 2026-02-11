import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

/**
 * データ永続化に関するE2Eテスト。
 *
 * ブラウザ上でのエディタ操作→自動保存→ページリロード→復元という
 * エンドツーエンドのデータフローを検証する。SQLite永続化の単体テストは
 * 別途存在するが、ここではフロントエンド（Milkdown/Yjs）からバックエンド
 * （API/SQLite）までの統合的な動作を確認する。
 */
test.describe('Data Persistence', () => {
  /**
   * エディタで入力したコンテンツが、ローカルキャッシュをクリアして
   * リロードした後もSQLiteから復元されることを検証する。
   *
   * localStorage/sessionStorageをクリアした上でリロードすることで、
   * サーバー再起動相当の状態を再現する。Milkdownエディタでの入力→
   * Yjs経由の自動保存→API経由のSQLite永続化→ページリロードによる
   * 復元という完全なサイクルをテストするため、E2Eテストが必要。
   */
  test('should restore content from SQLite after server restart', async ({
    page,
  }) => {
    // Navigate to home (auto-creates and redirects to new page)
    await page.goto('/');
    await page.waitForURL(/\/p\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.waitForSelector('.milkdown', { timeout: 10000 });

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

    // Clear local cache and hard reload to simulate server restart
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Restart Test', { timeout: 5000 });
    await expect(editorArea).toContainText(
      'This content should survive server restart',
      { timeout: 5000 },
    );
    await expect(editorArea).toContainText('Second line of content', {
      timeout: 5000,
    });

    const pageTitle = page.locator('.milkdown .ProseMirror h1').first();
    await expect(pageTitle).toContainText('Restart Test');
  });

  /**
   * ページ間を素早く遷移してもデータが失われないことを検証する。
   *
   * エディタページとトップページ（新規ページにリダイレクト）の間を
   * 繰り返し遷移し、最終的にコンテンツが保持されていることを確認する。
   * 各遷移でYjsドキュメントの初期化/破棄、WebSocket接続の確立/切断が
   * 繰り返される。page.goto()によるフルリロードでクライアント状態が
   * 完全にリセットされるため、Yjs永続化の信頼性を厳密に検証できる。
   */
  test('should handle rapid navigation without data loss', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/p\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const pageId = await createPageWithContent(
      page,
      '# Rapid Test\n\nContent to preserve',
    );
    const pageUrl = `/p/${pageId}`;

    // Verify content is persisted (hard reload forces Yjs to load from SQLite)
    await page.goto(pageUrl);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    const editorArea = page.locator('.milkdown .ProseMirror').first();
    await expect(editorArea).toContainText('Content to preserve', {
      timeout: 10000,
    });

    // Rapidly navigate back and forth
    await page.goto('/');
    await page.waitForURL(/\/p\/.+/);
    await page.waitForTimeout(300);

    await page.goto(pageUrl);
    await page.waitForTimeout(300);

    await page.goto('/');
    await page.waitForURL(/\/p\/.+/);
    await page.waitForTimeout(300);

    // Final navigation: verify content survives rapid navigation
    await page.goto(pageUrl);
    await page.waitForSelector('.milkdown', { timeout: 10000 });
    await expect(editorArea).toContainText('Content to preserve', {
      timeout: 10000,
    });
  });
});
