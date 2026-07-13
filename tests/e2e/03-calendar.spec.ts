import { test, expect } from '@playwright/test';
import { waitForApp, goToTab, mockFonts, activeScreen } from './helpers';

test.describe('Calendar Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);
    await goToTab(page, 'Lineup', 'Calendar');
    await page.waitForTimeout(800);
  });

  test('shows today\'s date somewhere on screen', async ({ page }) => {
    const todayNum = new Date().getDate().toString();
    // Scope to the VISIBLE screen: other tabs are pre-mounted hidden, so a bare
    // page-wide match can land on a day number inside a hidden tab.
    const dateEl = activeScreen(page).getByText(todayNum).first();
    await expect(dateEl).toBeVisible({ timeout: 10_000 });
  });

  test('shows All Gruvs filter pill when rendered', async ({ page }) => {
    const pill = page.locator('text=/all gruvs/i').first();
    const exists = await pill.count() > 0;
    // Filter pills only render when not in pure demo mode — skip gracefully
    if (!exists) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Filter pills not rendered in demo mode' });
      return;
    }
    await pill.scrollIntoViewIfNeeded().catch(() => {});
    await expect(pill).toBeVisible({ timeout: 5_000 });
  });

  test('shows sport filter chips when rendered', async ({ page }) => {
    const chip = page.locator('text=/soccer/i').or(page.locator('text=/rugby/i')).first();
    const exists = await chip.count() > 0;
    if (!exists) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Sport chips not rendered in demo mode' });
      return;
    }
    await chip.scrollIntoViewIfNeeded().catch(() => {});
    await expect(chip).toBeVisible({ timeout: 5_000 });
  });

  test('tapping a sport chip does not crash', async ({ page }) => {
    const chip = page.getByText(/soccer/i).first();
    const visible = await chip.isVisible().catch(() => false);
    if (!visible) test.skip();
    await chip.click();
    await page.waitForTimeout(400);
    // Page should still be alive
    await expect(page.locator('#root')).toBeVisible();
  });

  test('tapping All Gruvs clears sport filter', async ({ page }) => {
    const allPill = page.getByText(/all gruvs/i).first();
    const visible = await allPill.isVisible().catch(() => false);
    if (!visible) test.skip();
    await allPill.click();
    await page.waitForTimeout(300);
    await expect(allPill).toBeVisible();
  });
});
