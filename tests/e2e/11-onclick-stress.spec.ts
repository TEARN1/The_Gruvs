import { test, expect } from '@playwright/test';
import { waitForApp, trackErrors, goToTab, mockFonts, activeScreen } from './helpers';

test.describe('Onclick & Interaction Crash Audit', () => {
  test.beforeEach(async ({ page }) => {
    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);
  });

  test('tapping tabs does not trigger unhandled exceptions', async ({ page }) => {
    const getErrors = trackErrors(page);

    const tabs = ['Explore', 'Map', 'Linked Up', 'Vibe Card', 'The Drop'];
    for (const tabName of tabs) {
      await goToTab(page, tabName);
      await page.waitForTimeout(400);
      expect(getErrors()).toHaveLength(0);
    }
  });

  test('tapping mood filter chips on Explore does not crash', async ({ page }) => {
    const getErrors = trackErrors(page);
    await goToTab(page, 'Explore');
    await page.waitForTimeout(500);

    const screen = page.locator('[data-screen="explore"][data-active="true"]');
    const moodChips = screen.locator('[role="radio"]');
    const count = await moodChips.count();

    // Tap first 5 mood chips
    for (let i = 0; i < Math.min(count, 5); i++) {
      const chip = moodChips.nth(i);
      if (await chip.isVisible().catch(() => false)) {
        await chip.click();
        await page.waitForTimeout(250);
      }
    }
    expect(getErrors()).toHaveLength(0);
  });

  test('tapping category buttons on Explore does not crash', async ({ page }) => {
    const getErrors = trackErrors(page);
    await goToTab(page, 'Explore');
    await page.waitForTimeout(500);

    const screen = page.locator('[data-screen="explore"][data-active="true"]');
    const catButtons = screen.locator('[aria-label*="category"]');
    const count = await catButtons.count();

    // Tap first 4 category buttons
    for (let i = 0; i < Math.min(count, 4); i++) {
      const btn = catButtons.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(250);
      }
    }
    expect(getErrors()).toHaveLength(0);
  });

  test('tapping action buttons on Landing Page does not crash', async ({ page }) => {
    const getErrors = trackErrors(page);
    await goToTab(page, 'The Drop');
    await page.waitForTimeout(500);

    // Test bookmark buttons
    const bookmarkBtns = page.locator('[aria-label*="Bookmark event"]');
    const bookmarkCount = await bookmarkBtns.count();
    if (bookmarkCount > 0) {
      await bookmarkBtns.first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // Test react buttons
    const reactBtns = page.locator('[aria-label*="React to this event"]');
    const reactCount = await reactBtns.count();
    if (reactCount > 0) {
      await reactBtns.first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // Test vibe buttons
    const vibeBtns = page.locator('[aria-label*="Vibe this event"]');
    const vibeCount = await vibeBtns.count();
    if (vibeCount > 0) {
      await vibeBtns.first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    expect(getErrors()).toHaveLength(0);
  });

  test('tapping theme toggle and utility buttons does not crash', async ({ page }) => {
    const getErrors = trackErrors(page);

    // Theme toggle button in sidebar / header if present
    const themeBtn = page.locator('[aria-label*="theme"], [aria-label*="Mode"]').first();
    if (await themeBtn.isVisible().catch(() => false)) {
      await themeBtn.click().catch(() => {});
      await page.waitForTimeout(300);
    }

    expect(getErrors()).toHaveLength(0);
  });
});
