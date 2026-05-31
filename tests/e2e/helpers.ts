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
];

/** Wait for Expo's React tree to hydrate */
export async function waitForApp(page: Page) {
  await page.waitForSelector('#root', { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  // Short settle wait for React rendering
  await page.waitForTimeout(800);
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
