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
  {
    loc: '/',
    changefreq: 'daily',
    priority: '1.0',
    images: [
      { loc: `${SITE}/icon-512.png`, title: 'The Gruvs App Icon', caption: 'The Gruvs app icon' },
      { loc: `${SITE}/logo.png`, title: 'The Gruvs Brand Logo', caption: 'The Gruvs logo' },
      { loc: `${SITE}/images/the-gruvs-app-launch-preview.jpg`, title: 'The Gruvs Mobile Platform', caption: 'Live Vibe Mapping and Discovery' },
      { loc: `${SITE}/images/the-resident-crew-preview.jpg`, title: 'The Resident Crew Ecosystem', caption: 'Accommodation Near Event Venues' },
      { loc: `${SITE}/images/excellency-academy-preview.jpg`, title: 'Excellency Academy Ecosystem', caption: 'Student Life and Community' },
      { loc: `${SITE}/images/advertising/01-the-gruvs-mobile-discover.png`, title: 'The Gruvs Discover Feed', caption: 'Mobile App Discover Interface' },
      { loc: `${SITE}/images/advertising/02-the-gruvs-mobile-lineup-events.png`, title: 'The Gruvs Event Lineup', caption: 'Mobile Event Cards and Ticketing' },
      { loc: `${SITE}/images/advertising/03-the-gruvs-mobile-map-radar.png`, title: 'The Gruvs Live Map Radar', caption: 'Interactive Venue & Nightlife Radar' },
      { loc: `${SITE}/images/advertising/04-the-gruvs-mobile-chats-vibeup.png`, title: 'The Gruvs Vibe Up Chat', caption: 'Direct Messaging and Crew Coordination' },
      { loc: `${SITE}/images/advertising/05-the-gruvs-desktop-portal-hero.png`, title: 'The Gruvs Desktop Portal', caption: 'Desktop Discovery Hero' },
      { loc: `${SITE}/images/advertising/06-the-gruvs-services-marketplace.png`, title: 'The Gruvs Services Marketplace', caption: '28 Event Hustler Categories' },
      { loc: `${SITE}/images/advertising/07-the-gruvs-founder-ecosystem.png`, title: 'The Gruvs Founder Ecosystem', caption: 'Connected TEARN Ventures Ecosystem' },
      { loc: `${SITE}/images/advertising/ad-the-resident-x-the-gruvs.png`, title: 'The Resident Crew x The Gruvs', caption: 'The Resident Crew and The Gruvs' },
      { loc: `${SITE}/images/advertising/ad-excellency-academy-x-the-gruvs.png`, title: 'Excellency Academy x The Gruvs', caption: 'Student Vibe Passport Banner' },
    ],
  },
  {
    loc: '/founder',
    changefreq: 'weekly',
    priority: '0.95',
    images: [
      { loc: `${SITE}/images/asemahle-nkwali-ceo-the-gruvs.jpg`, title: 'Asemahle "TEARN" Nkwali Founder & CEO', caption: 'Portrait of Asemahle Nkwali' },
      { loc: `${SITE}/images/asemahle-nkwali-founder-keynote.jpg`, title: 'Asemahle "TEARN" Nkwali Keynote', caption: 'South African Event Technology Address' },
      { loc: `${SITE}/images/the-gruvs-app-launch-preview.jpg`, title: 'The Gruvs Mobile Platform', caption: 'Live Vibe Mapping and Discovery' },
    ],
  },
  {
    loc: '/press',
    changefreq: 'weekly',
    priority: '0.90',
    images: [
      { loc: `${SITE}/logo.png`, title: 'The Gruvs Press Logo', caption: 'Primary Brand Emblem' },
      { loc: `${SITE}/images/asemahle-nkwali-ceo-the-gruvs.jpg`, title: 'Asemahle "TEARN" Nkwali Press Portrait', caption: 'Executive Media Kit' },
      { loc: `${SITE}/images/the-gruvs-app-launch-preview.jpg`, title: 'The Gruvs Platform Interface', caption: 'Nightlife Intelligence Telemetry' },
    ],
  },
  { loc: '/get.html', changefreq: 'weekly', priority: '0.7' },
  { loc: '/feed.xml', changefreq: 'hourly', priority: '0.8' },
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
  { loc: '/events/maboneng', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/braamfontein', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/menlyn', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/hatfield', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/umlazi', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/camps-bay', changefreq: 'daily', priority: '0.90' },

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

  // Professional & Business Verticals
  { loc: '/events/business', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/tech-conferences', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/fintech', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/startups-and-vc', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/mining-and-energy', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/real-estate-property', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/sme-workshops', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/women-in-leadership', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/healthcare-innovation', changefreq: 'daily', priority: '0.90' },
  { loc: '/events/trade-and-logistics', changefreq: 'daily', priority: '0.90' },

  // Monthly Calendar Directory Hubs
  { loc: '/events/december-2026', changefreq: 'daily', priority: '0.92' },
  { loc: '/events/january-2027', changefreq: 'daily', priority: '0.92' },
  { loc: '/events/february-2027', changefreq: 'daily', priority: '0.92' },
  { loc: '/events/march-2027', changefreq: 'daily', priority: '0.92' },
  { loc: '/events/april-2027', changefreq: 'daily', priority: '0.92' },
  { loc: '/events/may-2027', changefreq: 'daily', priority: '0.92' },

  // Flagship Seasonal & Holiday Hubs
  { loc: '/events/this-weekend', changefreq: 'daily', priority: '0.95' },
  { loc: '/events/nye-2027', changefreq: 'daily', priority: '0.95' },
  { loc: '/events/easter-2027', changefreq: 'daily', priority: '0.95' },
  { loc: '/events/valentines-2027', changefreq: 'daily', priority: '0.95' },
  { loc: '/events/freedom-day-2027', changefreq: 'daily', priority: '0.95' },
  { loc: '/events/africa-day-2027', changefreq: 'daily', priority: '0.95' },

  // High-Intent Localized City x Category Intersection Hubs
  { loc: '/events/sandton/business', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/sandton/tech', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/johannesburg/business', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/johannesburg/nightlife', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/cape-town/tech', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/cape-town/afro-tech', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/cape-town/jazz', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/soweto/amapiano', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/soweto/culture', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/durban/shisanyama', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/durban/business', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/pretoria/concerts', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/midrand/tech', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/midrand/lifestyle', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/stellenbosch/wine', changefreq: 'daily', priority: '0.88' },
  { loc: '/events/rosebank/art', changefreq: 'daily', priority: '0.88' },

  // 28-Category Event Business & Hustler Directory Hubs
  { loc: '/services', changefreq: 'weekly', priority: '0.90' },
  { loc: '/services/shisanyama-braai', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/food-trucks', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/mobile-cocktail-bar', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/coffee-juice-vans', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/event-bakers', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/ice-cooler-hire', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/bakkie-haulers', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/stage-trucks', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/shuttle-fleets', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/vip-chauffeur', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/drum-percussion-rentals', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/pa-line-array', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/dj-gear-cdjs', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/backline-amps', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/sound-engineers', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/session-musicians-mcs', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/fashion-designers', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/streetwear-popups', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/mobile-barbers', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/makeup-artists-mua', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/bedouin-stretch-tents', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/staging-truss-rigging', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/mobile-toilets', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/event-furniture', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/bouncers-security', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/paramedics-first-aid', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/photographers-360', changefreq: 'weekly', priority: '0.88' },
  { loc: '/services/drone-videography', changefreq: 'weekly', priority: '0.88' },
  { loc: '/events/free', changefreq: 'daily', priority: '0.92' },
];

for (const cSlug of ['johannesburg', 'cape-town', 'durban', 'pretoria', 'sandton', 'soweto', 'midrand', 'stellenbosch']) {
  for (const mSlug of ['december-2026', 'january-2027', 'february-2027', 'march-2027', 'april-2027', 'may-2027']) {
    HUBS.push({ loc: `/events/${cSlug}/${mSlug}`, changefreq: 'daily', priority: '0.88' });
  }
}
for (const cSlug of ['johannesburg', 'cape-town', 'durban', 'pretoria', 'sandton', 'soweto']) {
  HUBS.push({ loc: `/events/${cSlug}/free`, changefreq: 'daily', priority: '0.86' });
  HUBS.push({ loc: `/events/${cSlug}/this-weekend`, changefreq: 'daily', priority: '0.90' });
}

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

function renderImageTags(imgs) {
  const list = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
  const lines = [];
  for (const img of list) {
    if (!img || !img.loc) continue;
    lines.push('    <image:image>');
    lines.push(`      <image:loc>${escapeXml(img.loc)}</image:loc>`);
    if (img.title) {
      lines.push(`      <image:title>${escapeXml(img.title)}</image:title>`);
    }
    if (img.caption) {
      lines.push(`      <image:caption>${escapeXml(img.caption)}</image:caption>`);
    }
    lines.push('    </image:image>');
  }
  return lines;
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
    lines.push(`    <xhtml:link rel="alternate" hreflang="en-ZA" href="${escapeXml(entry.loc)}" />`);
    lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(entry.loc)}" />`);
    if (entry.lastmod) {
      lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    }
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    lines.push(`    <priority>${entry.priority}</priority>`);

    const imgTags = renderImageTags(entry.images || entry.image);
    if (imgTags.length > 0) {
      lines.push(...imgTags);
    }
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  lines.push('');
  return lines.join('\n');
}

function buildImageSitemapXml(entries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];

  for (const entry of entries) {
    const imgTags = renderImageTags(entry.images || entry.image);
    if (imgTags.length > 0) {
      lines.push('  <url>');
      lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
      lines.push(...imgTags);
      lines.push('  </url>');
    }
  }

  lines.push('</urlset>');
  lines.push('');
  return lines.join('\n');
}

function buildSitemapIndexXml(today) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <sitemap>',
    `    <loc>${SITE}/sitemap.xml</loc>`,
    `    <lastmod>${today}</lastmod>`,
    '  </sitemap>',
    '  <sitemap>',
    `    <loc>${SITE}/image-sitemap.xml</loc>`,
    `    <lastmod>${today}</lastmod>`,
    '  </sitemap>',
    '</sitemapindex>',
    '',
  ];
  return lines.join('\n');
}

(async () => {
  const distDir = path.join(__dirname, '..', 'dist');
  const publicDir = path.join(__dirname, '..', 'public');
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const urlMap = new Map();
  const addUrl = (entry) => {
    if (!entry || !entry.loc) return;
    const existing = urlMap.get(entry.loc);
    if (!existing) {
      urlMap.set(entry.loc, entry);
      return;
    }
    // Merge images cleanly if newly added entry provides richer image data
    const existingImgs = Array.isArray(existing.images)
      ? existing.images
      : (existing.image ? [existing.image] : []);
    const incomingImgs = Array.isArray(entry.images)
      ? entry.images
      : (entry.image ? [entry.image] : []);
    const mergedImgs = [...existingImgs];
    for (const img of incomingImgs) {
      if (img?.loc && !mergedImgs.some(m => m?.loc === img.loc)) {
        mergedImgs.push(img);
      }
    }
    urlMap.set(entry.loc, {
      ...existing,
      lastmod: entry.lastmod || existing.lastmod,
      priority: Number(entry.priority) > Number(existing.priority) ? entry.priority : existing.priority,
      ...(mergedImgs.length > 0 ? { images: mergedImgs, image: undefined } : {}),
    });
  };

  for (const s of STATIC) {
    addUrl({ ...s, loc: `${SITE}${s.loc}`, lastmod: today });
  }
  for (const h of HUBS.filter(hubIsIndexable)) {
    addUrl({ ...h, loc: `${SITE}${h.loc}`, lastmod: today });
  }

  // Scan public/events, public/venues, and public/services on disk so every generated HTML page is included
  for (const folder of ['events', 'venues', 'services']) {
    const dirPath = path.join(publicDir, folder);
    if (!fs.existsSync(dirPath)) continue;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const dirent of entries) {
        if (!dirent.isDirectory()) continue;
        const relLoc = `/${folder}/${dirent.name}`;
        if (!hubIsIndexable({ loc: relLoc })) continue;
        const idxFile = path.join(dirPath, dirent.name, 'index.html');
        if (fs.existsSync(idxFile)) {
          addUrl({
            loc: `${SITE}${relLoc}`,
            lastmod: today,
            changefreq: folder === 'services' ? 'weekly' : 'daily',
            priority: folder === 'services' ? '0.88' : '0.85',
          });
        }
      }
    } catch {
      /* ignore disk scan error */
    }
  }

  const { url, key } = readEnv();

  if (!url || !key) {
    console.warn('[gen-sitemap] No Supabase credentials found — writing static + hub + disk sitemap.');
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
        const rawEvents = await res.json();
        events = rawEvents.filter(e => {
          const cover = e.cover_url || e.cover_image || (Array.isArray(e.media_urls) && e.media_urls[0]);
          return Boolean(cover && typeof cover === 'string' && cover.trim().length > 5);
        });
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
        addUrl({
          loc: `${SITE}/events/${slug}`,
          lastmod,
          changefreq,
          priority,
          image,
        });

        // 2. Canonical share URL
        addUrl({
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
            addUrl({
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
      console.warn(`[gen-sitemap] Event fetch failed (${err.message}) — keeping static + disk URLs.`);
    }

    // 4. Fetch public profiles with non-null username
    try {
      const profRes = await fetch(
        `${url}/rest/v1/profiles?select=username,display_name,avatar_url,updated_at` +
        `&username=not.is.null&limit=1000`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (profRes.ok) {
        const profiles = await profRes.json();
        let profileCount = 0;
        for (const p of profiles) {
          const uname = String(p.username || '').trim();
          if (!uname) continue;
          const profileLoc = `${SITE}/profile/${encodeURIComponent(uname)}`;
          const lastmod = (p.updated_at || today).slice(0, 10);
          let image;
          if (p.avatar_url && /^https:\/\//.test(String(p.avatar_url).trim())) {
            image = {
              loc: String(p.avatar_url).trim(),
              title: p.display_name || uname,
              caption: `@${uname} on The Gruvs`,
            };
          }
          addUrl({
            loc: profileLoc,
            lastmod,
            changefreq: 'weekly',
            priority: '0.70',
            image,
          });
          profileCount++;
        }
        console.log(`[gen-sitemap] Successfully indexed ${profileCount} public profiles.`);
      } else {
        console.warn(`[gen-sitemap] Profile fetch skipped (HTTP ${profRes.status}).`);
      }
    } catch (err) {
      console.warn(`[gen-sitemap] Profile fetch failed (${err.message}) — skipping public profiles.`);
    }
  }

  const urls = Array.from(urlMap.values());
  const sitemapXml = buildXml(urls);
  const imageSitemapXml = buildImageSitemapXml(urls);
  const sitemapIndexXml = buildSitemapIndexXml(today);

  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
    fs.writeFileSync(path.join(publicDir, 'image-sitemap.xml'), imageSitemapXml, 'utf8');
    fs.writeFileSync(path.join(publicDir, 'sitemap-index.xml'), sitemapIndexXml, 'utf8');
    console.log(`[gen-sitemap] Wrote public/sitemap.xml, public/image-sitemap.xml, and public/sitemap-index.xml with ${urls.length} URLs.`);
  }

  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
    fs.writeFileSync(path.join(distDir, 'image-sitemap.xml'), imageSitemapXml, 'utf8');
    fs.writeFileSync(path.join(distDir, 'sitemap-index.xml'), sitemapIndexXml, 'utf8');
    console.log(`[gen-sitemap] Wrote dist/sitemap.xml, dist/image-sitemap.xml, and dist/sitemap-index.xml with ${urls.length} URLs.`);
  }
})();
