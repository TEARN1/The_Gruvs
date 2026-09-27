import { test, expect } from '@playwright/test';
import { waitForApp, goToTab, mockFonts } from './helpers';

test.describe('Notifications Screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);
    await goToTab(page, 'Pings', 'Notifications');
    await page.waitForTimeout(500);
  });

  test('notifications screen renders without crash', async ({ page }) => {
    await expect(page.locator('#root')).toBeVisible({ timeout: 10_000 });
    // Shouldn't show a blank white screen
    const bodyBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    expect(bodyBg).not.toBe('rgb(255, 255, 255)');
  });

  test('shows some visible text content', async ({ page }) => {
    // Screen renders something — any visible text is a pass (unauthenticated empty state)
    const anyText = page.locator('text=/./').first();
    await expect(anyText).toBeVisible({ timeout: 10_000 });
  });
});
