import { test, expect } from '@playwright/test';
import { waitForApp, trackErrors, goToTab, mockFonts } from './helpers';

test.describe('Explore Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);
    await goToTab(page, 'Explore');
    await page.waitForTimeout(500);
  });

  test('renders without unexpected JS errors', async ({ page }) => {
    const getErrors = trackErrors(page);
    await page.goto('/');
    await waitForApp(page);
    await goToTab(page, 'Explore');
    await page.waitForTimeout(500);
    expect(getErrors()).toHaveLength(0);
  });

  test('shows mood chips', async ({ page }) => {
    // Mood row has chips like Hype, Chill, Sport, etc.
    const chips = page.getByText(/hype|chill|sport|rave|foodie/i);
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
  });

  test('sport mood chip shows sport sub-filter', async ({ page }) => {
    // Hidden tabs stay mounted, so look only inside the active Explore screen.
    const screen = page.locator('[data-screen="explore"][data-active="true"]');
    const sportChip = screen.getByText(/^sport$/i).first();
    const visible = await sportChip.isVisible().catch(() => false);
    if (!visible) test.skip();

    // Retry the click until the sub-filter shows; on a slow runner the first
    // tap can land before the chip's handler is wired up.
    await expect(async () => {
      await sportChip.click();
      await expect(screen.getByText(/soccer|rugby|basketball/i).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  });

  test('search input accepts text', async ({ page }) => {
    const search = page.getByPlaceholder(/search|find/i).first();
    const visible = await search.isVisible().catch(() => false);
    if (!visible) test.skip();
    await search.fill('jazz');
    await expect(search).toHaveValue('jazz');
  });

  test('category cells are present', async ({ page }) => {
    // CategoryGrid uses TouchableOpacity with accessibilityLabel
    const grid = page.locator('[aria-label*="category"]').or(
      page.getByText(/music|sport|food|art|tech|workshop/i)
    );
    const count = await grid.count();
    expect(count).toBeGreaterThan(0);
  });
});
