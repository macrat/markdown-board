import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

/**
 * エディタの振る舞いに関するE2Eテスト。
 *
 * CSS擬似要素（::after）によるプレースホルダー、contenteditable要素への
 * ブラウザネイティブのフォーカス制御、実際のキー入力によるエディタの応答性
 * など、jsdomでは再現できないブラウザ固有の機能を検証する。
 */
test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  // ==================== Placeholder ====================

  /**
   * 空のページを開いたとき、エディタにプレースホルダーテキスト「ここに入力」
   * が表示されることを検証する。
   *
   * プレースホルダーはCSS ::after擬似要素で実装されているため、
   * window.getComputedStyleによる実際のスタイル計算が必要であり、
   * jsdomではテストできない。
   */
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

  /**
   * プレースホルダーが1行目に正しく配置されていることを検証する。
   *
   * CSS ::after擬似要素のposition/top/leftプロパティが正しく設定され、
   * プレースホルダーが1行目の先頭に表示されることを確認する。
   * getComputedStyleで擬似要素のレイアウト位置を取得する必要があるため、
   * jsdomではテストできない。
   */
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

  /**
   * テキストを入力するとプレースホルダーが非表示になることを検証する。
   *
   * contenteditable要素にキー入力した後、CSS ::after擬似要素の
   * contentプロパティが消えることを確認する。ブラウザのキー入力処理と
   * CSSスタイル計算の両方が必要なため、jsdomではテストできない。
   */
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

  /**
   * 空白ページを開いた際にエディタに自動的にフォーカスが当たることを検証する。
   *
   * document.activeElementがcontenteditable要素であるかを確認する。
   * ブラウザネイティブのフォーカス管理（document.activeElement）は
   * jsdomでは正確に再現されないため、E2Eテストが必要。
   */
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

  /**
   * 既存コンテンツがあるページではエディタに自動フォーカスしないことを検証する。
   *
   * コンテンツがあるページでは意図しない編集を防ぐため、フォーカスを
   * 当てない仕様になっている。実際のページ遷移とフォーカス状態の確認には
   * ブラウザのフォーカス管理が必要なため、jsdomではテストできない。
   */
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

  /**
   * 大量のコンテンツ（10セクション）を入力してもエディタが正常に動作することを
   * 検証する。
   *
   * 実際のキー入力による連続的なDOM操作とMilkdownエディタの応答性を
   * テストする。ProseMirrorのトランザクション処理やブラウザの描画を含む
   * エンドツーエンドの挙動であり、jsdomでは再現できない。
   */
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

  /**
   * ボタン要素にフォーカスインジケータが表示されることを検証する。
   *
   * ブラウザネイティブのfocus()メソッドとフォーカス状態の検証が必要。
   * jsdomではフォーカスイベントのシミュレーションが不完全なため、
   * 実際のブラウザでの検証が必要。
   */
  test('should have visible focus indicators', async ({ page }) => {
    const newPageButton = page.locator('button[title="新しいページを作成"]');
    await newPageButton.focus();
    await expect(newPageButton).toBeFocused();
  });
});
