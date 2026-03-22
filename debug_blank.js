const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Capture and print all console logs and errors
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.log(`[BROWSER FATAL ERROR]: ${err.message}`);
    });

    console.log("Navigating to http://localhost:8081...");
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
    
    console.log("Evaluating body content...");
    const rootHtml = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML : 'No #root element found';
    });
    
    console.log("Root element HTML length:", rootHtml.length);
    if (rootHtml.length < 100) {
      console.log("Root HTML is very small:", rootHtml);
    }
    
    await browser.close();
  } catch (e) {
    console.error("Test script failed:", e);
  }
})();
