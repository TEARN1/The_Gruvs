// Renders master-spec-v2.5.html to The_Gruvs_Master_Spec_v2.5.pdf with the
// Chromium that ships with Playwright. Run: node docs/master-spec/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(dir, 'master-spec-v2.5.html');
const out = path.join(dir, 'The_Gruvs_Master_Spec_v2.5.pdf');

import fs from 'node:fs';
// Use Playwright's own browser if its version is installed; otherwise fall back
// to the preinstalled Chromium (cloud sessions pin a different Playwright).
const launch = { headless: true };
const own = chromium.executablePath();
if (!fs.existsSync(own)) launch.executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(launch);
const page = await browser.newPage();
await page.goto(pathToFileURL(src).href, { waitUntil: 'load' });
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-family:'Liberation Sans',sans-serif;font-size:7.5pt;color:#64748b;padding:0 15mm;display:flex;justify-content:space-between">
    <span>The Gruvs · Master Specification v2.5 · 5 October 2026</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
});
await browser.close();
console.log('wrote', out);
