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

  return `<!DOCTYPE html>
<html lang="en-ZA">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escTitle}</title>
  <meta name="description" content="${escDesc}" />
  <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}" />
  <link rel="canonical" href="${escUrl}" />

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

  <footer class="site-footer">
    <p>© ${new Date().getFullYear()} The Gruvs · South Africa's Live Event & Vibe Discovery Platform.</p>
    <p style="margin-top: 8px;">
      <a href="${SITE}/">Home</a> · 
      <a href="${SITE}/events/ke-dezemba">Ke Dezemba</a> · 
      <a href="${SITE}/events/johannesburg">Johannesburg</a> · 
      <a href="${SITE}/events/pretoria">Pretoria</a> · 
      <a href="${SITE}/events/midrand">Midrand</a> · 
      <a href="https://theresidentcrew.com" target="_blank" rel="noopener">Find Stays on The Resident</a>
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
        events = await res.json();
        console.log(`[build-seo-hubs] Loaded ${events.length} live upcoming events from Supabase.`);
      }
    } catch (e) {
      console.warn('[build-seo-hubs] Failed to fetch events from Supabase:', e.message);
    }
  }

  // Merge Supabase live events with comprehensive catalog events (3,000+ items)
  const catalogPath = path.join(publicDir, 'data', 'events-catalog.json');
  let catalogEvents = [];
  if (fs.existsSync(catalogPath)) {
    try {
      catalogEvents = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      console.log(`[build-seo-hubs] Loaded ${catalogEvents.length} events from events-catalog.json.`);
    } catch {}
  }

  const seenIds = new Set(events.map(e => e.id));
  for (const ce of catalogEvents) {
    if (!seenIds.has(ce.id)) {
      events.push(ce);
      seenIds.add(ce.id);
    }
  }
  console.log(`[build-seo-hubs] Total unified event dataset: ${events.length} events.`);

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
  ];

  // 2. Genre Definitions (Expanded across all South African Music & Event Subcultures)
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

    const html = renderHtmlShell({
      title: `Upcoming Events in ${c.name} (${now.getFullYear()}) — The Gruvs`,
      description: `Discover upcoming events, nightlife, and festivals in ${c.name}. Dates, venues and directions on The Gruvs.`,
      canonicalUrl: `${SITE}/events/${c.slug}`,
      jsonLd: activeList.length ? [itemListJsonLd] : [],
      bodyContent: body,
      breadcrumbs,
      noindex: activeList.length === 0,
    });

    writePage(`events/${c.slug}/index.html`, html);
    if (activeList.length) generatedPages.push({ loc: `${SITE}/events/${c.slug}`, priority: '0.9', changefreq: 'daily' });
  }

  // ── Generate Genre Hubs ───────────────────────────────────────────────────
  for (const g of GENRES) {
    const genreEvents = events.filter(e => {
      const catText = `${e.category || ''} ${e.title || ''} ${e.description || ''}`.toLowerCase();
      return catText.includes(g.slug.replace('-', ' ')) || catText.includes(g.name.toLowerCase());
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

    const html = renderHtmlShell({
      title: `${g.name} Events & Parties in South Africa (${now.getFullYear()}) — The Gruvs`,
      description: `Experience the top ${g.name} events, DJ sets, and festivals in Gauteng and South Africa. See dates and RSVP on The Gruvs.`,
      canonicalUrl: `${SITE}/events/${g.slug}`,
      jsonLd: activeList.length ? [itemListJsonLd] : [],
      bodyContent: body,
      breadcrumbs,
      noindex: activeList.length === 0,
    });

    writePage(`events/${g.slug}/index.html`, html);
    if (activeList.length) generatedPages.push({ loc: `${SITE}/events/${g.slug}`, priority: '0.9', changefreq: 'daily' });
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
    noindex: keDezembaList.length === 0,
    breadcrumbs: [
      { name: 'Home', url: `${SITE}/` },
      { name: 'Ke Dezemba 2026', url: `${SITE}/events/ke-dezemba` },
    ],
  });

  writePage('events/ke-dezemba/index.html', keDezembaHtml);
  if (keDezembaList.length) generatedPages.push({ loc: `${SITE}/events/ke-dezemba`, priority: '0.95', changefreq: 'daily' });

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
    noindex: activeWeekend.length === 0,
    breadcrumbs: [{ name: 'Home', url: `${SITE}/` }, { name: 'This Weekend', url: `${SITE}/events/this-weekend` }],
  });
  writePage('events/this-weekend/index.html', weekendHtml);
  if (activeWeekend.length) generatedPages.push({ loc: `${SITE}/events/this-weekend`, priority: '0.95', changefreq: 'daily' });

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
    noindex: activeNye.length === 0,
    breadcrumbs: [{ name: 'Home', url: `${SITE}/` }, { name: "New Year's Eve 2027", url: `${SITE}/events/nye-2027` }],
  });
  writePage('events/nye-2027/index.html', nyeHtml);
  if (activeNye.length) generatedPages.push({ loc: `${SITE}/events/nye-2027`, priority: '0.95', changefreq: 'daily' });

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

    const eventJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      'name': e.title,
      'description': e.description || `${e.title} at ${venue}`,
      'startDate': `${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : '18:00'}:00+02:00`,
      'eventStatus': 'https://schema.org/EventScheduled',
      'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
      'location': {
        '@type': 'Place',
        'name': e.venue_name || e.city || 'Johannesburg, South Africa',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': e.city || 'Johannesburg',
          'addressRegion': 'Gauteng',
          'addressCountry': 'ZA',
        },
      },
      'image': [cover],
      'offers': {
        '@type': 'Offer',
        'url': `${SITE}/events/${slug}`,
        'price': typeof e.price === 'number' ? String(e.price) : '0',
        'priceCurrency': 'ZAR',
        'availability': 'https://schema.org/InStock',
        'validFrom': e.event_date || today,
      },
      'organizer': {
        '@type': 'Organization',
        'name': APP_NAME,
        'url': SITE,
      },
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
      jsonLd: [eventJsonLd],
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
  console.log(`  - 8 City Hubs (Midrand, JHB, Pretoria, Soweto, Tembisa, etc.)`);
  console.log(`  - 6 Genre Hubs (Amapiano, Afro-Tech, Nightlife, etc.)`);
  console.log(`  - 1 Ke Dezemba 2026 Flagship Hub`);
  console.log(`  - ${events.length} Per-Event SEO Slug Pages`);
})();
