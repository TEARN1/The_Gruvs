import { test, expect } from '@playwright/test';
import { waitForApp, trackErrors } from './helpers';

test.describe('Landing Page', () => {
  test('loads without unexpected JS errors', async ({ page }) => {
    const getErrors = trackErrors(page);
    await page.goto('/');
    await waitForApp(page);
    expect(getErrors()).toHaveLength(0);
  });

  test('renders visible content', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    // Root div must have children — page is not blank
    const childCount = await page.evaluate(() =>
      document.querySelector('#root')?.children.length ?? 0
    );
    expect(childCount).toBeGreaterThan(0);
  });

  test('shows the Gruvs brand name', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    const brand = page.getByText(/gruvs/i).first();
    await expect(brand).toBeVisible({ timeout: 10_000 });
  });

  test('page title is set', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await expect(page).toHaveTitle(/.+/);
  });

  test('has at least one interactive element', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    // React Native Web renders TouchableOpacity as divs with role=button or no role
    const interactive = page.locator('[role="button"], button, [tabindex="0"]');
    const count = await interactive.count();
    expect(count).toBeGreaterThan(0);
  });
});
