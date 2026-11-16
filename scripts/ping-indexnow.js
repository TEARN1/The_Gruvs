/**
 * ping-indexnow.js - Real-time Search Engine Submission via IndexNow Protocol
 *
 * Submits published URLs directly to IndexNow (Bing, Yandex, Seznam, Naver)
 * so search engines index updated and new events immediately without waiting
 * for scheduled crawl cycles.
 */

const fs = require('fs');
const path = require('path');

const HOST = 'thegruvs.com';
const KEY = 'c035e4d2bf8b4ecf8f30740a6b5790be';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

// Ensure verification text file exists in public/
const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, `${KEY}.txt`), KEY);

const sitemapPath = path.join(publicDir, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  console.log('[IndexNow] No sitemap.xml found. Skipping IndexNow ping.');
  process.exit(0);
}

const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
const matches = sitemapXml.match(/<loc>(https:\/\/[^<]+)<\/loc>/g);

if (!matches || matches.length === 0) {
  console.log('[IndexNow] No URLs found in sitemap.xml.');
  process.exit(0);
}

const urlList = matches
  .map(m => m.replace(/<\/?loc>/g, '').trim())
  .filter(u => u.startsWith(`https://${HOST}`))
  .slice(0, 10000); // IndexNow max batch size is 10,000

console.log(`[IndexNow] Preparing to submit ${urlList.length} URLs to IndexNow API...`);

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: urlList,
};

(async () => {
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`[IndexNow] Successfully submitted ${urlList.length} URLs! Status: ${res.status}`);
    } else {
      console.log(`[IndexNow] API responded with status ${res.status}: ${res.statusText}`);
    }
  } catch (err) {
    console.warn('[IndexNow] Ping failed (network or offline):', err.message);
  }
})();
