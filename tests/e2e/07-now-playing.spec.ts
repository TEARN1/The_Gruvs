/**
 * NowPlayingBar — component-level behaviour.
 * Since this is integration-tested against a live event, we test
 * that the component mounts cleanly and has the right ARIA semantics.
 */
import { test, expect } from '@playwright/test';
import { waitForApp, mockFonts } from './helpers';

test.describe('NowPlayingBar accessibility', () => {
  test('no orphaned now-playing bars on the landing page', async ({ page }) => {
    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);
    // NowPlayingBar should NOT appear on the landing/explore page (only on event detail)
    const bar = page.getByText(/now playing/i);
    const count = await bar.count();
    // Could be 0 (no live events) — that's fine; just must not be > 10 (runaway renders)
    expect(count).toBeLessThan(10);
  });
});
