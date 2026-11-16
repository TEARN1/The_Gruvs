const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const PORT = 8089;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUT_DIRS = [
  path.join(__dirname, '..', 'public', 'images', 'advertising'),
  path.join(__dirname, '..', 'dist', 'images', 'advertising'),
  path.join('C:\\Users\\ACER\\.gemini\\antigravity\\brain\\16cfe07f-63ac-441d-9bd8-e54e184c6d89', 'advertising'),
];

// Ensure directories exist
OUT_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Start static server
const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0].split('#')[0];
  let targetPath = path.join(DIST_DIR, cleanUrl === '/' ? 'index.html' : cleanUrl);

  const serve = (filePath, fallback = false) => {
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        if (!fallback) {
          serve(path.join(DIST_DIR, 'index.html'), true);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
  };

  serve(targetPath);
});

server.listen(PORT, async () => {
  console.log(`[Capture] Static server running at http://localhost:${PORT}`);

  try {
    const browser = await chromium.launch({ headless: true });

    // 1. Mobile Context (iPhone 14 Pro Max / Pixel 7 crisp mobile capture)
    const mobileContext = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    });

    const page = await mobileContext.newPage();

    // Mock fonts and E2E flags for fast clean load
    await page.addInitScript(() => {
      window['__E2E__'] = true;
      try {
        localStorage.setItem('has_seen_onboarding', 'true');
        localStorage.setItem('has_seen_intro', 'true');
        localStorage.setItem('tutorial_seen', 'true');
      } catch (e) {}
    });

    console.log('[Capture] Loading app home page...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(4000); // Wait for React hydration and layout

    // Dismiss any skip/modal if present
    try {
      const skipBtn = page.getByText('SKIP').first();
      if (await skipBtn.isVisible({ timeout: 1500 })) {
        await skipBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {}

    // Screenshot 1: Mobile App Discover / Feed
    console.log('[Capture] Taking Screenshot 1: Mobile Discover Feed...');
    const s1Path = path.join(OUT_DIRS[0], '01-the-gruvs-mobile-discover.png');
    await page.screenshot({ path: s1Path });
    OUT_DIRS.slice(1).forEach(d => fs.copyFileSync(s1Path, path.join(d, '01-the-gruvs-mobile-discover.png')));

    // Screenshot 2: Scroll down to view events grid & lineup
    console.log('[Capture] Scrolling and capturing Event Lineup...');
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);
    const s2Path = path.join(OUT_DIRS[0], '02-the-gruvs-mobile-lineup-events.png');
    await page.screenshot({ path: s2Path });
    OUT_DIRS.slice(1).forEach(d => fs.copyFileSync(s2Path, path.join(d, '02-the-gruvs-mobile-lineup-events.png')));

    // Screenshot 3: Try to switch to Explore / Map or Events Tab
    console.log('[Capture] Navigating to Explore / Map...');
    try {
      const mapTab = page.locator('[role="tab"]').nth(1);
      if (await mapTab.isVisible({ timeout: 2000 })) {
        await mapTab.click();
        await page.waitForTimeout(3000);
        const s3Path = path.join(OUT_DIRS[0], '03-the-gruvs-mobile-map-radar.png');
        await page.screenshot({ path: s3Path });
        OUT_DIRS.slice(1).forEach(d => fs.copyFileSync(s3Path, path.join(d, '03-the-gruvs-mobile-map-radar.png')));
      }
    } catch (e) {
      console.log('[Capture] Tab 1 navigation notice:', e.message);
    }

    // Screenshot 4: Try to switch to Chats / Vibe Up Tab
    console.log('[Capture] Navigating to Chats / Vibe Up...');
    try {
      const chatTab = page.locator('[role="tab"]').nth(2);
      if (await chatTab.isVisible({ timeout: 2000 })) {
        await chatTab.click();
        await page.waitForTimeout(3000);
        const s4Path = path.join(OUT_DIRS[0], '04-the-gruvs-mobile-chats-vibeup.png');
        await page.screenshot({ path: s4Path });
        OUT_DIRS.slice(1).forEach(d => fs.copyFileSync(s4Path, path.join(d, '04-the-gruvs-mobile-chats-vibeup.png')));
      }
    } catch (e) {
      console.log('[Capture] Tab 2 navigation notice:', e.message);
    }

    // 2. Desktop High-Res Showcase Context (1440x900)
    console.log('[Capture] Opening Desktop Context for High-Res Portal Ads...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const dPage = await desktopContext.newPage();
    await dPage.addInitScript(() => {
      window['__E2E__'] = true;
      try {
        localStorage.setItem('has_seen_onboarding', 'true');
        localStorage.setItem('has_seen_intro', 'true');
      } catch (e) {}
    });

    await dPage.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await dPage.waitForTimeout(4000);

    console.log('[Capture] Taking Screenshot 5: Desktop Portal Hero...');
    const s5Path = path.join(OUT_DIRS[0], '05-the-gruvs-desktop-portal-hero.png');
    await dPage.screenshot({ path: s5Path });
    OUT_DIRS.slice(1).forEach(d => fs.copyFileSync(s5Path, path.join(d, '05-the-gruvs-desktop-portal-hero.png')));

    // Screenshot 6: Desktop Services & Hustlers Directory
    console.log('[Capture] Taking Screenshot 6: Services & Marketplace Directory...');
    await dPage.goto(`http://localhost:${PORT}/services`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await dPage.waitForTimeout(2500);
    const s6Path = path.join(OUT_DIRS[0], '06-the-gruvs-services-marketplace.png');
    await dPage.screenshot({ path: s6Path });
    OUT_DIRS.slice(1).forEach(d => fs.copyFileSync(s6Path, path.join(d, '06-the-gruvs-services-marketplace.png')));

    // Screenshot 7: Executive Founder & Ecosystem Hub (/founder)
    console.log('[Capture] Taking Screenshot 7: Founder & Ecosystem Portal...');
    await dPage.goto(`http://localhost:${PORT}/founder`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await dPage.waitForTimeout(2500);
    const s7Path = path.join(OUT_DIRS[0], '07-the-gruvs-founder-ecosystem.png');
    await dPage.screenshot({ path: s7Path });
    OUT_DIRS.slice(1).forEach(d => fs.copyFileSync(s7Path, path.join(d, '07-the-gruvs-founder-ecosystem.png')));

    await browser.close();
    console.log('[Capture] All screenshots captured successfully and saved to:');
    OUT_DIRS.forEach(d => console.log('  -> ' + d));
  } catch (err) {
    console.error('[Capture] Error during capture:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
