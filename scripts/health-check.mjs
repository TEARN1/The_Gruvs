/**
 * health-check.mjs — synthetic monitor. Loads the REAL site in a REAL browser
 * and asserts it actually works, the way a user experiences it:
 *
 *   • the page responds
 *   • the app BOOTS (the tab bar renders — not just a 200 on a blank shell)
 *   • content is on screen
 *   • no failing network requests (this is what catches schema drift in prod)
 *   • no CSP violations (a bad header silently breaks the app)
 *   • the PWA is still installable (manifest + service worker) — a deploy that
 *     skips the PWA injection would otherwise break installs invisibly
 *
 * A 200 from the server proves nothing: the bundle can 200 and still render a
 * white screen. This checks the thing that matters.
 *
 * Exit 1 = the live site is broken.
 */
import { chromium } from '@playwright/test';

const SITE = process.env.SITE_URL || 'https://thegruvs.com';
const problems = [];

const browser = await chromium.launch();
const page = await browser.newPage();

const failedRequests = [];
const cspViolations = [];
const jsErrors = [];

page.on('response', r => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().split('?')[0]}`);
});
page.on('console', m => {
  const t = m.text();
  if (/Content Security Policy|Refused to/i.test(t)) cspViolations.push(t.slice(0, 120));
  else if (m.type() === 'error') jsErrors.push(t.slice(0, 100));
});
page.on('pageerror', e => jsErrors.push(String(e).slice(0, 100)));

const res = await page.goto(`${SITE}/?cb=${Date.now()}`, { waitUntil: 'load', timeout: 60000 }).catch(() => null);
if (!res || res.status() >= 400) problems.push(`Site did not load (status ${res ? res.status() : 'no response'})`);

await page.waitForTimeout(14000); // let hydration + the idle prefetch settle

const tabs = await page.locator('[role="tab"]').count();
if (tabs === 0) problems.push('App did not boot — the tab bar never rendered (white screen)');

const textLen = (await page.locator('body').innerText().catch(() => '')).length;
if (textLen < 100) problems.push(`Almost nothing rendered (${textLen} chars of text)`);

const uniqFailed = [...new Set(failedRequests)];
if (uniqFailed.length) problems.push(`Failing requests: ${uniqFailed.join(' | ')}`);
if (cspViolations.length) problems.push(`CSP violations: ${[...new Set(cspViolations)].join(' | ')}`);
if (jsErrors.length) problems.push(`JS errors: ${[...new Set(jsErrors)].join(' | ')}`);

// PWA installability — a deploy that skips inject-pwa breaks installs silently.
const hasManifest = await page.locator('link[rel="manifest"]').count();
if (!hasManifest) problems.push('PWA broken: no <link rel="manifest"> — the app is not installable');

const manifestRes = await page.request.get(`${SITE}/manifest.json`).catch(() => null);
if (!manifestRes || !manifestRes.ok()) problems.push('PWA broken: manifest.json is not served');
const swRes = await page.request.get(`${SITE}/sw.js`).catch(() => null);
if (!swRes || !swRes.ok() || !/javascript/i.test(swRes.headers()['content-type'] || '')) {
  problems.push('PWA broken: sw.js missing or not served as JavaScript');
}

await browser.close();

console.log(`Health check — ${SITE}`);
console.log(`  tabs rendered : ${tabs}`);
console.log(`  text rendered : ${textLen} chars`);
console.log(`  failed reqs   : ${uniqFailed.length}`);
console.log(`  CSP violations: ${cspViolations.length}`);
console.log(`  JS errors     : ${[...new Set(jsErrors)].length}`);

if (!problems.length) {
  console.log('\n✅ Live site is healthy.');
  process.exit(0);
}
console.log(`\n🔴 LIVE SITE IS BROKEN — ${problems.length} problem(s):\n`);
for (const p of problems) {
  console.log(`  • ${p}`);
  console.log(`::error::${p}`);
}
process.exit(1);
