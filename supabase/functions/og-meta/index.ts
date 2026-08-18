/**
 * og-meta — Supabase Edge Function (Deno)
 *
 * Handles share links and injects dynamic Open Graph meta tags for social crawlers.
 * Real users (non-crawlers) are redirected to the SPA immediately.
 * Crawlers (Facebook, Twitter, WhatsApp, Telegram, LinkedIn, Slack, iMessage) get
 * a full HTML shell with correct og: / twitter: tags baked in.
 *
 * Routes:
 *   /functions/v1/og-meta/event/<id>
 *   /functions/v1/og-meta/profile/<username>
 *   /functions/v1/og-meta/reel/<id>
 *
 * Deploy: supabase functions deploy og-meta
 */

import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')             || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const APP_URL             = Deno.env.get('APP_URL')                  || 'https://thegruvs.com';
const APP_NAME            = 'The Gruvs';
const DEFAULT_OG_IMAGE    = `${APP_URL}/og-default.jpg`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Bot / crawler detection ──────────────────────────────────────────────────
const CRAWLER_PATTERNS = [
  /facebookexternalhit/i,
  /twitterbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /linkedinbot/i,
  /slackbot/i,
  /discordbot/i,
  /applebot/i,
  /googlebot/i,
  /bingbot/i,
  /iMessage/i,
  /imessage/i,
  /Previewer/i,
  /Iframely/i,
  /Embedly/i,
  /outbrain/i,
  /pinterest/i,
  /vkShare/i,
  /W3C_Validator/i,
];

function isCrawler(ua: string): boolean {
  return CRAWLER_PATTERNS.some(p => p.test(ua));
}

// ─── HTML builder ─────────────────────────────────────────────────────────────
interface OGProps {
  title: string;
  description: string;
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  url: string;
  type?: 'website' | 'article' | 'profile' | 'video.other';
  videoUrl?: string;
  siteName?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'player';
  themeColor?: string;
  jsonLd?: Record<string, unknown>;
}

function buildHtml(og: OGProps, redirectUrl: string): string {
  const {
    title, description, image, imageWidth = 1200, imageHeight = 630,
    imageAlt, url, type = 'website', videoUrl,
    siteName = APP_NAME, twitterCard = 'summary_large_image',
    themeColor = '#0d1112', jsonLd,
  } = og;

  const escapedTitle       = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedImageAlt    = escapeHtml(imageAlt || title);

  return `<!DOCTYPE html>
<html lang="en-ZA">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDescription}" />
  <meta name="theme-color" content="${themeColor}" />

  <!-- Open Graph -->
  <meta property="og:type"        content="${type}" />
  <meta property="og:site_name"   content="${escapeHtml(siteName)}" />
  <meta property="og:title"       content="${escapedTitle}" />
  <meta property="og:description" content="${escapedDescription}" />
  <meta property="og:url"         content="${escapeHtml(url)}" />
  <meta property="og:image"       content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="${imageWidth}" />
  <meta property="og:image:height" content="${imageHeight}" />
  <meta property="og:image:alt"   content="${escapedImageAlt}" />
  <meta property="og:locale"      content="en_ZA" />
  ${videoUrl ? `<meta property="og:video" content="${escapeHtml(videoUrl)}" />
  <meta property="og:video:type"  content="video/mp4" />` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="${twitterCard}" />
  <meta name="twitter:site"        content="@thegruvs" />
  <meta name="twitter:title"       content="${escapedTitle}" />
  <meta name="twitter:description" content="${escapedDescription}" />
  <meta name="twitter:image"       content="${escapeHtml(image)}" />
  <meta name="twitter:image:alt"   content="${escapedImageAlt}" />
  ${videoUrl ? `<meta name="twitter:player" content="${escapeHtml(videoUrl)}" />
  <meta name="twitter:player:width" content="1280" />
  <meta name="twitter:player:height" content="720" />` : ''}

  <!-- WhatsApp / Telegram prefer og: tags — no extras needed -->

  ${jsonLd ? `<script type="application/ld+json">${jsonLdScript(jsonLd)}</script>` : ''}

  <!-- Redirect real users instantly -->
  <meta http-equiv="refresh" content="0; url=${escapeHtml(redirectUrl)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />

  <style>
    body { margin:0; background:#0d1112; color:#fff; font-family:sans-serif;
           display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { max-width:480px; text-align:center; padding:40px 24px; }
    .logo { font-size:28px; font-weight:900; color:#00f2ff; letter-spacing:2px; }
    p { color:rgba(255,255,255,0.6); margin:12px 0 24px; }
    a { display:inline-block; background:#00f2ff; color:#000; padding:12px 28px;
        border-radius:14px; font-weight:900; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">THE GRUVS</div>
    <p>${escapedDescription}</p>
    <a href="${escapeHtml(redirectUrl)}">Open in The Gruvs →</a>
  </div>
</body>
</html>`;
}

// JSON-LD is user content underneath (event titles, bios) — a raw
// `</script>` inside a string would close the tag early and let the rest be
// parsed as HTML. `<` is the only character that matters inside a JSON
// string for this purpose; escaping it as < is the standard safe form.
function jsonLdScript(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * events.price is TEXT holding either "FREE" or a JSON tier map like
 * {"general":"200","PreSales":"120"}. Interpolating it raw leaked
 * `🎟 {"general":"1500"}` into every share card. Mirrors the tier/min/"From"
 * logic of priceLabel() in src/constants/currencies.js — kept as a copy because
 * Deno can't import from the RN bundle. Currency is deliberately omitted: the
 * app resolves the symbol from the viewer's GPS, which a crawler doesn't have.
 */
function priceLabel(price: unknown): string {
  if (price == null || price === 0 || price === 'FREE') return '🆓 Free entry';

  let obj: unknown = price;
  if (typeof price === 'string') {
    const t = price.trim();
    if (t[0] === '{' || t[0] === '[') {
      try { obj = JSON.parse(t); } catch { return `🎟 ${t}`; }
    } else {
      const n = Number(t);
      if (Number.isFinite(n)) return n === 0 ? '🆓 Free entry' : `🎟 ${n}`;
      return `🎟 ${t}`;
    }
  }
  if (typeof price === 'number') return price === 0 ? '🆓 Free entry' : `🎟 ${price}`;

  if (obj && typeof obj === 'object') {
    const nums = Object.values(obj as Record<string, unknown>)
      .map(v => Number(String(v).replace(/[^0-9.]/g, '')))
      .filter(n => Number.isFinite(n) && n > 0);
    if (nums.length === 0) return '🆓 Free entry';
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return min === max ? `🎟 ${min}` : `🎟 From ${min}`;
  }
  return '🆓 Free entry';
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function handleEvent(id: string): Promise<OGProps & { redirect: string }> {
  const { data: event } = await supabase
    .from('events')
    .select('id, title, description, venue_name, city, cover_url, cover_image, event_date, event_time, category, price, capacity, going, vibe_count')
    .eq('id', id)
    .eq('is_published', true)   // never leak drafts/unpublished in share previews
    .is('deleted_at', null)     // service_role bypasses RLS, so filter explicitly
    .single();

  if (!event) {
    return {
      title: `Event on ${APP_NAME}`,
      description: 'Discover events near you on The Gruvs.',
      image: DEFAULT_OG_IMAGE,
      url: `${APP_URL}/share/event/${id}`,
      redirect: `${APP_URL}`,
      type: 'article',
    };
  }

  const date = event.event_date
    ? new Date(`${event.event_date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
        + (event.event_time ? ` · ${event.event_time}` : '')
    : '';

  // The deal — free entry or the price, the thing people look for in a preview.
  const deal = priceLabel(event.price);

  const where = [event.venue_name, event.city].filter(Boolean).join(' · ');
  const vibes = event.vibe_count ? `🔥 ${event.vibe_count} vibing` : '';
  const soldOut = event.capacity > 0 && (event.going || 0) >= event.capacity;
  const parts = [date, where, deal, soldOut ? '🔴 Sold out' : vibes].filter(Boolean);

  // schema.org/Event — real rich-snippet eligibility (date/venue/price stars
  // in search results). startDate needs a real ISO datetime or Google drops
  // the whole block; skip it rather than guess when either piece is missing.
  const startDate = event.event_date
    ? `${event.event_date}T${event.event_time || '00:00:00'}`
    : null;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    ...(startDate ? { startDate } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: soldOut ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
    ...(event.venue_name || event.city ? {
      location: {
        '@type': 'Place',
        name: event.venue_name || event.city,
        address: event.city ? { '@type': 'PostalAddress', addressLocality: event.city } : undefined,
      },
    } : {}),
    image: [event.cover_url || event.cover_image || DEFAULT_OG_IMAGE],
    description: event.description || parts.join(' · ') || undefined,
    offers: {
      '@type': 'Offer',
      price: deal === '🆓 Free entry' ? '0' : undefined,
      availability: soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: `${APP_URL}/share/event/${id}`,
    },
  };

  return {
    title: event.title,
    description: parts.join(' · ') || 'An event on The Gruvs',
    image: event.cover_url || event.cover_image || DEFAULT_OG_IMAGE,
    imageAlt: event.title,
    url: `${APP_URL}/share/event/${id}`,
    redirect: `${APP_URL}/?event=${id}`,
    type: 'article',
    jsonLd,
  };
}

async function handleProfile(username: string): Promise<OGProps & { redirect: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    // service_role bypasses RLS, so filter explicitly (same reason as handleEvent).
    // Mirrors the live `profiles_hide_autohidden` policy as an anonymous viewer
    // sees it — COALESCE(is_auto_hidden,false) = false — plus soft-deleted
    // accounts, which must stop rendering the moment deletion is requested.
    // Note the crawler user-agent gate is NOT a control here: `curl -A
    // facebookexternalhit` reaches this path, so these filters are the control.
    .select('id, username, display_name, bio, avatar_url, followers_count, vibe_score, is_verified')
    .eq('username', username)
    .or('is_auto_hidden.is.null,is_auto_hidden.eq.false')
    .is('deleted_at', null)
    .single();

  if (!profile) {
    return {
      title: `@${username} on ${APP_NAME}`,
      description: 'Check out their profile on The Gruvs.',
      image: DEFAULT_OG_IMAGE,
      url: `${APP_URL}/share/profile/${encodeURIComponent(username)}`,
      redirect: `${APP_URL}`,
      type: 'profile',
    };
  }

  const displayName = profile.display_name || profile.username;
  const isRoyal = (profile.vibe_score || 0) >= 10000; // Royal tier threshold
  const badges = [
    isRoyal             ? '👑 Royal'    : '',
    profile.is_verified ? '✔ Verified' : '',
  ].filter(Boolean).join(' · ');
  const followers = profile.followers_count ? `${profile.followers_count} followers` : '';
  const vibes     = profile.vibe_score      ? `${profile.vibe_score} vibes`           : '';
  const stats     = [followers, vibes, badges].filter(Boolean).join(' · ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: displayName,
    alternateName: profile.username,
    image: profile.avatar_url || undefined,
    description: profile.bio || undefined,
    url: `${APP_URL}/share/profile/${encodeURIComponent(username)}`,
  };

  return {
    title: `${displayName} (@${profile.username})`,
    description: profile.bio ? `${profile.bio}${stats ? ' · ' + stats : ''}` : stats || 'A vibe on The Gruvs.',
    image: profile.avatar_url || DEFAULT_OG_IMAGE,
    imageWidth: 400,
    imageHeight: 400,
    imageAlt: `${displayName}'s profile picture`,
    url: `${APP_URL}/share/profile/${encodeURIComponent(username)}`,
    redirect: `${APP_URL}/?profile=${profile.id}`,
    type: 'profile',
    twitterCard: 'summary',
    jsonLd,
  };
}

async function handleReel(id: string): Promise<OGProps & { redirect: string }> {
  const { data: reel } = await supabase
    .from('reels')
    .select('id, caption, media_url, thumbnail_url, like_count, view_count, profiles(username, display_name)')
    .eq('id', id)
    .eq('is_deleted', false)    // don't leak deleted reels in share previews
    // Mirrors the live reels policies for an anonymous viewer: deleted_at IS NULL
    // (reels_select), COALESCE(visibility,'public') = 'public'
    // (reels_select_visibility) and COALESCE(auto_hidden,false) = false
    // (reels_hide_autohidden). Without the visibility filter a share card would
    // hand out a PRIVATE reel's media_url, which the client deliberately hides
    // (see reelsDataFlow.js). `is_deleted` is the flag the app actually writes;
    // `deleted_at` is checked too so either soft-delete convention is honoured.
    .is('deleted_at', null)
    .or('visibility.is.null,visibility.eq.public')
    .or('auto_hidden.is.null,auto_hidden.eq.false')
    .single();

  if (!reel) {
    return {
      title: `Reel on ${APP_NAME}`,
      description: 'Watch reels on The Gruvs.',
      image: DEFAULT_OG_IMAGE,
      url: `${APP_URL}/share/reel/${id}`,
      redirect: `${APP_URL}`,
      type: 'video.other',
    };
  }

  const creator     = (reel.profiles as any)?.display_name || (reel.profiles as any)?.username || 'A vibe creator';
  const views       = reel.view_count ? `${reel.view_count} views` : '';
  const likes       = reel.like_count ? `${reel.like_count} likes` : '';
  const description = [reel.caption, `by ${creator}`, views, likes].filter(Boolean).join(' · ');

  // VideoObject requires either uploadDate or duration for Google's rich
  // result eligibility — reels has no reliable created_at selected here, so
  // this stays best-effort: still valid schema without it, just fewer stars.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: reel.caption ? reel.caption.slice(0, 70) : `${creator}'s Reel`,
    description: description || undefined,
    thumbnailUrl: [reel.thumbnail_url || DEFAULT_OG_IMAGE],
    contentUrl: reel.media_url || undefined,
    interactionStatistic: reel.view_count ? {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/WatchAction',
      userInteractionCount: reel.view_count,
    } : undefined,
  };

  return {
    title: reel.caption ? reel.caption.slice(0, 70) : `${creator}'s Reel`,
    description,
    image: reel.thumbnail_url || DEFAULT_OG_IMAGE,
    url: `${APP_URL}/share/reel/${id}`,
    redirect: `${APP_URL}/?reel=${id}`,
    type: 'video.other',
    videoUrl: reel.media_url || undefined,
    twitterCard: reel.media_url ? 'player' : 'summary_large_image',
    jsonLd,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url  = new URL(req.url);
  // Path: /functions/v1/og-meta/event/<id>  etc.
  const parts = url.pathname.split('/').filter(Boolean);
  // Path shape varies by gateway: the Supabase edge runtime strips
  // '/functions/v1' and passes '/og-meta/<type>/<slug>'. Anchor on the
  // 'og-meta' segment so routing works in every environment.
  const anchor = parts.indexOf('og-meta');
  const base = anchor >= 0 ? anchor + 1 : (parts[0] === 'functions' ? 3 : 0);
  const type = parts[base];      // 'event' | 'profile' | 'reel'
  // Decode the slug: pathname keeps percent-encoding, so a username with a
  // space arrived as "The%20Gruvs" and never matched the stored "The Gruvs" —
  // every such profile's share preview silently fell back to the generic card.
  // try/catch because a malformed sequence must not 500 the whole route.
  const rawSlug = parts[base + 1];
  let slug = rawSlug;
  try { slug = rawSlug ? decodeURIComponent(rawSlug) : rawSlug; } catch { slug = rawSlug; }

  const ua = req.headers.get('user-agent') || '';

  // Non-crawlers: redirect immediately without hitting the DB
  if (!isCrawler(ua) && type && slug) {
    // Re-encode: `slug` is now decoded, so interpolating it raw would put a
    // literal space (or &, #, …) into the query string and break the link.
    const q = encodeURIComponent(slug);
    const redirectMap: Record<string, string> = {
      event:   `${APP_URL}/?event=${q}`,
      profile: `${APP_URL}/?profile=${q}`,
      reel:    `${APP_URL}/?reel=${q}`,
    };
    const dest = redirectMap[type] || APP_URL;
    return Response.redirect(dest, 302);
  }

  try {
    let og: (OGProps & { redirect: string }) | null = null;

    if (type === 'event'   && slug) og = await handleEvent(slug);
    if (type === 'profile' && slug) og = await handleProfile(slug);
    if (type === 'reel'    && slug) og = await handleReel(slug);

    if (!og) {
      // Root or unknown path — serve default OG and redirect to app
      og = {
        title: `${APP_NAME} — Discover Your Next Event`,
        description: 'Find the best local events — from music and nightlife to food and culture. Connect with vibers near you.',
        image: DEFAULT_OG_IMAGE,
        url: APP_URL,
        redirect: APP_URL,
        type: 'website',
      };
    }

    const { redirect, ...ogProps } = og;
    const html = buildHtml(ogProps, redirect);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Cache for 5 minutes on CDN, 1 minute for crawlers to pick up live changes
        'Cache-Control': 'public, s-maxage=300, max-age=60',
        'X-Robots-Tag': 'index, follow',
      },
    });
  } catch (err) {
    console.error('og-meta error:', err);
    return Response.redirect(APP_URL, 302);
  }
});
