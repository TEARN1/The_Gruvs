/**
 * build-seo-hubs.js — Programmatic SEO Engine for The Gruvs
 *
 * Generates crawlable, lightning-fast static HTML hubs and per-event landing pages
 * for search engines (Googlebot, Bingbot) and social crawlers:
 * 1. City / Suburb directory hubs (Midrand, Johannesburg, Pretoria, Soweto, Tembisa, etc.)
 * 2. Genre / Vibe directory hubs (Amapiano, Afro-Tech, Nightlife, Festivals, Lifestyle)
 * 3. Seasonal flagship hub: Ke Dezemba 2026
 * 4. Per-event SEO landing mirrors with human-friendly semantic slugs
 * 5. Full Schema.org JSON-LD (ItemList, Event, BreadcrumbList)
 * 6. Cross-ecosystem authority links to The Resident (accommodation pairing)
 * 7. Live RSS 2.0 / Atom feed (feed.xml) for Google Feed crawlers & syndication
 */

const fs = require('fs');
const path = require('path');

const SITE = 'https://thegruvs.com';
const APP_NAME = 'The Gruvs';

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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(dateStr, timeStr) {
  if (!dateStr) return 'Upcoming';
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const dateFormatted = d.toLocaleDateString('en-ZA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return timeStr ? `${dateFormatted} · ${timeStr.slice(0, 5)}` : dateFormatted;
  } catch {
    return dateStr;
  }
}

function renderHtmlShell({ title, description, canonicalUrl, ogImage, jsonLd = [], bodyContent, breadcrumbs = [], noindex = false }) {
  const escTitle = escapeHtml(title);
  const escDesc = escapeHtml(description);
  const escImage = escapeHtml(ogImage || `${SITE}/og-default.jpg`);
  const escUrl = escapeHtml(canonicalUrl);

  const breadcrumbItems = breadcrumbs.map((b, i) => ({
    '@type': 'ListItem',
    'position': i + 1,
    'name': b.name,
    'item': b.url,
  }));

  const allJsonLd = [...jsonLd];
  if (breadcrumbs.length > 0) {
    allJsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': breadcrumbItems,
    });
  }

  allJsonLd.push({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': APP_NAME,
    'url': SITE,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${SITE}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });

  return `<!DOCTYPE html>
<html lang="en-ZA">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escTitle}</title>
  <meta name="description" content="${escDesc}" />
  <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}" />
  <link rel="canonical" href="${escUrl}" />
  <link rel="alternate" hreflang="en-ZA" href="${escUrl}" />
  <link rel="alternate" hreflang="x-default" href="${escUrl}" />

  <!-- App Deep Linking & Google Play Store -->
  <meta property="al:android:url" content="thegruvs://web?url=${encodeURIComponent(canonicalUrl)}" />
  <meta property="al:android:package" content="com.thegruvs_tearn" />
  <meta property="al:android:app_name" content="${APP_NAME}" />
  <meta property="al:web:url" content="${escUrl}" />
  <meta name="google-play-app" content="app-id=com.thegruvs_tearn" />
  <meta name="twitter:app:name:googleplay" content="${APP_NAME}" />
  <meta name="twitter:app:id:googleplay" content="com.thegruvs_tearn" />

  <!-- High-Performance CDN Preconnects -->
  <link rel="preconnect" href="https://images.unsplash.com" crossorigin />
  <link rel="dns-prefetch" href="https://images.unsplash.com" />
  <link rel="preconnect" href="https://feevvddvrjmfbhffccbf.supabase.co" crossorigin />
  <link rel="dns-prefetch" href="https://feevvddvrjmfbhffccbf.supabase.co" />

  <!-- Regional Geo Meta -->
  <meta name="geo.region" content="ZA" />
  <meta name="geo.placename" content="South Africa" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${APP_NAME}" />
  <meta property="og:title" content="${escTitle}" />
  <meta property="og:description" content="${escDesc}" />
  <meta property="og:url" content="${escUrl}" />
  <meta property="og:image" content="${escImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_ZA" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@thegruvs" />
  <meta name="twitter:title" content="${escTitle}" />
  <meta name="twitter:description" content="${escDesc}" />
  <meta name="twitter:image" content="${escImage}" />

  <!-- Styles -->
  <style>
    :root {
      --primary: #00f2ff;
      --bg: #0d1112;
      --surface: #131a1c;
      --surface-border: rgba(255,255,255,0.12);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.65);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding-bottom: 60px;
    }
    header.site-header {
      border-bottom: 1px solid var(--surface-border);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1200px;
      margin: 0 auto;
    }
    .brand-link {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text);
      font-weight: 900;
      font-size: 20px;
      letter-spacing: 1px;
    }
    .brand-link img { border-radius: 8px; width: 32px; height: 32px; }
    .brand-accent { color: var(--primary); }
    .nav-cta {
      background: var(--primary);
      color: #000;
      padding: 8px 18px;
      border-radius: 12px;
      font-weight: 800;
      text-decoration: none;
      font-size: 14px;
      transition: transform 0.15s ease;
    }
    .nav-cta:hover { transform: translateY(-2px); }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 20px;
    }
    .breadcrumbs {
      display: flex;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .breadcrumbs a { color: var(--muted); text-decoration: none; }
    .breadcrumbs a:hover { color: var(--primary); }
    .hero-title {
      font-size: clamp(28px, 4vw, 44px);
      font-weight: 900;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    .hero-lead {
      font-size: 16px;
      color: var(--muted);
      max-width: 800px;
      margin-bottom: 32px;
    }
    .event-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
      margin-bottom: 48px;
    }
    .event-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease, border-color 0.2s ease;
      text-decoration: none;
      color: inherit;
    }
    .event-card:hover {
      transform: translateY(-4px);
      border-color: var(--primary);
    }
    .event-img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      background: #1a2225;
    }
    .event-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .event-date {
      color: var(--primary);
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .event-title {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    .event-venue {
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 16px;
    }
    .event-footer {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 14px;
      font-size: 14px;
    }
    .event-price {
      font-weight: 800;
      color: #fff;
    }
    .btn-view {
      color: var(--primary);
      font-weight: 800;
      font-size: 13px;
    }
    .resident-banner {
      background: linear-gradient(135deg, rgba(0, 242, 255, 0.08), rgba(0, 242, 255, 0.02));
      border: 1px solid rgba(0, 242, 255, 0.25);
      border-radius: 16px;
      padding: 24px;
      margin: 40px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }
    .resident-banner-text h3 {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 6px;
      color: #fff;
    }
    .resident-banner-text p {
      color: var(--muted);
      font-size: 14px;
    }
    .resident-btn {
      background: #10b981;
      color: #fff;
      padding: 10px 20px;
      border-radius: 12px;
      font-weight: 800;
      text-decoration: none;
      font-size: 14px;
      white-space: nowrap;
    }
    footer.site-footer {
      border-top: 1px solid var(--surface-border);
      padding: 32px 24px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      max-width: 1200px;
      margin: 0 auto;
    }
    footer.site-footer a { color: var(--primary); text-decoration: none; }
  </style>

  <!-- Schema.org JSON-LD -->
  ${allJsonLd.map(obj => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}\n</script>`).join('\n')}
</head>
<body>
  <header class="site-header">
    <a href="${SITE}/" class="brand-link">
      <img src="${SITE}/logo.png" alt="The Gruvs Logo" />
      <span>THE <span class="brand-accent">GRUVS</span></span>
    </a>
    <a href="${SITE}/" class="nav-cta">Open in App →</a>
  </header>

  <div class="container">
    ${bodyContent}
  </div>

  <footer class="site-footer" style="padding-top: 40px; margin-top: 60px; border-top: 1px solid var(--surface-border);">
    <div style="max-width: 1200px; margin: 0 auto; text-align: left; padding-bottom: 24px; border-bottom: 1px solid var(--surface-border); display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 28px;">
      <div>
        <h4 style="color: #fff; font-size: 13px; text-transform: uppercase; margin-bottom: 12px; font-weight: 900; letter-spacing: 1px;">Top Metros</h4>
        <ul style="list-style: none; line-height: 2.1; font-size: 13px;">
          <li><a href="${SITE}/events/johannesburg" style="color: var(--muted); text-decoration: none;">Johannesburg Events</a></li>
          <li><a href="${SITE}/events/cape-town" style="color: var(--muted); text-decoration: none;">Cape Town Events</a></li>
          <li><a href="${SITE}/events/durban" style="color: var(--muted); text-decoration: none;">Durban Events</a></li>
          <li><a href="${SITE}/events/pretoria" style="color: var(--muted); text-decoration: none;">Pretoria Events</a></li>
          <li><a href="${SITE}/events/sandton" style="color: var(--muted); text-decoration: none;">Sandton Events</a></li>
          <li><a href="${SITE}/events/soweto" style="color: var(--muted); text-decoration: none;">Soweto Events</a></li>
          <li><a href="${SITE}/events/midrand" style="color: var(--muted); text-decoration: none;">Midrand Events</a></li>
          <li><a href="${SITE}/events/stellenbosch" style="color: var(--muted); text-decoration: none;">Stellenbosch Events</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color: #fff; font-size: 13px; text-transform: uppercase; margin-bottom: 12px; font-weight: 900; letter-spacing: 1px;">Categories & Verticals</h4>
        <ul style="list-style: none; line-height: 2.1; font-size: 13px;">
          <li><a href="${SITE}/events/amapiano" style="color: var(--muted); text-decoration: none;">Amapiano & Private School</a></li>
          <li><a href="${SITE}/events/afro-tech" style="color: var(--muted); text-decoration: none;">Afro-Tech & Deep House</a></li>
          <li><a href="${SITE}/events/business" style="color: var(--muted); text-decoration: none;">Business & Corporate Summits</a></li>
          <li><a href="${SITE}/events/tech-conferences" style="color: var(--muted); text-decoration: none;">Tech, AI & Cloud</a></li>
          <li><a href="${SITE}/events/fintech" style="color: var(--muted); text-decoration: none;">FinTech & Payments</a></li>
          <li><a href="${SITE}/events/startups-and-vc" style="color: var(--muted); text-decoration: none;">Startups & Venture Capital</a></li>
          <li><a href="${SITE}/events/shisanyama" style="color: var(--muted); text-decoration: none;">Shisanyama & Braai Sundays</a></li>
          <li><a href="${SITE}/events/live-jazz" style="color: var(--muted); text-decoration: none;">Live Jazz & Afro-Soul</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color: #fff; font-size: 13px; text-transform: uppercase; margin-bottom: 12px; font-weight: 900; letter-spacing: 1px;">2026/2027 Calendar</h4>
        <ul style="list-style: none; line-height: 2.1; font-size: 13px;">
          <li><a href="${SITE}/events/december-2026" style="color: var(--muted); text-decoration: none;">December 2026 (Ke Dezemba)</a></li>
          <li><a href="${SITE}/events/january-2027" style="color: var(--muted); text-decoration: none;">January 2027 (Summer Kickoff)</a></li>
          <li><a href="${SITE}/events/february-2027" style="color: var(--muted); text-decoration: none;">February 2027 (Valentine's)</a></li>
          <li><a href="${SITE}/events/march-2027" style="color: var(--muted); text-decoration: none;">March 2027 (Human Rights)</a></li>
          <li><a href="${SITE}/events/april-2027" style="color: var(--muted); text-decoration: none;">April 2027 (Easter & Freedom Day)</a></li>
          <li><a href="${SITE}/events/may-2027" style="color: var(--muted); text-decoration: none;">May 2027 (Africa Day)</a></li>
          <li><a href="${SITE}/events/nye-2027" style="color: var(--muted); text-decoration: none;">New Year's Eve 2027</a></li>
          <li><a href="${SITE}/events/this-weekend" style="color: var(--muted); text-decoration: none;">This Weekend in SA</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color: #fff; font-size: 13px; text-transform: uppercase; margin-bottom: 12px; font-weight: 900; letter-spacing: 1px;">Ecosystem & Directory</h4>
        <ul style="list-style: none; line-height: 2.1; font-size: 13px;">
          <li><a href="${SITE}/services" style="color: var(--muted); text-decoration: none;">28 Event Services Directory</a></li>
          <li><a href="https://theresidentcrew.com" target="_blank" rel="noopener" style="color: var(--muted); text-decoration: none;">Stays via The Resident Crew</a></li>
          <li><a href="https://excellencyacs.com" target="_blank" rel="noopener" style="color: var(--muted); text-decoration: none;">Excellency Academy</a></li>
          <li><a href="${SITE}/founder" style="color: var(--muted); text-decoration: none;">Founder — Asemahle "TEARN" Nkwali</a></li>
          <li><a href="${SITE}/press" style="color: var(--muted); text-decoration: none;">Press Kit & Brand Assets</a></li>
          <li><a href="${SITE}/feed.xml" style="color: var(--muted); text-decoration: none;">Live RSS 2.0 / Atom Feed</a></li>
        </ul>
      </div>
    </div>
    <p style="margin-top: 18px; font-size: 12px; color: var(--muted); text-align: center;">
      © ${new Date().getFullYear()} The Gruvs · Founded by Asemahle "TEARN" Nkwali · TEARN Ventures · South Africa's Live Event & Vibe Discovery Platform.
    </p>
  </footer>
</body>
</html>`;
}

function renderEventCard(e) {
  const cover = e.cover_url || e.cover_image || (Array.isArray(e.media_urls) && e.media_urls[0]) || `${SITE}/og-default.jpg`;
  const dateStr = formatDate(e.event_date, e.event_time);
  const venue = [e.venue_name, e.city].filter(Boolean).join(' · ');
  const price = e.price === 'FREE' || e.price === 0 ? 'Free entry' : (typeof e.price === 'string' && !e.price.startsWith('{') ? e.price : 'Tickets Available');
  const slug = eventSlug(e);

  return `
    <a class="event-card" href="${SITE}/events/${slug}">
      <img class="event-img" src="${escapeHtml(cover)}" alt="${escapeHtml(e.title)}" loading="lazy" />
      <div class="event-body">
        <div class="event-date">${escapeHtml(dateStr)}</div>
        <h3 class="event-title">${escapeHtml(e.title)}</h3>
        <p class="event-venue">${escapeHtml(venue)}</p>
        <div class="event-footer">
          <span class="event-price">${escapeHtml(price)}</span>
          <span class="btn-view">Get Tickets →</span>
        </div>
      </div>
    </a>
  `;
}

// A hub with nothing of its own says so. It used to fill up with unrelated
// events ("This weekend" listing events on other dates), which misleads
// visitors and is the kind of page Google treats as spam. Empty hubs are also
// marked noindex and left out of the sitemap until they have events.
function emptyHubNote(what) {
  return `<p class="hero-lead">No ${escapeHtml(what)} are listed on The Gruvs yet. <a href="${SITE}/">See everything that's on</a>, or post one yourself.</p>`;
}

// ─── Main Generator ────────────────────────────────────────────────────────────

(async () => {
  const publicDir = path.join(__dirname, '..', 'public');
  const distDir = path.join(__dirname, '..', 'dist');
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { url, key } = readEnv();
  let events = [];

  if (url && key) {
    try {
      const res = await fetch(
        `${url}/rest/v1/events?select=id,title,description,venue_name,city,category,cover_url,cover_image,media_urls,updated_at,event_date,event_time,price,capacity,going` +
        `&is_published=eq.true&deleted_at=is.null&event_date=gte.${today}` +
        `&order=event_date.asc&limit=5000`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (res.ok) {
        const rawEvents = await res.json();
        events = rawEvents.filter(e => {
          if (e.cover_url && typeof e.cover_url === 'string' && e.cover_url.trim().length > 5) return true;
          if (e.cover_image && typeof e.cover_image === 'string' && e.cover_image.trim().length > 5) return true;
          if (Array.isArray(e.media_urls) && e.media_urls.length > 0 && typeof e.media_urls[0] === 'string' && e.media_urls[0].trim().length > 5) return true;
          return false;
        });
        console.log(`[build-seo-hubs] Loaded ${events.length} live upcoming events with verified images (filtered from ${rawEvents.length}).`);
      }
    } catch (e) {
      console.warn('[build-seo-hubs] Failed to fetch events from Supabase:', e.message);
    }
  }

  // Only events people posted, from the database. A generated catalogue of
  // 3,000 events that were not real used to be merged in here.
  console.log(`[build-seo-hubs] ${events.length} upcoming events from the database.`);

  // 1. City Definitions (Expanded across all South African Metro & Cultural Centers)
  const CITIES = [
    { slug: 'johannesburg', name: 'Johannesburg', desc: 'Upcoming events, concerts, nightlife, and festivals in Johannesburg and surrounding metro.' },
    { slug: 'pretoria', name: 'Pretoria', desc: 'Live music, theatre, picnics, and weekend vibes across Pretoria & Tshwane.' },
    { slug: 'midrand', name: 'Midrand', desc: 'Altitude Beach pool parties, Waterfall City markets, and luxury lifestyle events in Midrand.' },
    { slug: 'tembisa', name: 'Tembisa (1632)', desc: 'Ke Dezemba street bashes, Sunday soul chillas, and homecoming festivals in Tembisa.' },
    { slug: 'soweto', name: 'Soweto', desc: 'Vilakazi Street crossover parties, historic park chillas, and culture festivals in Soweto.' },
    { slug: 'centurion', name: 'Centurion', desc: 'Outdoor amphitheatre concerts, rooftop jazz, and lakeside lifestyle festivals in Centurion.' },
    { slug: 'sandton', name: 'Sandton', desc: 'Rooftop lounges, high-energy club nights, and VIP party events in Sandton.' },
    { slug: 'rosebank', name: 'Rosebank', desc: 'Boutique art mixers, vinyl listening bars, and creative night markets in Rosebank.' },
    { slug: 'cape-town', name: 'Cape Town', desc: 'Camps Bay sundowners, Shimmy Beach raves, Kirstenbosch concerts, and nightlife in Cape Town.' },
    { slug: 'durban', name: 'Durban', desc: 'Florida Road block parties, beachfront festivals, Eyadini shisanyama, and coastal vibes in Durban.' },
    { slug: 'bloemfontein', name: 'Bloemfontein', desc: 'Mangaung cultural festivals, stadium soundstages, and Free State celebration vibes.' },
    { slug: 'gqeberha', name: 'Gqeberha (Port Elizabeth)', desc: 'Boardwalk concerts, ocean-view food markets, and Eastern Cape live events.' },
    { slug: 'polokwane', name: 'Polokwane', desc: 'Meropa casino concerts, Limpopo soul chillas, and outdoor stadium concerts.' },
    { slug: 'nelspruit', name: 'Nelspruit (Mbombela)', desc: 'Lowveld botanical garden festivals, live music lounges, and safari sunset vibes.' },
    { slug: 'rustenburg', name: 'Rustenburg', desc: 'Sun City Superbowl concerts, North West outdoor festivals, and weekend lounges.' },
    { slug: 'kimberley', name: 'Kimberley', desc: 'Diamond pavilion soundstages, Northern Cape heritage festivals, and local music.' },
    { slug: 'pietermaritzburg', name: 'Pietermaritzburg', desc: 'Midlands music festivals, Golden Horse lounges, and KZN capital events.' },
    { slug: 'stellenbosch', name: 'Stellenbosch', desc: 'Wineland open-air amphitheatre gigs, student weekend bashes, and wine estate chillas.' },
    { slug: 'maboneng', name: 'Maboneng', desc: 'Rooftop parties, street art markets, and creative community nightlife in Maboneng Precinct.' },
    { slug: 'braamfontein', name: 'Braamfontein', desc: 'Student nightlife, open mic nights, indie showcases, and Saturday market vibes in Braamfontein.' },
    { slug: 'menlyn', name: 'Menlyn', desc: 'SunBet Arena mega-concerts, Time Square casino nightlife, and luxury weekend chillas in Menlyn.' },
    { slug: 'hatfield', name: 'Hatfield', desc: 'Youth nightlife, live bands, student festivals, and pub crawls in Hatfield, Pretoria.' },
    { slug: 'umlazi', name: 'Umlazi', desc: 'Eyadini and Max’s Lifestyle shisanyama, outdoor Sunday car spins, and KZN groove sessions in Umlazi.' },
    { slug: 'camps-bay', name: 'Camps Bay', desc: 'Sunset oceanfront lounges, VIP beach parties, and summer cocktail terraces in Camps Bay.' },
  ];

  // 2. Genre & Category Definitions (Music, Subcultures & Professional Verticals)
  const GENRES = [
    { slug: 'amapiano', name: 'Amapiano', desc: 'The biggest Amapiano concerts, day parties, and private school groove sets in South Africa.' },
    { slug: 'afro-tech', name: 'Afro-Tech & Deep House', desc: 'Deep ancestral rhythms, electronic stages, and sunset Afro-Tech experiences.' },
    { slug: 'nightlife', name: 'Nightlife & Clubs', desc: 'High-voltage club nights, VIP lounges, and weekend soundstage parties.' },
    { slug: 'festivals', name: 'Festivals & Carnivals', desc: 'Multi-stage music festivals, cultural parades, and outdoor weekend extravaganzas.' },
    { slug: 'food-and-drink', name: 'Food & Drink', desc: 'Artisanal food markets, wine tastings, craft beer garden picnics, and braai cook-offs.' },
    { slug: 'lifestyle', name: 'Lifestyle & Culture', desc: 'Fashion pop-ups, pool clubs, art showcases, and creative community gatherings.' },
    { slug: 'gqom-and-kwaito', name: 'Gqom & Kwaito', desc: 'Durban raw drum basslines, township heritage street sounds, and high-octane dances.' },
    { slug: 'live-jazz', name: 'Live Jazz & Soul', desc: 'Intimate jazz cafes, acoustic soul sessions, and heritage brass orchestra performances.' },
    { slug: 'comedy', name: 'Stand-up Comedy', desc: 'South Africa’s premier comedy clubs, vernacular laughs, and theater specials.' },
    { slug: 'rooftop-sundowners', name: 'Rooftop Sundowners', desc: 'Golden hour panoramic cocktails, deep house selections, and skybar weekends.' },
    { slug: 'shisanyama', name: 'Shisanyama & Braai Sundays', desc: 'Butchery grill feasts, cooler box lawn picnics, and authentic township Sunday sessions.' },
    { slug: 'sports-derbies', name: 'Sports Derbies & Stadium Vibe', desc: 'Soweto Derby fan parks, rugby test tailgates, and stadium screening parties.' },
    // Professional & Business Verticals
    { slug: 'business', name: 'Business & Corporate Summits', desc: 'Executive conferences, industry conventions, corporate galas, and leadership summits across South Africa.' },
    { slug: 'tech-conferences', name: 'Tech, AI & Cloud Summits', desc: 'Enterprise artificial intelligence, cloud architecture, cybersecurity, and software engineering conferences.' },
    { slug: 'fintech', name: 'FinTech, Banking & Payments', desc: 'Digital banking, African payment gateways, mobile money interoperability, and cross-border remittance summits.' },
    { slug: 'startups-and-vc', name: 'Startups, Venture Capital & Angels', desc: 'Seed funding pitch competitions, angel investor breakfasts, tech demo days, and venture showcases.' },
    { slug: 'mining-and-energy', name: 'Mining, Clean Energy & Green Hydrogen', desc: 'Mining indaba executive forums, commercial solar wheeling, battery storage, and green hydrogen summits.' },
    { slug: 'real-estate-property', name: 'Commercial Property & Real Estate', desc: 'Property buyer expos, student accommodation developments, REIT investment panels, and green building forums.' },
    { slug: 'sme-workshops', name: 'SME Growth, Tax & Funding', desc: 'Actionable SARS tax compliance, cloud accounting masterclasses, government grant funding, and franchise expos.' },
    { slug: 'women-in-leadership', name: 'Women in Leadership & Tech', desc: 'Executive boardroom governance, female tech founder showcases, and mentorship breakfast round-tables.' },
    { slug: 'healthcare-innovation', name: 'Healthcare Innovation & MedTech', desc: 'Digital health diagnostics, pharmacy automation, telemedicine platforms, and medical scheme tech forums.' },
    { slug: 'trade-and-logistics', name: 'Trade, AfCFTA, Maritime & Ports', desc: 'Port of Durban logistics, AfCFTA cross-border trade corridors, rail freight revitalization, and export forums.' },
  ];

  const generatedPages = [];

  // ── Helper to write to both public and dist ───────────────────────────────
  function writePage(relPath, html) {
    const pubFile = path.join(publicDir, relPath);
    try {
      fs.mkdirSync(path.dirname(pubFile), { recursive: true });
      fs.writeFileSync(pubFile, html, 'utf8');
    } catch {
      try {
        fs.writeFileSync(pubFile, html, 'utf8');
      } catch {}
    }

    if (fs.existsSync(distDir)) {
      const distFile = path.join(distDir, relPath);
      try {
        fs.mkdirSync(path.dirname(distFile), { recursive: true });
        fs.writeFileSync(distFile, html, 'utf8');
      } catch {
        try {
          fs.writeFileSync(distFile, html, 'utf8');
        } catch {}
      }
    }
  }

  // ── Generate City Hubs ────────────────────────────────────────────────────
  for (const c of CITIES) {
    const cityEvents = events.filter(e => {
      const cityText = `${e.city || ''} ${e.venue_name || ''}`.toLowerCase();
      return cityText.includes(c.slug.replace('-', ' ')) || cityText.includes(c.name.toLowerCase().split(' ')[0]);
    });

    const activeList = cityEvents;
    const itemListJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': `Events in ${c.name}`,
      'description': c.desc,
      'itemListElement': activeList.map((e, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'item': {
          '@type': 'Event',
          'name': e.title,
          'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
          'location': {
            '@type': 'Place',
            'name': e.venue_name || c.name,
            'address': { '@type': 'PostalAddress', 'addressLocality': c.name, 'addressCountry': 'ZA' },
          },
          'image': e.cover_url || e.cover_image || `${SITE}/og-default.jpg`,
          'url': `${SITE}/events/${eventSlug(e)}`,
        },
      })),
    };

    const breadcrumbs = [
      { name: 'Home', url: `${SITE}/` },
      { name: 'Events', url: `${SITE}/events` },
      { name: c.name, url: `${SITE}/events/${c.slug}` },
    ];

    const body = `
      <div class="breadcrumbs">
        <a href="${SITE}/">Home</a> <span>›</span>
        <span>Events</span> <span>›</span>
        <span style="color:#fff;">${escapeHtml(c.name)}</span>
      </div>

      <h1 class="hero-title">Events in <span class="brand-accent">${escapeHtml(c.name)}</span></h1>
      <p class="hero-lead">${escapeHtml(c.desc)} Browse what's listed, with dates, venues and directions.</p>

      <div class="resident-banner">
        <div class="resident-banner-text">
          <h3>Need Accommodation in ${escapeHtml(c.name)}?</h3>
          <p>Heading to an event? Look for student rooms, guest houses and shared flats near venues on The Resident Crew.</p>
        </div>
        <a href="https://theresidentcrew.com" target="_blank" rel="noopener" class="resident-btn">Find Stays Nearby →</a>
      </div>

      ${activeList.length ? `<div class="event-grid">
        ${activeList.map(renderEventCard).join('')}
      </div>` : emptyHubNote(`events in ${c.name}`)}
    `;

    const cityFaqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': `What events are happening in ${c.name}?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `The Gruvs lists verified upcoming concerts, nightlife, Amapiano sets, food markets, and lifestyle events in ${c.name} with dates, venues, and tickets.`,
          },
        },
        {
          '@type': 'Question',
          'name': `Where can I find tickets and directions for ${c.name} events?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `Open any ${c.name} event on The Gruvs to view live venue coordinates, ticket prices in ZAR, and nearby accommodation via The Resident Crew.`,
          },
        },
      ],
    };

    const html = renderHtmlShell({
      title: `Upcoming Events in ${c.name} (${now.getFullYear()}) — The Gruvs`,
      description: `Discover upcoming events, nightlife, and festivals in ${c.name}. Dates, venues and directions on The Gruvs.`,
      canonicalUrl: `${SITE}/events/${c.slug}`,
      jsonLd: activeList.length ? [itemListJsonLd, cityFaqJsonLd] : [cityFaqJsonLd],
      bodyContent: body,
      breadcrumbs,
      noindex: false,
    });

    writePage(`events/${c.slug}/index.html`, html);
    generatedPages.push({ loc: `${SITE}/events/${c.slug}`, priority: '0.9', changefreq: 'daily' });
  }

  // ── Generate Genre & Category Hubs ────────────────────────────────────────
  for (const g of GENRES) {
    const genreEvents = events.filter(e => {
      const cat = (e.category || '').toLowerCase();
      const title = (e.title || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      const tags = (Array.isArray(e.tags) ? e.tags.join(' ') : '').toLowerCase();
      const combined = `${cat} ${title} ${desc} ${tags}`;

      if (g.slug === 'business') {
        return cat === 'biz' || cat === 'business' || combined.includes('business') || combined.includes('summit') || combined.includes('executive') || combined.includes('conference');
      }
      if (g.slug === 'tech-conferences') {
        return combined.includes('tech') || combined.includes(' ai ') || combined.includes('cloud') || combined.includes('automation') || combined.includes('cybersecurity');
      }
      if (g.slug === 'fintech') {
        return combined.includes('fintech') || combined.includes('banking') || combined.includes('payments') || combined.includes('remittance');
      }
      if (g.slug === 'startups-and-vc') {
        return combined.includes('startup') || combined.includes('venture capital') || combined.includes('angel') || combined.includes('investor') || combined.includes('pitch');
      }
      if (g.slug === 'mining-and-energy') {
        return combined.includes('mining') || combined.includes('energy') || combined.includes('solar') || combined.includes('hydrogen') || combined.includes('battery');
      }
      if (g.slug === 'real-estate-property') {
        return combined.includes('property') || combined.includes('real estate') || combined.includes('building') || combined.includes('housing');
      }
      if (g.slug === 'sme-workshops') {
        return combined.includes('sme') || combined.includes('tax') || combined.includes('compliance') || combined.includes('workshop') || combined.includes('accounting');
      }
      if (g.slug === 'women-in-leadership') {
        return combined.includes('women') || combined.includes('female') || combined.includes('women in');
      }
      if (g.slug === 'healthcare-innovation') {
        return combined.includes('health') || combined.includes('medtech') || combined.includes('telemedicine') || combined.includes('medical');
      }
      if (g.slug === 'trade-and-logistics') {
        return combined.includes('trade') || combined.includes('logistics') || combined.includes('maritime') || combined.includes('port') || combined.includes('afcfta') || combined.includes('export');
      }

      return combined.includes(g.slug.replace(/-/g, ' ')) || combined.includes(g.name.toLowerCase());
    });

    const activeList = genreEvents;
    const itemListJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': `${g.name} Events in South Africa`,
      'description': g.desc,
      'itemListElement': activeList.map((e, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'item': {
          '@type': 'Event',
          'name': e.title,
          'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
          'location': {
            '@type': 'Place',
            'name': e.venue_name || 'Gauteng',
            'address': { '@type': 'PostalAddress', 'addressLocality': e.city || 'Johannesburg', 'addressCountry': 'ZA' },
          },
          'image': e.cover_url || e.cover_image || `${SITE}/og-default.jpg`,
          'url': `${SITE}/events/${eventSlug(e)}`,
        },
      })),
    };

    const breadcrumbs = [
      { name: 'Home', url: `${SITE}/` },
      { name: 'Categories', url: `${SITE}/events` },
      { name: g.name, url: `${SITE}/events/${g.slug}` },
    ];

    const body = `
      <div class="breadcrumbs">
        <a href="${SITE}/">Home</a> <span>›</span>
        <span>Categories</span> <span>›</span>
        <span style="color:#fff;">${escapeHtml(g.name)}</span>
      </div>

      <h1 class="hero-title"><span class="brand-accent">${escapeHtml(g.name)}</span> Events & Vibes</h1>
      <p class="hero-lead">${escapeHtml(g.desc)} Dates, venues and how to RSVP.</p>

      ${activeList.length ? `<div class="event-grid">
        ${activeList.map(renderEventCard).join('')}
      </div>` : emptyHubNote(`${g.name} events`)}
    `;

    const genreFaqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': `Where can I find upcoming ${g.name} events in South Africa?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `Browse verified ${g.name} concerts, DJ lineups, festivals, and weekend experiences across Johannesburg, Pretoria, Cape Town, and Durban on The Gruvs.`,
          },
        },
        {
          '@type': 'Question',
          'name': `How do I RSVP or book tickets for ${g.name} shows on The Gruvs?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `Select any ${g.name} event card to view lineups, ticket tiers in ZAR, venue directions, and Touch Down check-in details on The Gruvs.`,
          },
        },
      ],
    };

    const html = renderHtmlShell({
      title: `${g.name} Events & Parties in South Africa (${now.getFullYear()}) — The Gruvs`,
      description: `Experience the top ${g.name} events, DJ sets, and festivals in Gauteng and South Africa. See dates and RSVP on The Gruvs.`,
      canonicalUrl: `${SITE}/events/${g.slug}`,
      jsonLd: activeList.length ? [itemListJsonLd, genreFaqJsonLd] : [genreFaqJsonLd],
      bodyContent: body,
      breadcrumbs,
      noindex: false,
    });

    writePage(`events/${g.slug}/index.html`, html);
    generatedPages.push({ loc: `${SITE}/events/${g.slug}`, priority: '0.9', changefreq: 'daily' });
  }

  // ── Generate Flagship Seasonal: Ke Dezemba 2026 ───────────────────────────
  const decEvents = events.filter(e => (e.event_date || '').startsWith('2026-12'));
  const keDezembaList = decEvents;

  const keDezembaJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'Ke Dezemba 2026 Events — Festive Season Lineup South Africa',
    'description': 'The ultimate guide to December 2026 festival season: Day of Reconciliation cook-offs, Christmas Eve carols, and New Year’s Eve crossovers.',
    'itemListElement': keDezembaList.map((e, idx) => ({
      '@type': 'ListItem',
      'position': idx + 1,
      'item': {
        '@type': 'Event',
        'name': e.title,
        'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
        'location': {
          '@type': 'Place',
          'name': e.venue_name || 'Gauteng',
          'address': { '@type': 'PostalAddress', 'addressLocality': e.city || 'Johannesburg', 'addressCountry': 'ZA' },
        },
        'image': e.cover_url || e.cover_image || `${SITE}/og-default.jpg`,
        'url': `${SITE}/events/${eventSlug(e)}`,
      },
    })),
  };

  const keDezembaBody = `
    <div class="breadcrumbs">
      <a href="${SITE}/">Home</a> <span>›</span>
      <span>Seasonal</span> <span>›</span>
      <span style="color:#fff;">Ke Dezemba 2026</span>
    </div>

    <h1 class="hero-title">Ke Dezemba <span class="brand-accent">2026</span> Mega-Lineup</h1>
    <p class="hero-lead">Gauteng’s official festive season calendar. From Altitude Beach summer splash to Vilakazi Street New Year crossovers and Tembisa homecoming picnics.</p>

    <div class="resident-banner">
      <div class="resident-banner-text">
        <h3>December Festive Stay Near Venues</h3>
        <p>Planning a weekend party trip to Midrand, Tembisa, or Soweto? Find rooms with local hosts on The Resident Crew.</p>
      </div>
      <a href="https://theresidentcrew.com/dashboard/housing" target="_blank" rel="noopener" class="resident-btn">View Ke Dezemba Stays →</a>
    </div>

    ${keDezembaList.length ? `<div class="event-grid">
      ${keDezembaList.map(renderEventCard).join('')}
    </div>` : emptyHubNote('December events')}
  `;

  const keDezembaHtml = renderHtmlShell({
    title: 'Ke Dezemba 2026 Events & Parties in Gauteng — The Gruvs',
    description: 'Find all December 2026 Ke Dezemba festivals, street bashes, and crossover parties across Midrand, Soweto, Pretoria, and Johannesburg.',
    canonicalUrl: `${SITE}/events/ke-dezemba`,
    jsonLd: keDezembaList.length ? [keDezembaJsonLd] : [],
    bodyContent: keDezembaBody,
    noindex: false,
    breadcrumbs: [
      { name: 'Home', url: `${SITE}/` },
      { name: 'Ke Dezemba 2026', url: `${SITE}/events/ke-dezemba` },
    ],
  });

  writePage('events/ke-dezemba/index.html', keDezembaHtml);
  generatedPages.push({ loc: `${SITE}/events/ke-dezemba`, priority: '0.95', changefreq: 'daily' });

  // ── Generate Date Horizon Hubs (This Weekend & NYE) ──────────────────────
  const dNow = new Date();
  const dayOfWeek = dNow.getDay();
  const daysUntilFri = (5 - dayOfWeek + 7) % 7;
  const dFri = new Date(dNow);
  dFri.setDate(dNow.getDate() + daysUntilFri);
  const dSun = new Date(dFri);
  dSun.setDate(dFri.getDate() + 2);
  const friStr = dFri.toISOString().slice(0, 10);
  const sunStr = dSun.toISOString().slice(0, 10);

  const weekendEvents = events.filter(e => e.event_date && e.event_date >= friStr && e.event_date <= sunStr);
  const activeWeekend = weekendEvents;

  const weekendBody = `
    <div class="breadcrumbs">
      <a href="${SITE}/">Home</a> <span>›</span>
      <span>Events</span> <span>›</span>
      <span style="color:#fff;">This Weekend</span>
    </div>
    <h1 class="hero-title">Events <span class="brand-accent">This Weekend</span> in South Africa</h1>
    <p class="hero-lead">What's listed from Friday night to Sunday, updated every day.</p>
    ${activeWeekend.length ? `<div class="event-grid">
      ${activeWeekend.map(renderEventCard).join('')}
    </div>` : emptyHubNote('events this weekend')}
  `;
  const weekendHtml = renderHtmlShell({
    title: 'Events This Weekend in South Africa (Friday - Sunday) — The Gruvs',
    description: 'Find top parties, concerts, nightlife and markets happening this weekend in Johannesburg, Pretoria, Cape Town, and Durban.',
    canonicalUrl: `${SITE}/events/this-weekend`,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': 'Events This Weekend in South Africa',
      'itemListElement': activeWeekend.slice(0, 20).map((e, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'item': {
          '@type': 'Event',
          'name': e.title,
          'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
          'url': `${SITE}/events/${eventSlug(e)}`,
        },
      })),
    }],
    bodyContent: weekendBody,
    noindex: false,
    breadcrumbs: [{ name: 'Home', url: `${SITE}/` }, { name: 'This Weekend', url: `${SITE}/events/this-weekend` }],
  });
  writePage('events/this-weekend/index.html', weekendHtml);
  generatedPages.push({ loc: `${SITE}/events/this-weekend`, priority: '0.95', changefreq: 'daily' });

  // NYE 2027 Crossover Hub
  const nyeEvents = events.filter(e => e.event_date === '2026-12-31' || e.event_date === '2027-01-01');
  const activeNye = nyeEvents;
  const nyeBody = `
    <div class="breadcrumbs">
      <a href="${SITE}/">Home</a> <span>›</span>
      <span>Seasonal</span> <span>›</span>
      <span style="color:#fff;">New Year's Eve 2027</span>
    </div>
    <h1 class="hero-title">New Year's Eve <span class="brand-accent">2027</span> Crossover Parties</h1>
    <p class="hero-lead">Countdown to 2027 across South Africa's biggest countdown arenas, rooftop celebrations, and street festivals.</p>
    ${activeNye.length ? `<div class="event-grid">
      ${activeNye.map(renderEventCard).join('')}
    </div>` : emptyHubNote("New Year's Eve events")}
  `;
  const nyeHtml = renderHtmlShell({
    title: "New Year's Eve 2027 Parties & Crossover Bashes in South Africa — The Gruvs",
    description: "Browse New Year's Eve countdown parties, midnight fireworks, and crossover events across South Africa.",
    canonicalUrl: `${SITE}/events/nye-2027`,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': "New Year's Eve 2027 Crossover Events",
      'itemListElement': activeNye.slice(0, 20).map((e, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'item': {
          '@type': 'Event',
          'name': e.title,
          'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
          'url': `${SITE}/events/${eventSlug(e)}`,
        },
      })),
    }],
    bodyContent: nyeBody,
    noindex: false,
    breadcrumbs: [{ name: 'Home', url: `${SITE}/` }, { name: "New Year's Eve 2027", url: `${SITE}/events/nye-2027` }],
  });
  writePage('events/nye-2027/index.html', nyeHtml);
  generatedPages.push({ loc: `${SITE}/events/nye-2027`, priority: '0.95', changefreq: 'daily' });

  // ── Marquee Flagship Seasonal Hubs (Easter, Valentine's, Freedom Day, Africa Day) ──
  const MARQUEE_SEASONS = [
    {
      slug: 'easter-2027',
      name: 'Easter Long Weekend 2027',
      title: 'Easter Long Weekend 2027 Events & Bashes in South Africa — The Gruvs',
      desc: 'Top Easter long weekend Amapiano parties, ocean raves, vineyard jazz picnics, and family celebrations across South Africa.',
      filter: e => e.event_date >= '2027-04-02' && e.event_date <= '2027-04-05',
    },
    {
      slug: 'valentines-2027',
      name: "Valentine's Weekend 2027",
      title: "Valentine's Weekend 2027 Dinners, Beach & Sunset Soirees — The Gruvs",
      desc: "Romantic candlelit dinners, sunset beach cruises, wine and chocolate pairings, and lovers' grooves across South Africa.",
      filter: e => e.event_date >= '2027-02-12' && e.event_date <= '2027-02-14',
    },
    {
      slug: 'freedom-day-2027',
      name: 'Freedom Day 2027',
      title: 'Freedom Day 2027 Celebrations & Heritage Concerts — The Gruvs',
      desc: 'Commemorating 33 years of democracy with all-star stadium festivals, heritage concerts at Constitution Hill, and coastal gatherings.',
      filter: e => e.event_date >= '2027-04-26' && e.event_date <= '2027-04-27',
    },
    {
      slug: 'africa-day-2027',
      name: 'Africa Day 2027',
      title: 'Africa Day 2027 Cultural Carnivals & Concerts — The Gruvs',
      desc: 'Pan-African cultural carnivals, continent-wide Afrobeats and Amapiano concerts, and young African business innovator dialogues.',
      filter: e => e.event_date >= '2027-05-24' && e.event_date <= '2027-05-25',
    },
  ];

  for (const s of MARQUEE_SEASONS) {
    const activeList = events.filter(s.filter);
    const body = `
      <div class="breadcrumbs">
        <a href="${SITE}/">Home</a> <span>›</span>
        <span>Seasonal</span> <span>›</span>
        <span style="color:#fff;">${escapeHtml(s.name)}</span>
      </div>
      <h1 class="hero-title"><span class="brand-accent">${escapeHtml(s.name)}</span> Events</h1>
      <p class="hero-lead">${escapeHtml(s.desc)}</p>
      ${activeList.length ? `<div class="event-grid">
        ${activeList.map(renderEventCard).join('')}
      </div>` : emptyHubNote(`${s.name} events`)}
    `;

    const html = renderHtmlShell({
      title: s.title,
      description: s.desc,
      canonicalUrl: `${SITE}/events/${s.slug}`,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': s.title,
        'description': s.desc,
        'itemListElement': activeList.slice(0, 20).map((e, idx) => ({
          '@type': 'ListItem',
          'position': idx + 1,
          'item': {
            '@type': 'Event',
            'name': e.title,
            'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
            'url': `${SITE}/events/${eventSlug(e)}`,
          },
        })),
      }],
      bodyContent: body,
      noindex: false,
      breadcrumbs: [
        { name: 'Home', url: `${SITE}/` },
        { name: s.name, url: `${SITE}/events/${s.slug}` },
      ],
    });

    writePage(`events/${s.slug}/index.html`, html);
    generatedPages.push({ loc: `${SITE}/events/${s.slug}`, priority: '0.95', changefreq: 'daily' });
  }

  // ── Monthly Calendar Directory Hubs (Dec 2026 – May 2027) ─────────────────
  const MONTH_HUBS = [
    { ym: '2026-12', slug: 'december-2026', name: 'December 2026 (Ke Dezemba)', title: 'Events in December 2026 (Ke Dezemba) — South Africa Guide | The Gruvs', desc: 'Complete December 2026 event lineup: festive Amapiano raves, beach club countdowns, and corporate year-end summits.' },
    { ym: '2027-01', slug: 'january-2027', name: 'January 2027 (Summer Kickoff)', title: 'Events in January 2027 — Summer Music & Tech Summits | The Gruvs', desc: 'Start 2027 with New Year beach raves, street culture festivals, economic outlook forums, and enterprise AI summits.' },
    { ym: '2027-02', slug: 'february-2027', name: 'February 2027 (Valentine’s & Indaba)', title: 'Events in February 2027 — Nightlife, Mining & Valentine’s | The Gruvs', desc: 'Explore February 2027 events: African mining indabas, VC summits, romantic rooftop soirees, and outdoor festivals.' },
    { ym: '2027-03', slug: 'march-2027', name: 'March 2027 (Human Rights & Jazz)', title: 'Events in March 2027 — Festivals, Jazz & FinTech Summits | The Gruvs', desc: 'Discover March 2027 events: Human Rights weekend celebrations, harvest jazz picnics, FinTech Africa, and clean energy forums.' },
    { ym: '2027-04', slug: 'april-2027', name: 'April 2027 (Easter & Freedom Day)', title: 'Events in April 2027 — Easter, Freedom Day & Property Expos | The Gruvs', desc: 'April 2027 event calendar: Easter long-weekend bashes, Freedom Day stadium concerts, property buyer expos, and tech summits.' },
    { ym: '2027-05', slug: 'may-2027', name: 'May 2027 (Africa Day & Winter Warmup)', title: 'Events in May 2027 — Africa Day Carnivals & Enterprise Cloud | The Gruvs', desc: 'Celebrate May 2027: Africa Day unity festivals, Stellenbosch red wine harvest, and African enterprise cloud summits.' },
  ];

  for (const m of MONTH_HUBS) {
    const activeList = events.filter(e => (e.event_date || '').startsWith(m.ym));
    const body = `
      <div class="breadcrumbs">
        <a href="${SITE}/">Home</a> <span>›</span>
        <span>Calendar</span> <span>›</span>
        <span style="color:#fff;">${escapeHtml(m.name)}</span>
      </div>
      <h1 class="hero-title">Events in <span class="brand-accent">${escapeHtml(m.name)}</span></h1>
      <p class="hero-lead">${escapeHtml(m.desc)} Browse all verified upcoming concerts, festivals, conferences, and weekend experiences.</p>
      ${activeList.length ? `<div class="event-grid">
        ${activeList.map(renderEventCard).join('')}
      </div>` : emptyHubNote(`events in ${m.name}`)}
    `;

    const html = renderHtmlShell({
      title: m.title,
      description: m.desc,
      canonicalUrl: `${SITE}/events/${m.slug}`,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': m.title,
        'description': m.desc,
        'itemListElement': activeList.slice(0, 25).map((e, idx) => ({
          '@type': 'ListItem',
          'position': idx + 1,
          'item': {
            '@type': 'Event',
            'name': e.title,
            'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
            'url': `${SITE}/events/${eventSlug(e)}`,
          },
        })),
      }],
      bodyContent: body,
      noindex: false,
      breadcrumbs: [
        { name: 'Home', url: `${SITE}/` },
        { name: m.name, url: `${SITE}/events/${m.slug}` },
      ],
    });

    writePage(`events/${m.slug}/index.html`, html);
    generatedPages.push({ loc: `${SITE}/events/${m.slug}`, priority: '0.92', changefreq: 'daily' });
  }

  // ── High-Intent Localized City × Category Intersection Hubs ───────────────
  const INTERSECTION_HUBS = [
    { city: 'sandton', cat: 'business', title: 'Business Conferences & Summits in Sandton — The Gruvs', desc: 'Upcoming executive conferences, finance summits, and corporate expos in Sandton Convention Centre and The Marc.', filter: e => (e.city || '').toLowerCase().includes('sandton') || (e.venue_name || '').toLowerCase().includes('sandton') },
    { city: 'sandton', cat: 'tech', title: 'Tech, AI & Cloud Summits in Sandton — The Gruvs', desc: 'Leading enterprise AI, cybersecurity, and cloud conferences taking place in Sandton.', filter: e => ((e.city || '').toLowerCase().includes('sandton') || (e.venue_name || '').toLowerCase().includes('sandton')) && ((e.title || '').toLowerCase().includes('tech') || (e.title || '').toLowerCase().includes('ai') || (e.title || '').toLowerCase().includes('cloud') || (e.title || '').toLowerCase().includes('fintech')) },
    { city: 'johannesburg', cat: 'business', title: 'Business Summits & Expos in Johannesburg — The Gruvs', desc: 'Executive symposiums, property expos, and commercial trade gatherings in Johannesburg.', filter: e => (e.city || '').toLowerCase().includes('johannesburg') && (e.category === 'biz' || (e.title || '').toLowerCase().includes('business')) },
    { city: 'johannesburg', cat: 'nightlife', title: 'Nightlife, Clubs & Parties in Johannesburg — The Gruvs', desc: 'Top rooftop sundowners, club raves, and weekend nightlife in Johannesburg.', filter: e => (e.city || '').toLowerCase().includes('johannesburg') && (e.category === 'music' || e.category === 'party') },
    { city: 'cape-town', cat: 'tech', title: 'Tech & Startup Summits in Cape Town — The Gruvs', desc: 'Silicon Cape demo days, venture capital forums, and innovation congresses at CTICC.', filter: e => (e.city || '').toLowerCase().includes('cape town') && ((e.title || '').toLowerCase().includes('tech') || (e.title || '').toLowerCase().includes('startup') || (e.title || '').toLowerCase().includes('venture')) },
    { city: 'cape-town', cat: 'afro-tech', title: 'Afro-Tech & Deep House in Cape Town — The Gruvs', desc: 'Sunset coastal parties, Shimmy Beach raves, and oceanfront electronic sets in Cape Town.', filter: e => (e.city || '').toLowerCase().includes('cape town') && ((e.title || '').toLowerCase().includes('afro-tech') || (e.title || '').toLowerCase().includes('house') || (e.title || '').toLowerCase().includes('techno') || (e.title || '').toLowerCase().includes('beach')) },
    { city: 'cape-town', cat: 'jazz', title: 'Live Jazz & Sunset Concerts in Cape Town — The Gruvs', desc: 'Kirstenbosch summer sunset concerts, acoustic soul sessions, and jazz in Cape Town.', filter: e => (e.city || '').toLowerCase().includes('cape town') && ((e.title || '').toLowerCase().includes('jazz') || (e.title || '').toLowerCase().includes('kirstenbosch') || (e.title || '').toLowerCase().includes('acoustic')) },
    { city: 'soweto', cat: 'amapiano', title: 'Amapiano Parties & Street Bashes in Soweto — The Gruvs', desc: 'High-voltage Amapiano sets, Zone 6 blowouts, and Konka VIP celebrations in Soweto.', filter: e => (e.city || '').toLowerCase().includes('soweto') && ((e.title || '').toLowerCase().includes('amapiano') || (e.venue_name || '').toLowerCase().includes('zone 6') || (e.venue_name || '').toLowerCase().includes('konka')) },
    { city: 'soweto', cat: 'culture', title: 'Cultural Festivals & Street Food in Soweto — The Gruvs', desc: 'Heritage concerts, street kota festivals, craft beer markets, and arts in Soweto.', filter: e => (e.city || '').toLowerCase().includes('soweto') && ((e.title || '').toLowerCase().includes('food') || (e.title || '').toLowerCase().includes('culture') || (e.title || '').toLowerCase().includes('rights')) },
    { city: 'durban', cat: 'shisanyama', title: 'Shisanyama & Braai Sundays in Durban — The Gruvs', desc: 'Legendary butchery braai feasts, Eyadini Lounge groove, and Max’s Lifestyle in Umlazi.', filter: e => (e.city || '').toLowerCase().includes('durban') && ((e.title || '').toLowerCase().includes('shisanyama') || (e.venue_name || '').toLowerCase().includes('eyadini') || (e.venue_name || '').toLowerCase().includes('max')) },
    { city: 'durban', cat: 'business', title: 'Maritime, Trade & Logistics Summits in Durban — The Gruvs', desc: 'Port of Durban symposiums, AfCFTA trade round-tables, and manufacturing conferences at Durban ICC.', filter: e => (e.city || '').toLowerCase().includes('durban') && (e.category === 'biz' || (e.title || '').toLowerCase().includes('trade') || (e.title || '').toLowerCase().includes('port') || (e.title || '').toLowerCase().includes('manufacturing')) },
    { city: 'pretoria', cat: 'concerts', title: 'Concerts & Arena Shows in Pretoria — The Gruvs', desc: 'SunBet Arena mega-concerts, Time Square live shows, and orchestral spectacles in Pretoria.', filter: e => (e.city || '').toLowerCase().includes('pretoria') && ((e.venue_name || '').toLowerCase().includes('sunbet') || (e.title || '').toLowerCase().includes('symphony') || (e.title || '').toLowerCase().includes('concert')) },
    { city: 'midrand', cat: 'tech', title: 'Tech Summits & Gallagher Expos in Midrand — The Gruvs', desc: 'Enterprise AI expos, cloud workshops, and industrial automation conferences at Gallagher.', filter: e => (e.city || '').toLowerCase().includes('midrand') && (e.category === 'biz' || (e.venue_name || '').toLowerCase().includes('gallagher')) },
    { city: 'midrand', cat: 'lifestyle', title: 'Altitude Beach & Kyalami Track Days in Midrand — The Gruvs', desc: 'Pool parties at Altitude Beach, Kyalami drifting festivals, and Waterfall City street food.', filter: e => (e.city || '').toLowerCase().includes('midrand') && ((e.venue_name || '').toLowerCase().includes('altitude') || (e.venue_name || '').toLowerCase().includes('kyalami') || (e.venue_name || '').toLowerCase().includes('waterfall')) },
    { city: 'stellenbosch', cat: 'wine', title: 'Wine Tastings & Vineyard Jazz in Stellenbosch — The Gruvs', desc: 'Spier vineyard sunset soirees, Pinotage festivals, and harvest jazz picnics in Stellenbosch.', filter: e => (e.city || '').toLowerCase().includes('stellenbosch') || (e.venue_name || '').toLowerCase().includes('spier') },
    { city: 'rosebank', cat: 'art', title: 'Art Markets, Vinyl & Streetwear in Rosebank — The Gruvs', desc: 'Boutique art mixers, vintage vinyl listening sessions, and street culture battles at The Zone Rosebank.', filter: e => (e.city || '').toLowerCase().includes('rosebank') },
  ];

  for (const ih of INTERSECTION_HUBS) {
    const activeList = events.filter(ih.filter);
    const body = `
      <div class="breadcrumbs">
        <a href="${SITE}/">Home</a> <span>›</span>
        <a href="${SITE}/events/${ih.city}">${escapeHtml(ih.city.toUpperCase())}</a> <span>›</span>
        <span style="color:#fff;">${escapeHtml(ih.cat)}</span>
      </div>
      <h1 class="hero-title">${escapeHtml(ih.title.replace(' — The Gruvs', ''))}</h1>
      <p class="hero-lead">${escapeHtml(ih.desc)}</p>
      ${activeList.length ? `<div class="event-grid">
        ${activeList.map(renderEventCard).join('')}
      </div>` : emptyHubNote(`events in ${ih.city} (${ih.cat})`)}
    `;

    const html = renderHtmlShell({
      title: ih.title,
      description: ih.desc,
      canonicalUrl: `${SITE}/events/${ih.city}/${ih.cat}`,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': ih.title,
        'description': ih.desc,
        'itemListElement': activeList.slice(0, 20).map((e, idx) => ({
          '@type': 'ListItem',
          'position': idx + 1,
          'item': {
            '@type': 'Event',
            'name': e.title,
            'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
            'url': `${SITE}/events/${eventSlug(e)}`,
          },
        })),
      }],
      bodyContent: body,
      noindex: false,
      breadcrumbs: [
        { name: 'Home', url: `${SITE}/` },
        { name: ih.city.toUpperCase(), url: `${SITE}/events/${ih.city}` },
        { name: ih.cat, url: `${SITE}/events/${ih.city}/${ih.cat}` },
      ],
    });

    writePage(`events/${ih.city}/${ih.cat}/index.html`, html);
    generatedPages.push({ loc: `${SITE}/events/${ih.city}/${ih.cat}`, priority: '0.90', changefreq: 'daily' });
  }

  // ── 28-Category Event Business & Hustler Directory Hubs ───────────────────
  const SERVICES = [
    // Food & Refreshments
    { slug: 'shisanyama-braai', name: 'Shisanyama & Spit Braai', cluster: 'Food & Refreshments', desc: 'On-site meat grilling, master braaiers, spit braai setups, and authentic township side dishes.', rate: 'From R2,500 / event', keywords: ['braai', 'shisanyama', 'caterer', 'meat grill', 'spit braai'] },
    { slug: 'food-trucks', name: 'Gourmet Food Trucks & Stalls', cluster: 'Food & Refreshments', desc: 'Mobile food trailers, street food pop-ups, artisanal burgers, tacos, and loaded fries.', rate: 'From R1,800 stall fee', keywords: ['food truck', 'street food', 'burgers', 'halal', 'vegan'] },
    { slug: 'mobile-cocktail-bar', name: 'Mobile Cocktail & Gin Bars', cluster: 'Food & Refreshments', desc: 'Pop-up cocktail stations, flair mixologists, mocktails, and mobile craft draught taps.', rate: 'From R3,000 / night', keywords: ['cocktail bar', 'gin bar', 'mixologist', 'bartender', 'drinks'] },
    { slug: 'coffee-juice-vans', name: 'Coffee & Juice Vans', cluster: 'Food & Refreshments', desc: 'Artisan espresso bars, smoothie & fresh cold-pressed juice carts for day & night events.', rate: 'From R1,200 / day', keywords: ['coffee van', 'espresso bar', 'smoothies', 'cold-pressed juice'] },
    { slug: 'event-bakers', name: 'Event Bakers & Pastry Chefs', cluster: 'Food & Refreshments', desc: 'Custom celebration cakes, dessert platters, artisanal pastries, and sweet buffet tables.', rate: 'From R800 / order', keywords: ['event cake', 'baker', 'pastry chef', 'dessert table'] },
    { slug: 'ice-cooler-hire', name: 'Ice, Gas & Cooler Hire', cluster: 'Food & Refreshments', desc: 'Bulk block/tube ice delivery, industrial cooler boxes, gas cylinders, and refrigeration.', rate: 'From R450 / delivery', keywords: ['ice delivery', 'cooler boxes', 'gas cylinders', 'dry ice'] },

    // Logistics & Transport
    { slug: 'bakkie-haulers', name: 'Bakkie & Van Logistics', cluster: 'Logistics & Transport', desc: 'Short-haul bakkie hire, gear transport, cargo moving, and reliable event runners.', rate: 'From R600 / trip', keywords: ['bakkie hire', 'gear transport', 'van haulage', 'event runner'] },
    { slug: 'stage-trucks', name: 'Heavy Gear & Stage Trucks', cluster: 'Logistics & Transport', desc: '4-ton and 8-ton closed body trucks with tail-lifts for stage, truss, and concert PA gear.', rate: 'From R3,500 / day', keywords: ['stage truck', '4 ton truck', '8 ton truck', 'rigging mover'] },
    { slug: 'shuttle-fleets', name: 'Shuttle & Minibus Transport', cluster: 'Logistics & Transport', desc: 'Toyota Quantum and Mercedes Sprinter passenger shuttles for attendees, artists, and crew.', rate: 'From R1,500 / route', keywords: ['event shuttle', 'minibus transport', 'quantum shuttle', 'sprinter'] },
    { slug: 'vip-chauffeur', name: 'VIP Chauffeur & Escort', cluster: 'Logistics & Transport', desc: 'Luxury sedans, tinted SUVs, driver-on-demand for headline artists, DJs, and VIP guests.', rate: 'From R2,000 / night', keywords: ['vip chauffeur', 'luxury car hire', 'artist transport', 'executive driver'] },

    // Sound, Gear & Live Acts
    { slug: 'drum-percussion-rentals', name: 'Drums & Acoustic Percussion Hire', cluster: 'Sound, Gear & Live Acts', desc: 'Acoustic and electronic drum kits, congas, djembe, cymbals, hardware rental for live bands.', rate: 'From R1,200 / gig', keywords: ['drum hire', 'percussion rental', 'djembe', 'congas', 'cymbal pack'] },
    { slug: 'pa-line-array', name: 'PA & Concert Sound Systems Hire', cluster: 'Sound, Gear & Live Acts', desc: 'Active tops, subwoofers, line-arrays, audio crossovers for 100 to 5,000 guests.', rate: 'From R3,500 / rig', keywords: ['pa sound system', 'line array hire', 'subwoofers', 'bass bins', 'concert audio'] },
    { slug: 'dj-gear-cdjs', name: 'DJ Decks & Pioneer CDJ Hire', cluster: 'Sound, Gear & Live Acts', desc: 'Pioneer CDJ-3000s, DJM-900NXS2 mixers, all-in-one XDJ controllers for headline DJs.', rate: 'From R1,800 / set', keywords: ['cdj hire', 'pioneer dj decks', 'djm 900', 'xdj controller'] },
    { slug: 'backline-amps', name: 'Backline, Guitars & Keys Hire', cluster: 'Sound, Gear & Live Acts', desc: 'Bass and guitar amplifier heads, 4x10 cabs, digital stage pianos and synthesizers.', rate: 'From R950 / unit', keywords: ['backline rental', 'bass amp', 'guitar amp', 'stage keyboard'] },
    { slug: 'sound-engineers', name: 'Live Sound & Lighting Engineers', cluster: 'Sound, Gear & Live Acts', desc: 'FOH sound engineers, stage techs, DMX lighting operators, and microphone managers.', rate: 'From R1,500 / gig', keywords: ['sound engineer', 'audio tech', 'lighting technician', 'foh mixer'] },
    { slug: 'session-musicians-mcs', name: 'Local DJs, Vocalists & MCs for Hire', cluster: 'Sound, Gear & Live Acts', desc: 'Amapiano, Afro-house, Hip-hop DJs, hype MCs, live saxophonists, and session vocalists.', rate: 'From R2,000 / set', keywords: ['hire dj', 'event mc', 'saxophonist', 'live vocalist', 'performer'] },

    // Fashion & Grooming
    { slug: 'fashion-designers', name: 'Custom Event Designers & Stylists', cluster: 'Fashion & Grooming', desc: 'Bespoke event outfits, dress code tailoring, modern African prints, and styling consultations.', rate: 'From R1,200 / outfit', keywords: ['fashion designer', 'event stylist', 'african print dress', 'custom suit'] },
    { slug: 'streetwear-popups', name: 'Streetwear Pop-Up Brands', cluster: 'Fashion & Grooming', desc: 'Local streetwear labels, graphic tees, hoodies, headwear, and festival merchandise pop-ups.', rate: 'From R350 / item', keywords: ['streetwear popup', 'graphic hoodies', 'festival merch', 'caps'] },
    { slug: 'mobile-barbers', name: 'Mobile Barbers & Edge-Ups', cluster: 'Fashion & Grooming', desc: 'On-demand fade, beard grooming, edge-ups, and lineup cuts before events.', rate: 'From R200 / cut', keywords: ['mobile barber', 'haircut fade', 'beard grooming', 'event barber'] },
    { slug: 'makeup-artists-mua', name: 'Makeup Artists (MUA) & Hair Stylists', cluster: 'Fashion & Grooming', desc: 'Glam event makeup, braiding, wig installations, nail technicians, and lash artists.', rate: 'From R450 / session', keywords: ['mua', 'event makeup', 'braids', 'wig installation', 'lashes'] },

    // Venue, Staging & Comfort
    { slug: 'bedouin-stretch-tents', name: 'Bedouin & Stretch Tents Hire', cluster: 'Venue, Staging & Comfort', desc: 'Waterproof stretch marquees, peg & pole tents, gazebos with rigging crews.', rate: 'From R3,000 / tent', keywords: ['stretch tent hire', 'bedouin tent', 'event marquee', 'gazebo rental'] },
    { slug: 'staging-truss-rigging', name: 'Staging & Truss Rigging Hire', cluster: 'Venue, Staging & Comfort', desc: 'Modular stage decks, crowd barriers, aluminum box truss, and roof covers.', rate: 'From R4,000 / setup', keywords: ['stage hire', 'truss rigging', 'crowd barriers', 'stage roof'] },
    { slug: 'mobile-toilets', name: 'Mobile Toilets & Sanitation Hire', cluster: 'Venue, Staging & Comfort', desc: 'Standard chemical toilets, VIP luxury trailer toilets, janitor attendants.', rate: 'From R850 / toilet', keywords: ['mobile toilets', 'portaloo hire', 'vip toilet trailer', 'event sanitation'] },
    { slug: 'event-furniture', name: 'Lounge Pods & Event Furniture Hire', cluster: 'Venue, Staging & Comfort', desc: 'Pallet seating, VIP couches, cocktail high-tables, barstools, and ottomans.', rate: 'From R1,500 / lounge set', keywords: ['event furniture hire', 'vip couches', 'cocktail tables', 'pallet lounge'] },

    // Safety, Media & Sports
    { slug: 'bouncers-security', name: 'Bouncers & Crowd Security Marshals', cluster: 'Safety, Media & Sports', desc: 'PSIRA-registered event security, entrance search marshals, and VIP protection.', rate: 'From R650 / guard / shift', keywords: ['event security', 'bouncers hire', 'crowd marshals', 'psira security'] },
    { slug: 'paramedics-first-aid', name: 'Certified Medics & Event First Aid', cluster: 'Safety, Media & Sports', desc: 'Event medical officers, mobile first-aid station, and standby ambulance support.', rate: 'From R2,200 / event', keywords: ['event medics', 'first aid standby', 'private ambulance', 'paramedic'] },
    { slug: 'photographers-360', name: '360 Spinners & Event Photographers', cluster: 'Safety, Media & Sports', desc: '360 video booth platform, DSLR roamers, photo backdrops, and instant digital drops.', rate: 'From R2,500 / 3 hours', keywords: ['360 photo booth', 'event photographer', 'video booth hire'] },
    { slug: 'drone-videography', name: 'Drone Videographers & Media Crews', cluster: 'Safety, Media & Sports', desc: 'FPV and 4K aerial drone operators, recap after-movie production, and live multi-cam.', rate: 'From R3,000 / recap video', keywords: ['drone video', 'event videographer', 'aftermovie', 'fpv drone'] },
  ];

  console.log(`[build-seo-hubs] Generating ${SERVICES.length} Programmatic Event Business & Hustler Directory Hubs...`);

  // Master Services Directory Index Page (/services/index.html)
  const masterServicesJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'Event Business & Hustler Services Directory South Africa',
    'description': 'Browse verified event service providers: caterers, sound system rentals, trucks, stage rigging, fashion designers, security, and photographers.',
    'itemListElement': SERVICES.map((s, idx) => ({
      '@type': 'ListItem',
      'position': idx + 1,
      'name': s.name,
      'url': `${SITE}/services/${s.slug}`,
    })),
  };

  const masterServicesBody = `
    <div class="breadcrumbs">
      <a href="${SITE}/">Home</a> <span>›</span>
      <span style="color:#fff;">Event Services Directory</span>
    </div>

    <h1 class="hero-title">Event Services & <span class="brand-accent">Hustler Marketplace</span></h1>
    <p class="hero-lead">Connect with certified local service providers for your upcoming festival, concert, wedding, or bash. From spit braai catering and stage sound hire to bakkie logistics and fashion styling — protected with PayFast escrow.</p>

    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-bottom: 48px;">
      ${SERVICES.map(s => `
        <a href="${SITE}/services/${s.slug}" class="event-card" style="padding: 20px;">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: var(--primary); margin-bottom: 6px;">${escapeHtml(s.cluster)}</div>
          <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">${escapeHtml(s.name)}</h3>
          <p style="font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5;">${escapeHtml(s.desc)}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px; margin-top: auto;">
            <span style="font-weight: 800; color: #fff; font-size: 13px;">${escapeHtml(s.rate)}</span>
            <span class="btn-view">Browse Providers →</span>
          </div>
        </a>
      `).join('')}
    </div>

    <div class="resident-banner">
      <div class="resident-banner-text">
        <h3>Are you an Event Service Provider or Gear Owner?</h3>
        <p>List your bakkie, sound rig, braai catering, or photography business on The Gruvs to receive booking leads from upcoming events 30–90 days in advance.</p>
      </div>
      <a href="${SITE}/?provider_signup=true" class="resident-btn">Join Provider Network →</a>
    </div>
  `;

  const masterServicesHtml = renderHtmlShell({
    title: 'Event Services & Equipment Hire Directory South Africa — The Gruvs',
    description: 'Find, compare, and book event caterers, sound systems, stage rigging, bakkie haulers, fashion designers, and DJs in South Africa. PayFast escrow protected.',
    canonicalUrl: `${SITE}/services`,
    jsonLd: [masterServicesJsonLd],
    bodyContent: masterServicesBody,
    breadcrumbs: [{ name: 'Home', url: `${SITE}/` }, { name: 'Services', url: `${SITE}/services` }],
  });
  writePage('services/index.html', masterServicesHtml);
  generatedPages.push({ loc: `${SITE}/services`, priority: '0.90', changefreq: 'weekly' });

  // Generate individual Service Category Hubs (/services/[category-slug]/index.html)
  for (const s of SERVICES) {
    const serviceJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      'name': s.name,
      'description': s.desc,
      'serviceType': s.name,
      'provider': {
        '@type': 'LocalBusiness',
        'name': `${s.name} Network on The Gruvs`,
        'image': `${SITE}/og-default.jpg`,
        'priceRange': s.rate,
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Johannesburg',
          'addressCountry': 'ZA',
        },
      },
      'areaServed': {
        '@type': 'Country',
        'name': 'South Africa',
      },
      'offers': {
        '@type': 'Offer',
        'price': s.rate.replace(/[^0-9]/g, '') || '500',
        'priceCurrency': 'ZAR',
        'availability': 'https://schema.org/InStock',
        'url': `${SITE}/services/${s.slug}`,
      },
    };

    const serviceFaqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': `How do I book ${s.name.toLowerCase()} on The Gruvs?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `Browse verified local providers on The Gruvs app, review their past event ratings, and book with PayFast escrow protection. Payment is only released to the provider after service completion.`,
          },
        },
        {
          '@type': 'Question',
          'name': `What are the average rates for ${s.name.toLowerCase()}?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `Rates typically start ${s.rate.toLowerCase()}, depending on duration, crowd size, and distance. Quotes can be requested directly in-app.`,
          },
        },
        {
          '@type': 'Question',
          'name': `Can I list my own ${s.name.toLowerCase()} business?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `Yes! Event service providers, gear owners, and freelancers can register their profile for free on The Gruvs to receive automated leads for events scheduled 30–90 days ahead.`,
          },
        },
      ],
    };

    const serviceBody = `
      <div class="breadcrumbs">
        <a href="${SITE}/">Home</a> <span>›</span>
        <a href="${SITE}/services">Services</a> <span>›</span>
        <span style="color:#fff;">${escapeHtml(s.name)}</span>
      </div>

      <div style="background: linear-gradient(135deg, rgba(0, 242, 255, 0.08), rgba(0,0,0,0.4)); border: 1px solid var(--surface-border); border-radius: 18px; padding: 32px 24px; margin-bottom: 32px;">
        <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: var(--primary); display: inline-block; margin-bottom: 8px;">${escapeHtml(s.cluster)}</span>
        <h1 class="hero-title" style="margin-bottom: 12px;">${escapeHtml(s.name)} for Events in South Africa</h1>
        <p class="hero-lead" style="margin-bottom: 20px;">${escapeHtml(s.desc)}</p>
        
        <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
          <div style="background: rgba(255,255,255,0.06); padding: 8px 16px; border-radius: 10px; font-size: 14px; font-weight: 800;">
            💰 Standard Pricing: <span style="color: var(--primary);">${escapeHtml(s.rate)}</span>
          </div>
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; color: #10b981;">
            🔒 PayFast Escrow Protected
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 40px;">
        <div style="background: var(--surface); border: 1px solid var(--surface-border); border-radius: 16px; padding: 24px;">
          <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 12px; color: #fff;">Need ${escapeHtml(s.name)} for Your Event?</h2>
          <p style="font-size: 14px; color: var(--muted); margin-bottom: 20px; line-height: 1.6;">
            Event organizers can browse vetted service providers, check social integrity ratings, and submit booking requests with instant quotes. Funds are locked securely in PayFast escrow until you verify delivery at the venue.
          </p>
          <a href="${SITE}/?search_service=${s.slug}" class="nav-cta" style="display: block; text-align: center;">Book Verified Providers in App →</a>
        </div>

        <div style="background: var(--surface); border: 1px solid var(--surface-border); border-radius: 16px; padding: 24px;">
          <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 12px; color: #fff;">Are You a Hustler or Equipment Owner?</h2>
          <p style="font-size: 14px; color: var(--muted); margin-bottom: 20px; line-height: 1.6;">
            Get matched with upcoming concerts, parties, and festivals in your radius. Our proactive 90-day lead engine alerts you whenever an event is announced so you can pitch your service first.
          </p>
          <a href="${SITE}/?provider_signup=${s.slug}" class="resident-btn" style="display: block; text-align: center;">List Your ${escapeHtml(s.name)} Business →</a>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--surface-border); border-radius: 16px; padding: 24px; margin-bottom: 40px;">
        <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 16px;">Frequently Asked Questions</h3>
        <div style="margin-bottom: 16px;">
          <strong style="color: #fff; font-size: 15px; display: block; margin-bottom: 4px;">How does escrow payment work?</strong>
          <p style="color: var(--muted); font-size: 14px; line-height: 1.5;">When an organizer books you, the money is safely captured and held by PayFast. Once the event concludes and service delivery is confirmed, funds are automatically transferred to your verified South African bank account.</p>
        </div>
        <div style="margin-bottom: 16px;">
          <strong style="color: #fff; font-size: 15px; display: block; margin-bottom: 4px;">What areas are covered?</strong>
          <p style="color: var(--muted); font-size: 14px; line-height: 1.5;">The Gruvs services directory operates nationwide across Johannesburg, Pretoria, Midrand, Soweto, Tembisa, Cape Town, Durban, Bloemfontein, and surrounding townships.</p>
        </div>
      </div>

      <div class="resident-banner">
        <div class="resident-banner-text">
          <h3>Crew & Vendor Accommodation Near Venues</h3>
          <p>Traveling for a weekend setup or gig? Find affordable crew lodging and rooms near South African event venues on The Resident Crew.</p>
        </div>
        <a href="https://theresidentcrew.com" target="_blank" rel="noopener" class="resident-btn">Find Crew Stays →</a>
      </div>
    `;

    const serviceHtml = renderHtmlShell({
      title: `${s.name} for Events & Festivals in South Africa | The Gruvs`,
      description: `Hire certified ${s.name.toLowerCase()} for upcoming concerts, weddings, and parties across South Africa. ${s.rate}. PayFast escrow guaranteed.`,
      canonicalUrl: `${SITE}/services/${s.slug}`,
      jsonLd: [serviceJsonLd, serviceFaqJsonLd],
      bodyContent: serviceBody,
      breadcrumbs: [
        { name: 'Home', url: `${SITE}/` },
        { name: 'Services', url: `${SITE}/services` },
        { name: s.name, url: `${SITE}/services/${s.slug}` },
      ],
    });

    writePage(`services/${s.slug}/index.html`, serviceHtml);
    generatedPages.push({ loc: `${SITE}/services/${s.slug}`, priority: '0.88', changefreq: 'weekly' });
  }

  // ── Extract & Generate Dedicated Venue Hubs ──────────────────────────────
  const venueMap = new Map();
  for (const e of events) {
    if (!e.venue_name) continue;
    const vName = e.venue_name.trim();
    const vSlug = slugify(vName);
    if (!vSlug) continue;
    if (!venueMap.has(vSlug)) {
      venueMap.set(vSlug, {
        slug: vSlug,
        name: vName,
        city: e.city || 'South Africa',
        address: e.address || `${vName}, ${e.city || 'South Africa'}`,
        lat: e.lat,
        lon: e.lon,
        cover: e.cover_url || e.cover_image,
        events: [],
      });
    }
    venueMap.get(vSlug).events.push(e);
  }

  console.log(`[build-seo-hubs] Generating ${venueMap.size} dedicated Venue Hubs...`);

  for (const [vSlug, v] of venueMap.entries()) {
    const venueEvents = v.events;
    const venueJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'EventVenue',
      'name': v.name,
      'address': {
        '@type': 'PostalAddress',
        'streetAddress': v.address,
        'addressLocality': v.city,
        'addressCountry': 'ZA',
      },
      ...(v.lat && v.lon ? {
        'geo': {
          '@type': 'GeoCoordinates',
          'latitude': v.lat,
          'longitude': v.lon,
        }
      } : {}),
      'image': v.cover || `${SITE}/og-default.jpg`,
      'url': `${SITE}/venues/${vSlug}`,
    };

    const itemListJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': `Upcoming Events at ${v.name}`,
      'itemListElement': venueEvents.slice(0, 20).map((e, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'item': {
          '@type': 'Event',
          'name': e.title,
          'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
          'url': `${SITE}/events/${eventSlug(e)}`,
        },
      })),
    };

    const breadcrumbs = [
      { name: 'Home', url: `${SITE}/` },
      { name: 'Venues', url: `${SITE}/venues` },
      { name: v.name, url: `${SITE}/venues/${vSlug}` },
    ];

    const body = `
      <div class="breadcrumbs">
        <a href="${SITE}/">Home</a> <span>›</span>
        <a href="${SITE}/events/${slugify(v.city)}">${escapeHtml(v.city)}</a> <span>›</span>
        <span style="color:#fff;">${escapeHtml(v.name)}</span>
      </div>

      <h1 class="hero-title">Events at <span class="brand-accent">${escapeHtml(v.name)}</span></h1>
      <p class="hero-lead">📍 ${escapeHtml(v.address)}. What's listed there on The Gruvs, with dates and directions.</p>

      <div style="background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.18); border-radius:12px; padding:16px 20px; margin-bottom:32px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <strong style="color:#fff; font-size:15px; display:block;">Are you the venue owner or manager of ${escapeHtml(v.name)}?</strong>
          <span style="color:var(--muted); font-size:13px;">Claim this venue hub to manage upcoming listings, set table minimums, and connect with patrons.</span>
        </div>
        <a href="${SITE}/?claim_venue=${vSlug}" class="resident-btn" style="background:transparent; border:1px solid var(--primary); color:var(--primary); padding:8px 16px; font-size:13px; font-weight:700;">Claim Venue Profile →</a>
      </div>

      <div class="resident-banner">
        <div class="resident-banner-text">
          <h3>Need Accommodation near ${escapeHtml(v.name)}?</h3>
          <p>Find secure guest houses, rooms, and apartments near ${escapeHtml(v.name)} on The Resident Crew.</p>
        </div>
        <a href="https://theresidentcrew.com" target="_blank" rel="noopener" class="resident-btn">Find Stays Nearby →</a>
      </div>

      <h2 style="font-size:20px; font-weight:800; margin-bottom:20px;">Upcoming Dates (${venueEvents.length})</h2>
      <div class="event-grid">
        ${venueEvents.map(renderEventCard).join('')}
      </div>
    `;

    const html = renderHtmlShell({
      title: `Upcoming Events at ${v.name}, ${v.city} — Schedule & Tickets | The Gruvs`,
      description: `View upcoming events, concerts, and parties at ${v.name} in ${v.city}. Dates, directions and how to RSVP on The Gruvs.`,
      canonicalUrl: `${SITE}/venues/${vSlug}`,
      ogImage: v.cover,
      jsonLd: [venueJsonLd, itemListJsonLd],
      bodyContent: body,
      breadcrumbs,
    });

    writePage(`venues/${vSlug}/index.html`, html);
    generatedPages.push({ loc: `${SITE}/venues/${vSlug}`, priority: '0.88', changefreq: 'daily' });
  }

  // ── Generate Individual Event Landing Pages ───────────────────────────────
  for (const e of events) {
    const slug = eventSlug(e);
    const cover = e.cover_url || e.cover_image || (Array.isArray(e.media_urls) && e.media_urls[0]) || `${SITE}/og-default.jpg`;
    const dateStr = formatDate(e.event_date, e.event_time);
    const venue = [e.venue_name, e.city].filter(Boolean).join(' · ');
    const price = e.price === 'FREE' || e.price === 0 ? 'Free entry' : (typeof e.price === 'string' && !e.price.startsWith('{') ? e.price : 'Tickets Available');

    // Extract numerical price for Schema.org
    let schemaPrice = '0';
    if (typeof e.price === 'number') {
      schemaPrice = String(e.price);
    } else if (typeof e.price === 'string') {
      const priceMatch = e.price.match(/(?:R|ZAR)\s*([0-9,]+)/i) || e.price.match(/"(?:general|early_bird|standard|tier_1)":\s*"([0-9]+)"/i);
      if (priceMatch) {
        schemaPrice = priceMatch[1].replace(/,/g, '');
      } else if (e.price.toLowerCase().includes('free')) {
        schemaPrice = '0';
      }
    }

    const eventJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      'name': e.title,
      'description': e.description || `${e.title} at ${venue}`,
      'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
      ...(e.end_date ? { 'endDate': `${e.end_date}T${e.end_time ? e.end_time.slice(0, 5) : '23:59'}:00+02:00` } : {}),
      'eventStatus': 'https://schema.org/EventScheduled',
      'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
      'location': {
        '@type': 'Place',
        'name': e.venue_name || e.city || 'Johannesburg, South Africa',
        'address': {
          '@type': 'PostalAddress',
          'streetAddress': e.address || e.venue_name || '',
          'addressLocality': e.city || 'Johannesburg',
          'addressCountry': 'ZA',
        },
        ...(e.lat && e.lon ? {
          'geo': {
            '@type': 'GeoCoordinates',
            'latitude': e.lat,
            'longitude': e.lon,
          }
        } : {}),
      },
      'image': [cover],
      'offers': {
        '@type': 'Offer',
        'url': `${SITE}/events/${slug}`,
        'price': schemaPrice,
        'priceCurrency': 'ZAR',
        'availability': 'https://schema.org/InStock',
        'validFrom': e.event_date || today,
      },
      'organizer': {
        '@type': 'Organization',
        'name': APP_NAME,
        'url': SITE,
        'logo': `${SITE}/logo.png`,
      },
    };

    const eventFaqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': `When and where is ${e.title}?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `${e.title} takes place on ${dateStr} at ${venue}. Directions and ticket booking are available on The Gruvs.`,
          },
        },
        {
          '@type': 'Question',
          'name': `How much are tickets for ${e.title}?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': price === 'Free entry' ? `${e.title} is free entry with RSVP on The Gruvs.` : `Tickets are ${price}. You can secure your tickets directly through The Gruvs.`,
          },
        },
        {
          '@type': 'Question',
          'name': `Is there accommodation near ${e.venue_name || 'the venue'}?`,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': `Yes, verified local guest houses, apartments, and rooms near ${venue} can be booked through The Resident Crew partner network.`,
          },
        },
      ],
    };

    const breadcrumbs = [
      { name: 'Home', url: `${SITE}/` },
      { name: 'Events', url: `${SITE}/events` },
      ...(e.city ? [{ name: e.city, url: `${SITE}/events/${slugify(e.city)}` }] : []),
      { name: e.title, url: `${SITE}/events/${slug}` },
    ];

    const dateOnly = (e.event_date || '2026-12-01').replace(/-/g, '');
    const timeOnly = (e.event_time ? e.event_time.slice(0, 5).replace(':', '') : '1800') + '00';
    const calStart = `${dateOnly}T${timeOnly}`;
    const calEnd = `${dateOnly}T235900`;
    const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${calStart}/${calEnd}&details=${encodeURIComponent(e.description || e.title)}&location=${encodeURIComponent(venue)}&sprop=website:${SITE}`;
    const cleanTitle = (e.title || '').replace(/[\r\n]+/g, ' ');
    const cleanDesc = (e.description || e.title || '').replace(/[\r\n]+/g, ' ');
    const cleanVenue = venue.replace(/[\r\n]+/g, ' ');
    const icsContent = encodeURIComponent(`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//The Gruvs//ZA\nBEGIN:VEVENT\nSUMMARY:${cleanTitle}\nDESCRIPTION:${cleanDesc}\nLOCATION:${cleanVenue}\nDTSTART:${calStart}\nDTEND:${calEnd}\nEND:VEVENT\nEND:VCALENDAR`);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Pull up with me to ${cleanTitle} at ${cleanVenue} on ${dateStr}! See it on The Gruvs: ${SITE}/events/${slug}`)}`;

    const body = `
      <div class="breadcrumbs">
        <a href="${SITE}/">Home</a> <span>›</span>
        <span>Events</span> <span>›</span>
        ${e.city ? `<a href="${SITE}/events/${slugify(e.city)}">${escapeHtml(e.city)}</a> <span>›</span>` : ''}
        <span style="color:#fff;">${escapeHtml(e.title)}</span>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 32px; align-items: start; margin-top: 16px;">
        <div>
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(e.title)}" style="width:100%; border-radius:18px; border:1px solid var(--surface-border); box-shadow: 0 16px 40px rgba(0,0,0,0.6);" />
          
          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:16px;">
            <a href="${gCalUrl}" target="_blank" rel="noopener" style="flex:1; min-width:140px; text-align:center; background:#1a2327; border:1px solid #00f2ff44; color:#00f2ff; padding:10px 14px; border-radius:10px; font-size:13px; font-weight:700; text-decoration:none;">
              📅 + Google Cal
            </a>
            <a href="data:text/calendar;charset=utf8,${icsContent}" download="${slug}.ics" style="flex:1; min-width:140px; text-align:center; background:#1a2327; border:1px solid rgba(255,255,255,0.18); color:#fff; padding:10px 14px; border-radius:10px; font-size:13px; font-weight:700; text-decoration:none;">
              📥 Download .ics
            </a>
            <a href="${waUrl}" target="_blank" rel="noopener" style="width:100%; text-align:center; background:#25D366; color:#000; padding:11px 16px; border-radius:10px; font-size:13px; font-weight:800; text-decoration:none; display:block;">
              💬 WhatsApp Squad Invite
            </a>
          </div>
        </div>
        <div>
          <div style="color:var(--primary); font-weight:800; font-size:14px; text-transform:uppercase; margin-bottom:8px;">${escapeHtml(dateStr)}</div>
          <h1 style="font-size:clamp(24px, 3.5vw, 36px); font-weight:900; margin-bottom:12px; line-height:1.2;">${escapeHtml(e.title)}</h1>
          <p style="font-size:16px; color:var(--muted); margin-bottom:20px;">📍 ${escapeHtml(venue)}</p>
          
          <div style="background:var(--surface); border:1px solid var(--surface-border); border-radius:14px; padding:20px; margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-size:13px; color:var(--muted); display:block;">Price</span>
                <span style="font-size:22px; font-weight:900; color:#fff;">${escapeHtml(price)}</span>
              </div>
              <a href="${SITE}/?event=${e.id}" class="nav-cta" style="font-size:16px; padding:12px 24px;">Book & Vibe in App →</a>
            </div>
          </div>

          <div style="color:rgba(255,255,255,0.8); line-height:1.7; font-size:15px; margin-bottom:28px;">
            <p>${escapeHtml(e.description || 'Join this live experience on The Gruvs.')}</p>
          </div>

          <div class="resident-banner" style="margin: 20px 0;">
            <div class="resident-banner-text">
              <h3>Need accommodation near ${escapeHtml(e.venue_name || e.city || 'this venue')}?</h3>
              <p>Find places to stay near the venue on The Resident Crew.</p>
            </div>
            <a href="https://theresidentcrew.com" target="_blank" rel="noopener" class="resident-btn">Find Stays →</a>
          </div>

          <div style="background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.18); border-radius:12px; padding:14px 18px; margin-top:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <strong style="color:#fff; font-size:14px; display:block;">Are you the promoter or venue?</strong>
              <span style="color:var(--muted); font-size:13px;">Claim this listing to update times, add tickets, and connect.</span>
            </div>
            <a href="${SITE}/?claim=${e.id}" class="resident-btn" style="background:transparent; border:1px solid var(--primary); color:var(--primary); padding:6px 14px; font-size:13px;">Claim Listing →</a>
          </div>
        </div>
      </div>
    `;

    const html = renderHtmlShell({
      title: `${e.title} — ${venue} | The Gruvs`,
      description: `${e.title} taking place on ${dateStr} at ${venue}. Book tickets and connect on The Gruvs.`,
      canonicalUrl: `${SITE}/events/${slug}`,
      ogImage: cover,
      jsonLd: [eventJsonLd, eventFaqJsonLd],
      bodyContent: body,
      breadcrumbs,
    });

    writePage(`events/${slug}/index.html`, html);
    generatedPages.push({
      loc: `${SITE}/events/${slug}`,
      lastmod: (e.updated_at || e.event_date || today).slice(0, 10),
      priority: '0.85',
      changefreq: 'daily',
      image: {
        loc: cover,
        title: e.title,
        caption: venue,
      },
    });
  }

  // ── Generate RSS / Atom feed ──────────────────────────────────────────────
  const rssItems = events.slice(0, 50).map(e => {
    const slug = eventSlug(e);
    const cover = e.cover_url || e.cover_image || (Array.isArray(e.media_urls) && e.media_urls[0]) || `${SITE}/og-default.jpg`;
    return `
    <item>
      <title><![CDATA[${e.title}]]></title>
      <link>${SITE}/events/${slug}</link>
      <guid isPermaLink="true">${SITE}/events/${slug}</guid>
      <pubDate>${new Date(e.updated_at || e.event_date || today).toUTCString()}</pubDate>
      <description><![CDATA[${e.description || `${e.title} on ${formatDate(e.event_date, e.event_time)} at ${e.venue_name || e.city}`}]]></description>
      <enclosure url="${cover}" type="image/jpeg" />
      <category>${escapeHtml(e.category || 'Events')}</category>
    </item>`;
  }).join('');

  const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>The Gruvs — Live Events Feed</title>
  <link>${SITE}/</link>
  <description>Live upcoming nightlife, festivals, music, and cultural events across South Africa.</description>
  <language>en-za</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
  ${rssItems}
</channel>
</rss>`;

  writePage('feed.xml', rssXml);
  console.log('[build-seo-hubs] Generated public/feed.xml with 50 live events.');

  console.log(`[build-seo-hubs] Successfully generated ${generatedPages.length} programmatic SEO pages.`);
  console.log(`  - ${CITIES.length} City Hubs (Johannesburg, Cape Town, Durban, Pretoria, Sandton, Soweto, etc.)`);
  console.log(`  - ${GENRES.length} Category & Vertical Hubs (Music, Nightlife, Tech, FinTech, Mining, VC, Real Estate)`);
  console.log(`  - ${MONTH_HUBS.length} Monthly Calendar Directory Hubs (Dec 2026 – May 2027)`);
  console.log(`  - ${MARQUEE_SEASONS.length + 3} Flagship Seasonal Hubs (Ke Dezemba, NYE 2027, Easter, Valentines, Freedom Day, Africa Day, This Weekend)`);
  console.log(`  - ${INTERSECTION_HUBS.length} Localized City x Category Intersection Hubs`);
  console.log(`  - ${SERVICES.length} Event Business & Hustler Directory Hubs`);
  console.log(`  - ${venueMap.size} Dedicated Venue Hubs`);
  console.log(`  - ${events.length} Per-Event SEO Slug Pages`);
})();
