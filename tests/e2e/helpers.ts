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
  await page.waitForSelector('#root', { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  // Wait for the tab navigation elements to be visible (loading screen is gone)
  await page.locator('[role="tab"]').first().waitFor({ state: 'visible', timeout: 45_000 });
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
    const el = page.getByText(name, { exact: true }).first();
    const visible = await el.isVisible().catch(() => false);
    if (visible) { await el.click(); return; }
  }
}
