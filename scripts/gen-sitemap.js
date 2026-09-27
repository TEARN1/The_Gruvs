/**
 * gen-sitemap.js — writes dist/sitemap.xml with every published upcoming event.
 *
 * Why this exists: the static public/sitemap.xml lists 4 URLs (home, get,
 * privacy, terms). Google had literally nothing else to index, so the events —
 * the only pages anyone actually searches for — were invisible. Event URLs point
 * at /share/event/<id>, which nginx proxies to the og-meta edge function, so a
 * crawler gets real per-event HTML with a canonical back to this domain.
 *
 * Past events are deliberately excluded: a sitemap full of dead nights is a
 * quality signal problem, and they 302 into the SPA anyway.
 *
 * Runs on every build via `npm run postbuild`. Uses the anon key and only reads
 * already-public rows, so it is safe to run anywhere .env is present.
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://thegruvs.com';
const STATIC = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/get.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/privacy.html', changefreq: 'yearly', priority: '0.2' },
  { loc: '/terms.html', changefreq: 'yearly', priority: '0.2' },
];

function readEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const out = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || out.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || out.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function xml(urls) {
  const body = urls
    .map(u => `  <url>\n    <loc>${u.loc}</loc>\n` +
      (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
      `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

(async () => {
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) {
    console.warn('[gen-sitemap] dist/ not found — skipping (run after expo export).');
    return;
  }

  const urls = STATIC.map(s => ({ ...s, loc: `${SITE}${s.loc}` }));
  const { url, key } = readEnv();

  if (!url || !key) {
    console.warn('[gen-sitemap] No Supabase creds — writing static-only sitemap (events will NOT be indexed).');
  } else {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `${url}/rest/v1/events?select=id,updated_at,event_date` +
        `&is_published=eq.true&deleted_at=is.null&event_date=gte.${today}` +
        `&order=event_date.asc&limit=5000`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const events = await res.json();
      for (const e of events) {
        urls.push({
          loc: `${SITE}/share/event/${e.id}`,
          lastmod: (e.updated_at || '').slice(0, 10) || undefined,
          changefreq: 'daily',
          priority: '0.8',
        });
      }
      console.log(`[gen-sitemap] Added ${events.length} upcoming events.`);
    } catch (err) {
      // A sitemap missing events beats a failed build.
      console.warn(`[gen-sitemap] Event fetch failed (${err.message}) — static-only sitemap.`);
    }
  }

  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml(urls));
  console.log(`[gen-sitemap] Wrote dist/sitemap.xml with ${urls.length} URLs.`);
})();
