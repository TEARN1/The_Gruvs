/**
 * gen-sitemap.js — Advanced Google-optimized Sitemap Generator for The Gruvs.
 *
 * Implements advanced search engine optimization (SEO) best practices:
 * 1. Google Image Sitemap Extension (xmlns:image) for rich image/poster indexing in Google Search & Images.
 * 2. Strict XML sanitization preventing indexing parse errors.
 * 3. Event lifecycle priority scoring:
 *    - Events in next 14 days: 0.9 priority, daily changefreq (high urgency)
 *    - Events in 15-45 days: 0.8 priority, daily changefreq
 *    - Events 45+ days out: 0.7 priority, weekly changefreq
 * 4. Dual destination write: public/sitemap.xml (source) + dist/sitemap.xml (build artifact).
 * 5. Automatic inclusion of core SPA hubs, PWA/legal endpoints, and upcoming published events.
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://thegruvs.com';

const STATIC = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/get.html', changefreq: 'weekly', priority: '0.7' },
  { loc: '/privacy.html', changefreq: 'yearly', priority: '0.2' },
  { loc: '/terms.html', changefreq: 'yearly', priority: '0.2' },
  { loc: '/account-deletion.html', changefreq: 'yearly', priority: '0.2' },
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

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXml(entries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  for (const entry of entries) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) {
      lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    }
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    lines.push(`    <priority>${entry.priority}</priority>`);

    if (entry.image) {
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${escapeXml(entry.image.loc)}</image:loc>`);
      if (entry.image.title) {
        lines.push(`      <image:title>${escapeXml(entry.image.title)}</image:title>`);
      }
      if (entry.image.caption) {
        lines.push(`      <image:caption>${escapeXml(entry.image.caption)}</image:caption>`);
      }
      lines.push('    </image:image>');
    }
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  lines.push('');
  return lines.join('\n');
}

(async () => {
  const distDir = path.join(__dirname, '..', 'dist');
  const publicDir = path.join(__dirname, '..', 'public');
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const urls = STATIC.map(s => ({
    ...s,
    loc: `${SITE}${s.loc}`,
    lastmod: today,
  }));

  const { url, key } = readEnv();

  if (!url || !key) {
    console.warn('[gen-sitemap] No Supabase credentials found — writing static-only sitemap.');
  } else {
    try {
      const res = await fetch(
        `${url}/rest/v1/events?select=id,title,description,venue_name,city,category,cover_url,cover_image,media_urls,updated_at,event_date,event_time` +
        `&is_published=eq.true&deleted_at=is.null&event_date=gte.${today}` +
        `&order=event_date.asc&limit=5000`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const events = await res.json();

      for (const e of events) {
        let priority = '0.7';
        let changefreq = 'weekly';
        if (e.event_date) {
          const evtDate = new Date(`${e.event_date}T00:00:00`);
          const diffDays = Math.ceil((evtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 14) {
            priority = '0.9';
            changefreq = 'daily';
          } else if (diffDays <= 45) {
            priority = '0.8';
            changefreq = 'daily';
          }
        }

        const cover = e.cover_url || e.cover_image || (Array.isArray(e.media_urls) && e.media_urls[0]);
        let image;
        if (cover && /^https?:\/\//.test(cover)) {
          const caption = [e.venue_name, e.city, e.category].filter(Boolean).join(' · ');
          image = {
            loc: cover,
            title: e.title,
            caption: caption || undefined,
          };
        }

        urls.push({
          loc: `${SITE}/share/event/${e.id}`,
          lastmod: (e.updated_at || e.event_date || today).slice(0, 10),
          changefreq,
          priority,
          image,
        });
      }
      console.log(`[gen-sitemap] Successfully indexed ${events.length} upcoming events with Google Image schema.`);
    } catch (err) {
      console.warn(`[gen-sitemap] Event fetch failed (${err.message}) — writing static sitemap.`);
    }
  }

  const sitemapXml = buildXml(urls);

  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
    console.log(`[gen-sitemap] Wrote public/sitemap.xml with ${urls.length} URLs.`);
  }

  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
    console.log(`[gen-sitemap] Wrote dist/sitemap.xml with ${urls.length} URLs.`);
  }
})();
