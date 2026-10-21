/**
 * Bottom nav bar: the highlight bubble must sit under the active tab and never
 * leave the bar. A bubble placed past the bar's right edge (it happened on
 * "Vibe Card") made the page wider than the screen, so phones zoomed the whole
 * app out and showed a white strip down the side.
 */
import { test, expect } from '@playwright/test';
import { waitForApp, mockFonts } from './helpers';

for (const width of [320, 390, 412]) {
  test(`nav bubble stays under the active tab at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);

    const tabs = page.locator('[role="tab"]').filter({ visible: true });
    const count = await tabs.count();
    test.skip(count < 2, 'bottom bar not shown at this width');

    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(900); // spring settles

      const r = await tabs.nth(i).evaluate((tab) => {
        const bar = tab.parentElement as HTMLElement;
        const bubble = bar.firstElementChild as HTMLElement; // rendered before the tabs
        const b = bar.getBoundingClientRect();
        const u = bubble.getBoundingClientRect();
        const t = tab.getBoundingClientRect();
        return {
          inside: u.left >= b.left - 1 && u.right <= b.right + 1,
          underTab: u.left < t.left + t.width / 2 && u.right > t.left + t.width / 2,
          pageWider: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      expect(r.inside, `bubble leaves the bar on tab ${i}`).toBe(true);
      expect(r.underTab, `bubble not under tab ${i}`).toBe(true);
      expect(r.pageWider, `page wider than the screen on tab ${i}`).toBe(false);
    }
  });
}
