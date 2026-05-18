const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2' });
  
  // Wait a few seconds to let React render and crash if it's going to
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await browser.close();
})();
