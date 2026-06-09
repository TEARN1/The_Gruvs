import { test, expect } from '@playwright/test';
import { waitForApp, mockFonts } from './helpers';

test.describe('E2E Performance & Heap Stress Tests', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // narrow mobile viewport

  test('profiles aggressive UI actions, heap memory, and UI frame freezes', async ({ page }) => {
    // 1. Hook up CDP session to force garbage collection for clean memory leak tracking
    let client;
    try {
      client = await page.context().newCDPSession(page);
      await client.send('HeapProfiler.enable');
    } catch (e) {
      console.warn('CDP HeapProfiler not supported or failed to enable:', e.message);
    }

    await mockFonts(page);
    await page.goto('/');
    await waitForApp(page);

    // 2. Inject performance frame tracking script into the window
    await page.evaluate(() => {
      (window as any).fpsDrops = [];
      (window as any).freezes = [];
      let lastTime = performance.now();

      function trackFrame() {
        const now = performance.now();
        const delta = now - lastTime;
        const fps = 1000 / delta;

        if (fps < 30 && delta > 0) {
          (window as any).fpsDrops.push({ fps: Math.round(fps), time: Math.round(now) });
        }
        if (delta > 150) { // UI freeze longer than 150ms
          (window as any).freezes.push({ duration: Math.round(delta), time: Math.round(now) });
        }

        lastTime = now;
        requestAnimationFrame(trackFrame);
      }
      requestAnimationFrame(trackFrame);
    });

    // 3. Helper to measure heap size
    const getHeapSize = async (): Promise<number> => {
      if (client) {
        try {
          await client.send('HeapProfiler.collectGarbage');
        } catch {}
      }
      return page.evaluate(() => {
        return (window.performance && (window.performance as any).memory)
          ? (window.performance as any).memory.usedJSHeapSize
          : 0;
      });
    };

    const initialHeap = await getHeapSize();
    console.log(`Initial Heap Memory: ${Math.round(initialHeap / 1024 / 1024 * 10) / 10} MB`);

    // 4. Act: Aggressive horizontal tab swiping cycle
    console.log('Performing 10 aggressive tab swiping navigations...');
    for (let i = 0; i < 5; i++) {
      // Swipe Left (Feed -> Reels)
      await page.mouse.move(300, 400);
      await page.mouse.down();
      await page.mouse.move(50, 400, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(100);

      // Swipe Right (Reels -> Feed)
      // Note: swipe right is allowed from Reels back to Feed
      await page.mouse.move(50, 400);
      await page.mouse.down();
      await page.mouse.move(300, 400, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }

    // 5. Act: Cycle through opening and closing modals (e.g. AuthModal)
    console.log('Cycling AuthModal open and close 5 times to check for rendering memory leaks...');
    const userTab = page.locator('[role="tab"][aria-label="Vibe Card"]');
    await userTab.click();
    await page.waitForTimeout(400);

    for (let i = 0; i < 5; i++) {
      // Tap on Vibe Card profile screen triggers AuthModal if not signed in
      const signInBtn = page.getByText('Sign In', { exact: true }).first();
      if (await signInBtn.isVisible()) {
        await signInBtn.click();
        await page.waitForTimeout(200);

        // Close AuthModal
        const closeBtn = page.locator('accessibilityLabel=Close modal').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(200);
        } else {
          // Alternative close: click outside or press escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        }
      }
    }

    // 6. Assert: Analyze heap memory growth
    const finalHeap = await getHeapSize();
    console.log(`Final Heap Memory: ${Math.round(finalHeap / 1024 / 1024 * 10) / 10} MB`);

    if (initialHeap > 0 && finalHeap > 0) {
      const leakRatio = finalHeap / initialHeap;
      console.log(`Memory growth factor: ${leakRatio.toFixed(2)}x`);
      // Alert if heap size grows by more than 50% under standard actions (potential memory leak)
      if (leakRatio > 1.5) {
        console.warn(`⚠️ High memory growth detected (${leakRatio.toFixed(2)}x). Investigate lifecycle unmount listeners.`);
      }
      expect(leakRatio).toBeLessThan(2.0); // Fail test if memory doubles (major leak)
    }

    // 7. Assert: Retrieve and check FPS drop logs and freezes
    const { drops, freezes } = await page.evaluate(() => {
      return {
        drops: (window as any).fpsDrops || [],
        freezes: (window as any).freezes || [],
      };
    });

    console.log(`Frame Rate Drops (<30fps) Count: ${drops.length}`);
    console.log(`UI Freezes (>150ms) Count: ${freezes.length}`);

    if (freezes.length > 0) {
      console.warn('Detected UI Freezes:', freezes);
    }
    expect(freezes.length).toBeLessThan(30); // Fail if app freezes excessively
  });
});
