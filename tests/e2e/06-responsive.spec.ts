/**
 * Responsive tests — checks layout at different viewports.
 * Screenshot baseline: run `npm test -- --update-snapshots` once to create.
 */
import { test, expect } from '@playwright/test';
import { waitForApp, mockFonts } from './helpers';

// React Native Web often uses overflow:hidden on the root to handle its own scroll
// so we check the root container rather than the document
async function getContentOverflow(page: any) {
  return page.evaluate(() => {
    const root = document.querySelector('#root') as HTMLElement;
    if (!root) return 0;
    return root.scrollWidth - root.clientWidth;
  });
}

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Viewport: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('landing page renders', async ({ page }) => {
      await mockFonts(page);
      await page.goto('/');
      await waitForApp(page);
      const childCount = await page.evaluate(() =>
        document.querySelector('#root')?.children.length ?? 0
      );
      expect(childCount).toBeGreaterThan(0);
    });

    test('landing page screenshot baseline', async ({ page }) => {
      await mockFonts(page);
      await page.goto('/');
      await waitForApp(page);
      // First run writes the baseline; subsequent runs compare
      await expect(page).toHaveScreenshot(`landing-${vp.name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.08,
        timeout: 15_000,
      });
    });
  });
}
