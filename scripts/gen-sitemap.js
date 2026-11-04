/**
 * gen-sitemap.js — Advanced Google-optimized Sitemap Generator for The Gruvs.
 *
 * Implements advanced search engine optimization (SEO) best practices:
 * 1. Google Image Sitemap Extension (xmlns:image) for rich image/poster indexing in Google Search & Images.
 * 2. Programmatic City & Genre Hub Indexing:
 *    - Gauteng Metros (Midrand, Johannesburg, Pretoria, Soweto, Tembisa, etc.)
 *    - Music & Vibe categories (Amapiano, Afro-Tech, Nightlife, Festivals)
 *    - Seasonal flagship hub: Ke Dezemba 2026
 * 3. Semantic keyword-rich event URLs (/events/[slug]) alongside canonical share routes.
 * 4. Event proximity priority scoring:
 *    - Events in next 14 days: 0.9 priority, daily changefreq (high urgency)
 *    - Events in 15-45 days: 0.85 priority, daily changefreq
 *    - Events 45+ days out: 0.75 priority, weekly changefreq
 * 5. Strict XML entity escaping preventing indexing parse errors.
 * 6. Dual destination write: public/sitemap.xml (source) + dist/sitemap.xml (build artifact).
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

const HUBS = [
  // Flagship Seasonal
  { loc: '/events/ke-dezemba', changefreq: 'daily', priority: '0.95' },

  // City & Metro Hubs (All 9 Provinces & Major Event Centers)
  { loc: '/events/johannesburg', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/pretoria', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/midrand', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/tembisa', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/soweto', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/centurion', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/sandton', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/rosebank', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/cape-town', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/durban', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/bloemfontein', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/gqeberha', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/polokwane', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/nelspruit', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/rustenburg', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/kimberley', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/pietermaritzburg', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/stellenbosch', changefreq: 'daily', priority: '0.90' },

  // Genre & Vibe Hubs (Major Music & Lifestyle Subcultures)
  { loc: '/events/amapiano', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/afro-tech', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/nightlife', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/festivals', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/food-and-drink', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/lifestyle', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/gqom-and-kwaito', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/live-jazz', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/comedy', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/rooftop-sundowners', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/shisanyama', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/sports-derbies', changefreq: 'daily', priority: '0.90' },

  // Date Horizons
  { loc: '/events/this-weekend', changefreq: 'daily', priority: '0.95' },
  { loc: '/events/nye-2027', changefreq: 'daily', priority: '0.95' },
];

// A hub with no events of its own is built with noindex
// (scripts/build-seo-hubs.js); sending it in the sitemap too would tell Google
// two opposite things. A hub that has not been built yet is kept.
function hubIsIndexable(h) {
  const file = path.join(__dirname, '..', 'public', h.loc.replace(/^\//, ''), 'index.html');
  try {
    return !/<meta name="robots" content="noindex/.test(fs.readFileSync(file, 'utf8'));
  } catch {
    return true;
  }
}

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

function slugify(text, maxLen = 70) {
  if (!text) return '';
  const s = String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen).replace(/-[^-]*$/, '').replace(/-+$/, '');
}

function eventSlug(e) {
  const words = slugify([e.title, e.venue_name, e.city].filter(Boolean).join(' '), 70);
  const cleanId = slugify(e.id || '');
  return words ? `${words}-${cleanId}` : cleanId;
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

  const urls = [
    ...STATIC.map(s => ({ ...s, loc: `${SITE}${s.loc}`, lastmod: today })),
    ...HUBS.filter(hubIsIndexable).map(h => ({ ...h, loc: `${SITE}${h.loc}`, lastmod: today })),
  ];

  const { url, key } = readEnv();

  if (!url || !key) {
    console.warn('[gen-sitemap] No Supabase credentials found — writing static + hub sitemap.');
  } else {
    try {
      const res = await fetch(
        `${url}/rest/v1/events?select=id,title,description,venue_name,city,category,cover_url,cover_image,media_urls,updated_at,event_date,event_time` +
        `&is_published=eq.true&deleted_at=is.null&event_date=gte.${today}` +
        `&order=event_date.asc&limit=5000`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      let events = [];
      if (res.ok) {
        events = await res.json();
      }

      // Merge comprehensive events catalog (3,000+ items)
      const catalogPath = path.join(publicDir, 'data', 'events-catalog.json');
      if (fs.existsSync(catalogPath)) {
        try {
          const catalogEvents = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
          const seenIds = new Set(events.map(e => e.id));
          for (const ce of catalogEvents) {
            if (!seenIds.has(ce.id)) {
              events.push(ce);
              seenIds.add(ce.id);
            }
          }
        } catch {}
      }

      for (const e of events) {
        let priority = '0.75';
        let changefreq = 'weekly';
        if (e.event_date) {
          const evtDate = new Date(`${e.event_date}T00:00:00`);
          const diffDays = Math.ceil((evtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 14) {
            priority = '0.90';
            changefreq = 'daily';
          } else if (diffDays <= 45) {
            priority = '0.85';
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

        const lastmod = (e.updated_at || e.event_date || today).slice(0, 10);
        const slug = eventSlug(e);

        // 1. Semantic slug URL
        urls.push({
          loc: `${SITE}/events/${slug}`,
          lastmod,
          changefreq,
          priority,
          image,
        });

        // 2. Canonical share URL
        urls.push({
          loc: `${SITE}/share/event/${e.id}`,
          lastmod,
          changefreq,
          priority,
          image,
        });
      }

      // 3. Unique Venue Hub URLs
      const venueSet = new Set();
      for (const e of events) {
        if (e.venue_name) {
          const vSlug = slugify(e.venue_name.trim());
          if (vSlug && !venueSet.has(vSlug)) {
            venueSet.add(vSlug);
            urls.push({
              loc: `${SITE}/venues/${vSlug}`,
              lastmod: today,
              changefreq: 'daily',
              priority: '0.88',
            });
          }
        }
      }
      console.log(`[gen-sitemap] Successfully indexed ${events.length} upcoming events and ${venueSet.size} venues with Google Image schema & semantic URLs.`);
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
