import { test, expect } from '@playwright/test';

/**
 * 存在しないページにアクセスした際のエラー表示に関するE2Eテスト。
 *
 * ページが見つからない場合に適切なエラーメッセージとホームへのリンクが
 * 表示されることを検証する。
 */
test.describe('Page Not Found', () => {
  test('should show "ページが見つかりません" for non-existent page', async ({
    page,
  }) => {
    await page.goto('/p/nonexistent123');

    const message = page.getByText('ページが見つかりません');
    await expect(message).toBeVisible({ timeout: 10000 });
  });

  test('should show a link to home page', async ({ page }) => {
    await page.goto('/p/nonexistent123');

    const message = page.getByText('ページが見つかりません');
    await expect(message).toBeVisible({ timeout: 10000 });

    const homeLink = page.getByRole('link', { name: 'ホームに戻る' });
    await expect(homeLink).toBeVisible();
  });

  test('should navigate to home when clicking the home link', async ({
    page,
  }) => {
    await page.goto('/p/nonexistent123');

    const message = page.getByText('ページが見つかりません');
    await expect(message).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: 'ホームに戻る' }).click();
    await page.waitForURL('/');
  });
});
