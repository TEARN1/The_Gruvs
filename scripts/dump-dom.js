const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8081');
  await page.waitForSelector('#root', { timeout: 10000 });
  await page.waitForTimeout(2000); // Wait for hydration
  
  // Dump the HTML of the tab container
  const tabsHTML = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    return tabs.map(t => ({
      outerHTML: t.outerHTML,
      role: t.getAttribute('role'),
      ariaSelected: t.getAttribute('aria-selected'),
      ariaLabel: t.getAttribute('aria-label'),
      textContent: t.textContent
    }));
  });

  console.log('Tabs DOM info:', JSON.stringify(tabsHTML, null, 2));

  await browser.close();
})();
