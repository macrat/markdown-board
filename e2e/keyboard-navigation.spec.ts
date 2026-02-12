import { test, expect } from '@playwright/test';
import { createPageWithContent } from './helpers';

/**
 * サイドバーのキーボードナビゲーションに関するE2Eテスト。
 *
 * ArrowUp/ArrowDown によるページリスト内のフォーカス移動、
 * Home/End によるタブ間のジャンプ、focus-visible によるフォーカス
 * インジケータの表示など、ブラウザのフォーカス管理に依存する
 * 機能を検証する。jsdomではフォーカス管理が正確に再現されない
 * ため、E2Eテストが必要。
 */
test.describe('Sidebar Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/p\/.+/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  // ==================== Tab Navigation ====================

  /**
   * ArrowRight/ArrowLeft でタブ間のフォーカス移動ができることを検証する。
   *
   * WAI-ARIA Tabs パターンに従い、矢印キーでタブ間を移動できることを
   * 確認する。ブラウザのフォーカス管理に依存するため、E2Eテストが必要。
   */
  test('should navigate between tabs with ArrowRight/ArrowLeft', async ({
    page,
  }) => {
    const latestTab = page.locator('#tab-latest');
    const archiveTab = page.locator('#tab-archive');

    await latestTab.focus();
    await expect(latestTab).toBeFocused();

    await latestTab.press('ArrowRight');
    await expect(archiveTab).toBeFocused();

    await archiveTab.press('ArrowLeft');
    await expect(latestTab).toBeFocused();
  });

  /**
   * Home キーで最初のタブ、End キーで最後のタブにフォーカスが
   * 移動することを検証する。
   *
   * WAI-ARIA Tabs パターンの Home/End キーサポートを確認する。
   * ブラウザのフォーカス管理に依存するため、E2Eテストが必要。
   */
  test('should jump to first/last tab with Home/End keys', async ({ page }) => {
    const latestTab = page.locator('#tab-latest');
    const archiveTab = page.locator('#tab-archive');

    await archiveTab.click();
    await archiveTab.focus();
    await expect(archiveTab).toBeFocused();

    await archiveTab.press('Home');
    await expect(latestTab).toBeFocused();

    await latestTab.press('End');
    await expect(archiveTab).toBeFocused();
  });

  // ==================== Page List Navigation ====================

  /**
   * ArrowDown/ArrowUp でページリスト内のフォーカス移動ができることを
   * 検証する。
   *
   * 複数ページが存在する状態で、ページリストアイテム間を矢印キーで
   * 移動できることを確認する。ブラウザのフォーカス管理に依存するため、
   * E2Eテストが必要。
   */
  test('should navigate page list items with ArrowDown/ArrowUp', async ({
    page,
  }) => {
    await createPageWithContent(page, '# Page A');
    await createPageWithContent(page, '# Page B');
    await page.waitForTimeout(500);

    const pageItems = page.locator('.page-list-item-button');
    const itemCount = await pageItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(2);

    await pageItems.first().focus();
    await expect(pageItems.first()).toBeFocused();

    await pageItems.first().press('ArrowDown');
    await expect(pageItems.nth(1)).toBeFocused();

    await pageItems.nth(1).press('ArrowUp');
    await expect(pageItems.first()).toBeFocused();
  });

  /**
   * Home/End キーでページリストの最初/最後のアイテムに
   * フォーカスが移動することを検証する。
   *
   * ブラウザのフォーカス管理に依存するため、E2Eテストが必要。
   */
  test('should jump to first/last page list item with Home/End', async ({
    page,
  }) => {
    await createPageWithContent(page, '# Page A');
    await createPageWithContent(page, '# Page B');
    await page.waitForTimeout(500);

    const pageItems = page.locator('.page-list-item-button');
    const itemCount = await pageItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(2);

    await pageItems.first().focus();
    await pageItems.first().press('End');
    await expect(pageItems.last()).toBeFocused();

    await pageItems.last().press('Home');
    await expect(pageItems.first()).toBeFocused();
  });

  /**
   * ArrowUp が最初のアイテムで、ArrowDown が最後のアイテムで
   * フォーカスが境界を超えないことを検証する。
   *
   * ブラウザのフォーカス管理に依存するため、E2Eテストが必要。
   */
  test('should not move focus beyond list boundaries', async ({ page }) => {
    await createPageWithContent(page, '# Page A');
    await createPageWithContent(page, '# Page B');
    await page.waitForTimeout(500);

    const pageItems = page.locator('.page-list-item-button');

    await pageItems.first().focus();
    await pageItems.first().press('ArrowUp');
    await expect(pageItems.first()).toBeFocused();

    await pageItems.last().focus();
    await pageItems.last().press('ArrowDown');
    await expect(pageItems.last()).toBeFocused();
  });

  // ==================== Focus Indicator ====================

  /**
   * ページリストアイテムにキーボードフォーカスが当たったとき、
   * focus-visible のスタイルが適用されることを検証する。
   *
   * CSS :focus-visible 擬似クラスによるフォーカスインジケータが
   * 正しく表示されることを確認する。getComputedStyle による
   * スタイル計算が必要なため、E2Eテストが必要。
   */
  test('should show focus indicator on page list item', async ({ page }) => {
    const pageItems = page.locator('.page-list-item-button');
    await expect(pageItems.first()).toBeVisible();

    await pageItems.first().focus();
    await expect(pageItems.first()).toBeFocused();

    const outlineStyle = await pageItems.first().evaluate((el) => {
      return window.getComputedStyle(el).outlineStyle;
    });
    expect(outlineStyle).not.toBe('none');
  });
});
