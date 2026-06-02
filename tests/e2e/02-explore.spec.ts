import { test, expect } from '@playwright/test';
import { waitForApp, trackErrors, goToTab } from './helpers';

test.describe('Explore Page', () => {
  test.beforeEach(async ({ page }) => {
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
    const sportChip = page.getByText(/^sport$/i).first();
    const visible = await sportChip.isVisible().catch(() => false);
    if (!visible) test.skip();

    await sportChip.click();
    await page.waitForTimeout(500);
    // After clicking Sport mood, soccer/rugby chips should appear
    const subFilter = page.getByText(/soccer|rugby|basketball/i).first();
    await expect(subFilter).toBeVisible({ timeout: 5_000 });
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
