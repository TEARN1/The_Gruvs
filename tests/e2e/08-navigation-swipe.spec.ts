import { test, expect } from '@playwright/test';
import { waitForApp, mockFonts, expectTabActive } from './helpers';

test.describe('Swipe Navigation E2E Tests', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // narrow viewport

  test('navigates from Feed to Reels using a horizontal swipe gesture', async ({ page }, testInfo) => {
    // Skip on mobile-chrome: Playwright's touch emulation (Pixel 7) doesn't propagate
    // synthetic mouse drags through React Native Web's PanResponder gesture system.
    // This is a Playwright limitation, not an app bug.
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
      return;
    }

    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);

    // The Focus Cut parks Reels (launchConfig: HIDDEN_TABS = ['reels']), so there
    // is no Reels tab to swipe to — this asserts a surface that deliberately does
    // not exist. Skip while it's parked; the moment Reels is un-parked the tab
    // reappears and these tests run again on their own.
    if ((await page.getByRole('tab', { name: /reels/i }).count()) === 0) {
      testInfo.annotations.push({
        type: 'skip-reason',
        description: 'Reels tab is parked by the Focus Cut (HIDDEN_TABS) — nothing to swipe to.',
      });
      test.skip();
      return;
    }

    // Assert initial state is Feed by checking for the brand name
    const title = page.getByText(/gruvs/i).first();
    await expect(title).toBeVisible();

    // Verify active tab status on Feed tab
    await expectTabActive(page, 'The Drop');

    // Perform a swipe left gesture (drag from right to left)
    await page.mouse.move(320, 400);
    await page.mouse.down();
    await page.mouse.move(50, 400, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    // Verify we transitioned to the correct tab (Reels if enabled, otherwise Explore)
    const hasReels = await page.locator('[role="tab"][aria-label="Reels"]').count().then(c => c > 0);
    if (hasReels) {
      await expectTabActive(page, 'Reels');
    } else {
      await expectTabActive(page, 'Explore');
    }
  });

  test('does not swipe away when on the Reels tab', async ({ page }, testInfo) => {
    // Skip on mobile-chrome for the same reason as above
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
      return;
    }

    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);

    // The Focus Cut parks Reels (launchConfig: HIDDEN_TABS = ['reels']), so there
    // is no Reels tab to swipe to — this asserts a surface that deliberately does
    // not exist. Skip while it's parked; the moment Reels is un-parked the tab
    // reappears and these tests run again on their own.
    if ((await page.getByRole('tab', { name: /reels/i }).count()) === 0) {
      testInfo.annotations.push({
        type: 'skip-reason',
        description: 'Reels tab is parked by the Focus Cut (HIDDEN_TABS) — nothing to swipe to.',
      });
      test.skip();
      return;
    }

    // First check if Reels tab is available in minimal launch mode
    const reelsTab = page.locator('[role="tab"][aria-label="Reels"]');
    const hasReels = await reelsTab.count().then(c => c > 0);
    if (!hasReels) {
      console.log('Skipping Reels swipe test: Reels tab is hidden in minimal mode.');
      return;
    }

    await reelsTab.click();
    await page.waitForTimeout(400);
    await expectTabActive(page, 'Reels');

    // Attempt swipe left (should be blocked in Reels page)
    await page.mouse.move(320, 400);
    await page.mouse.down();
    await page.mouse.move(50, 400, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    // Verify we remain on the Reels tab
    await expectTabActive(page, 'Reels');
  });
});
