/**
 * scripts/profile-android-cpu.js
 * Simulates a mid-to-lower-tier Android device (e.g. 2-4GB RAM, slower CPU, Slow 3G)
 * using Playwright + Chrome DevTools Protocol (CDP).
 *
 * Runs tab transition gestures and profiles rendering frame rates (FPS) and freezes.
 */

const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PORT = 8081;
const TARGET_URL = `http://localhost:${PORT}`;

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(TARGET_URL, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

(async () => {
  console.log('\n📱 Android Low-Spec Emulation Profile Runner');
  console.log('============================================');

  let serverProc = null;
  const isServerRunning = await checkServer();

  if (!isServerRunning) {
    console.log('🚀 Starting static web server on port 8081...');
    serverProc = spawn('node', ['scripts/serve-dist.js'], {
      stdio: 'ignore', // Suppress output to keep profiling logs clean
      detached: false
    });
    // Wait for server to bind
    await new Promise((r) => setTimeout(r, 1500));
  } else {
    console.log('ℹ️ Static web server already running on port 8081.');
  }

  console.log('🌐 Launching Chromium...');
  const browser = await chromium.launch({ headless: true });
  
  // Create context with mobile viewport
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
  });

  const page = await context.newPage();
  
  // Inject font mocking helper
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

  console.log(`🔗 Navigating to ${TARGET_URL}...`);
  // Use a generous timeout for initial web bundle download and parsing
  try {
    await page.goto(TARGET_URL, { timeout: 90000 });
  } catch (e) {
    console.error('❌ Failed to navigate to target URL:', e.message);
    await browser.close();
    if (serverProc) serverProc.kill();
    process.exit(1);
  }

  // Wait for React hydration
  console.log('⏳ Waiting for application hydration...');
  try {
    await page.waitForSelector('#root', { timeout: 45000 });
    await page.locator('[role="tab"]').first().waitFor({ state: 'visible', timeout: 45000 });
  } catch (e) {
    console.error('❌ App failed to load/hydrate in time.', e.message);
    await browser.close();
    if (serverProc) serverProc.kill();
    process.exit(1);
  }

  // 1. Establish CDP Session after the initial load is complete
  let client;
  try {
    client = await context.newCDPSession(page);
    
    // Enable Emulation & Network domains
    await client.send('Emulation.setCPUThrottlingRate', { rate: 6 }); // 6x CPU Slowdown
    await client.send('Network.enable');
    
    // Emulate Slow 3G: ~400ms latency, 400kbps download, 150kbps upload
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400, // ms
      downloadThroughput: (400 * 1024) / 8, // 400 kbps in B/s
      uploadThroughput: (150 * 1024) / 8, // 150 kbps in B/s
    });
    
    console.log('✅ CDP: 6x CPU Throttling and Slow 3G network emulation applied.');
  } catch (err) {
    console.error('❌ Failed to configure CDP emulation:', err.message);
  }


  // 2. Inject FPS & Frame drop counters
  await page.evaluate(() => {
    window.fpsData = {
      frames: [],
      freezes: [],
      startTime: performance.now(),
    };

    let lastTime = performance.now();
    function tick() {
      const now = performance.now();
      const delta = now - lastTime;
      const fps = 1000 / delta;

      window.fpsData.frames.push({
        fps: Math.round(fps),
        delta: Math.round(delta),
        time: Math.round(now)
      });

      if (delta > 100) { // UI freeze longer than 100ms
        window.fpsData.freezes.push({
          duration: Math.round(delta),
          time: Math.round(now)
        });
      }

      lastTime = now;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  console.log('⚡ Running simulated interactions under stress...');

  // Perform horizontal swipe cycles (Simulate Feed <=> Reels)
  for (let cycle = 1; cycle <= 4; cycle++) {
    console.log(`   [Cycle ${cycle}/4] Swiping: Feed -> Reels`);
    // Swipe left (Feed -> Reels)
    await page.mouse.move(320, 400);
    await page.mouse.down();
    await page.mouse.move(50, 400, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600); // Wait for transition animations

    console.log(`   [Cycle ${cycle}/4] Swiping: Reels -> Feed`);
    // Swipe right (Reels -> Feed)
    await page.mouse.move(50, 400);
    await page.mouse.down();
    await page.mouse.move(320, 400, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600); // Wait for transition animations
  }

  // Click tabs to trigger layout updates
  const tabs = ['Explore', 'Lineup', 'Chats', 'The Drop'];
  for (const tabName of tabs) {
    console.log(`   Tapping tab: "${tabName}"`);
    const tabEl = page.locator(`[role="tab"][aria-label="${tabName}"]`).first();
    if (await tabEl.isVisible()) {
      await tabEl.click();
      await page.waitForTimeout(500);
    }
  }

  // 3. Retrieve Performance metrics
  const results = await page.evaluate(() => {
    const frames = window.fpsData.frames;
    const freezes = window.fpsData.freezes;
    
    // Filter out initial load jitters from calculations if necessary
    const validFrames = frames.filter(f => f.time > 1000); 
    const totalDeltas = validFrames.reduce((acc, f) => acc + f.delta, 0);
    
    const averageFPS = validFrames.length > 0
      ? Math.round((validFrames.length / (totalDeltas / 1000)) * 10) / 10
      : 0;

    const frameDrops = validFrames.filter(f => f.fps < 30).length;

    return {
      averageFPS,
      totalFrames: validFrames.length,
      frameDrops,
      freezes,
    };
  });

  console.log('\n📊 PERFORMANCE EMULATION RESULTS');
  console.log('============================================');
  console.log(`  Emulated CPU Slowdown : 6x`);
  console.log(`  Emulated Network      : Slow 3G`);
  console.log(`  Total Frames Rendered : ${results.totalFrames}`);
  console.log(`  Average Frame Rate    : ${results.averageFPS} FPS`);
  console.log(`  Frame Drops (<30 FPS) : ${results.frameDrops}`);
  console.log(`  UI Freezes (>100ms)   : ${results.freezes.length}`);
  
  if (results.freezes.length > 0) {
    console.log('\n🚨 Freeze Details:');
    results.freezes.forEach((f, idx) => {
      console.log(`   - Freeze #${idx + 1}: ${f.duration}ms at timestamp ${f.time}ms`);
    });
  }

  // Cleanup
  console.log('\n🧹 Cleaning up browser and server...');
  await browser.close();

  if (serverProc) {
    serverProc.kill();
    console.log('✅ Server stopped.');
  }

  console.log('============================================');
  if (results.averageFPS < 20) {
    console.warn('⚠️ WARNING: Performance is critically low (<20 FPS) on emulated hardware.');
  } else {
    console.log('🎉 SUCCESS: Performance is acceptable under low-spec conditions.');
  }
})();
