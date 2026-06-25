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
}

function buildHtml(og: OGProps, redirectUrl: string): string {
  const {
    title, description, image, imageWidth = 1200, imageHeight = 630,
    imageAlt, url, type = 'website', videoUrl,
    siteName = APP_NAME, twitterCard = 'summary_large_image',
    themeColor = '#0d1112',
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function handleEvent(id: string): Promise<OGProps & { redirect: string }> {
  const { data: event } = await supabase
    .from('events')
    .select('id, title, description, venue_name, city, cover_url, cover_image, event_date, event_time, category, price, capacity, going, vibe_count')
    .eq('id', id)
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
  const free = event.price == null || event.price === 0 || event.price === 'FREE';
  const deal = free ? '🆓 Free entry' : `🎟 ${event.price}`;

  const where = [event.venue_name, event.city].filter(Boolean).join(' · ');
  const vibes = event.vibe_count ? `🔥 ${event.vibe_count} vibing` : '';
  const soldOut = event.capacity > 0 && (event.going || 0) >= event.capacity;
  const parts = [date, where, deal, soldOut ? '🔴 Sold out' : vibes].filter(Boolean);

  return {
    title: event.title,
    description: parts.join(' · ') || 'An event on The Gruvs',
    image: event.cover_url || event.cover_image || DEFAULT_OG_IMAGE,
    imageAlt: event.title,
    url: `${APP_URL}/share/event/${id}`,
    redirect: `${APP_URL}/?event=${id}`,
    type: 'article',
  };
}

async function handleProfile(username: string): Promise<OGProps & { redirect: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, follower_count, vibe_count, is_verified, is_royal')
    .eq('username', username)
    .single();

  if (!profile) {
    return {
      title: `@${username} on ${APP_NAME}`,
      description: 'Check out their profile on The Gruvs.',
      image: DEFAULT_OG_IMAGE,
      url: `${APP_URL}/share/profile/${username}`,
      redirect: `${APP_URL}`,
      type: 'profile',
    };
  }

  const displayName = profile.display_name || profile.username;
  const badges = [
    profile.is_royal    ? '👑 Royal'    : '',
    profile.is_verified ? '✔ Verified' : '',
  ].filter(Boolean).join(' · ');
  const followers = profile.follower_count ? `${profile.follower_count} followers` : '';
  const vibes     = profile.vibe_count     ? `${profile.vibe_count} vibes`          : '';
  const stats     = [followers, vibes, badges].filter(Boolean).join(' · ');

  return {
    title: `${displayName} (@${profile.username})`,
    description: profile.bio ? `${profile.bio}${stats ? ' · ' + stats : ''}` : stats || 'A vibe on The Gruvs.',
    image: profile.avatar_url || DEFAULT_OG_IMAGE,
    imageWidth: 400,
    imageHeight: 400,
    imageAlt: `${displayName}'s profile picture`,
    url: `${APP_URL}/share/profile/${username}`,
    redirect: `${APP_URL}/?profile=${profile.id}`,
    type: 'profile',
    twitterCard: 'summary',
  };
}

async function handleReel(id: string): Promise<OGProps & { redirect: string }> {
  const { data: reel } = await supabase
    .from('reels')
    .select('id, caption, video_url, thumbnail_url, like_count, view_count, profiles(username, display_name)')
    .eq('id', id)
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

  return {
    title: reel.caption ? reel.caption.slice(0, 70) : `${creator}'s Reel`,
    description,
    image: reel.thumbnail_url || DEFAULT_OG_IMAGE,
    url: `${APP_URL}/share/reel/${id}`,
    redirect: `${APP_URL}/?reel=${id}`,
    type: 'video.other',
    videoUrl: reel.video_url || undefined,
    twitterCard: reel.video_url ? 'player' : 'summary_large_image',
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url  = new URL(req.url);
  // Path: /functions/v1/og-meta/event/<id>  etc.
  const parts = url.pathname.split('/').filter(Boolean);
  // parts: ['functions', 'v1', 'og-meta', '<type>', '<slug>']
  const type = parts[3];  // 'event' | 'profile' | 'reel'
  const slug = parts[4];  // id or username

  const ua = req.headers.get('user-agent') || '';

  // Non-crawlers: redirect immediately without hitting the DB
  if (!isCrawler(ua) && type && slug) {
    const redirectMap: Record<string, string> = {
      event:   `${APP_URL}/?event=${slug}`,
      profile: `${APP_URL}/?profile=${slug}`,
      reel:    `${APP_URL}/?reel=${slug}`,
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
