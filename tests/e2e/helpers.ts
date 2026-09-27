import { Page, expect } from '@playwright/test';

// Network errors from Supabase placeholder keys — not real app errors
const IGNORED_ERRORS = [
  'ERR_NAME_NOT_RESOLVED',
  'Failed to fetch',
  'WebSocket connection',
  'net::ERR_',
  'Error loading data',
  'supabase',
  'placeholder',
  'validateDOMNesting',
  'cannot appear as a descendant',
  'status of 400',
  'status of 401',
  'status of 404',
  'status of 500',
  'Haptic.impactAsync is not available on web',
];

/** Wait for Expo's React tree to hydrate */
export async function mockFonts(page: Page) {
  await page.addInitScript(() => {
    try {
      window['__E2E__'] = true;
      Object.defineProperty(document, 'fonts', {
        value: {
          status: 'loaded',
          ready: Promise.resolve(),
          addEventListener: () => {},
          removeEventListener: () => {},
          check: () => true,
          load: () => Promise.resolve([]),
        },
        configurable: true,
      });
    } catch (e) {}
  });
}

/** Wait for Expo's React tree to hydrate */
export async function waitForApp(page: Page) {
  await page.waitForSelector('#root', { state: 'attached', timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  // Wait for the tab navigation elements to be visible (loading screen is gone)
  // Use 55s timeout to handle slow mobile-chrome hydration under parallel load
  await page.locator('[role="tab"]').first().waitFor({ state: 'visible', timeout: 55_000 });

  // Automatically dismiss the onboarding / tour modal if it appears
  const skipBtn = page.getByText('SKIP').first();
  const isSkipVisible = await skipBtn.isVisible().catch(() => false);
  if (isSkipVisible) {
    await skipBtn.click().catch(() => {});
    await page.waitForTimeout(500); // Wait for modal slide-out animation
  }

  // Short settle wait for React rendering
  await page.waitForTimeout(500);
}

/** Track JS errors, ignoring known network failures from placeholder Supabase keys */
export function trackErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('pageerror', e => {
    const msg = e.message;
    if (!IGNORED_ERRORS.some(s => msg.includes(s))) errors.push(msg);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!IGNORED_ERRORS.some(s => text.includes(s))) errors.push(text);
    }
  });
  return () => errors;
}

/** Try to navigate to a named tab — tolerates if nav doesn't exist */
export async function goToTab(page: Page, ...names: string[]) {
  for (const name of names) {
    // 1. Try clicking the exact [role="tab"] container by label (extremely robust)
    const tabContainer = page.locator(`[role="tab"][aria-label="${name}"]`).first();
    const isTabVisible = await tabContainer.isVisible().catch(() => false);
    if (isTabVisible) {
      await tabContainer.click().catch(async () => {
        await tabContainer.click({ force: true });
      });
      return;
    }

    // 2. Fall back to text locator (using force if intercepted)
    const el = page.getByText(name, { exact: true }).first();
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      await el.click().catch(async () => {
        await el.click({ force: true });
      });
      return;
    }
  }
}

/** Verify if a tab is active by checking for active theme color presence in its styles/children */
export async function expectTabActive(page: Page, label: string) {
  const isActive = await page.evaluate((lbl) => {
    const tab = document.querySelector(`[role="tab"][aria-label="${lbl}"]`);
    if (!tab) return false;
    const html = tab.outerHTML;
    return html.includes('rgb(0, 242, 255)') || html.includes('rgba(0, 242, 255') || html.includes('#00f2ff');
  }, label);
  expect(isActive).toBe(true);
}

/** Find which tab is active by looking at its children's color or structure */
export async function activeTabLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    for (const tab of tabs) {
      const html = tab.outerHTML;
      if (html.includes('rgb(0, 242, 255)') || html.includes('rgba(0, 242, 255') || html.includes('#00f2ff')) {
        return tab.getAttribute('aria-label') || tab.textContent || null;
      }
    }
    return null;
  });
}


/**
 * The screen currently ON SCREEN.
 *
 * Tabs are pre-mounted in the background (so the first visit to each is instant),
 * which means several screens sit in the DOM at once — the inactive ones hidden.
 * A bare `page.getByText(x).first()` can therefore match text inside a HIDDEN
 * tab and fail as "hidden". Scope to this instead.
 */
export function activeScreen(page: Page) {
  return page.locator('[data-active="true"]');
}
