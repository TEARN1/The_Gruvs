import { test, expect } from '@playwright/test';
import { waitForApp, mockFonts, expectTabActive } from './helpers';

test.describe('Swipe Navigation E2E Tests', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // narrow viewport

  test('navigates from Feed to Reels using a horizontal swipe gesture', async ({ page }) => {
    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);

    // Assert initial state is Feed by checking for the brand name
    const title = page.getByText(/gruvs/i).first();
    await expect(title).toBeVisible();

    // Verify active tab status on Feed tab
    await expectTabActive(page, 'The Drop');

    // Perform a swipe left gesture (drag from right to left)
    // Start at x=320, y=400, drag to x=50, y=400 (dx = -270, dy = 0)
    await page.mouse.move(320, 400);
    await page.mouse.down();
    await page.mouse.move(50, 400, { steps: 10 });
    await page.mouse.up();

    // Wait for animation transition
    await page.waitForTimeout(600);

    // Verify we transitioned to the Reels tab
    await expectTabActive(page, 'Reels');
  });

  test('does not swipe away when on the Reels tab', async ({ page }) => {
    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);

    // First go to Reels by clicking
    const reelsTab = page.locator('[role="tab"][aria-label="Reels"]');
    await reelsTab.click();
    await page.waitForTimeout(400);
    await expectTabActive(page, 'Reels');

    // Attempt swipe left (should be blocked in Reels page)
    await page.mouse.move(320, 400);
    await page.mouse.down();
    await page.mouse.move(50, 400, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(400);

    // Verify we remain on the Reels tab
    await expectTabActive(page, 'Reels');
  });
});
