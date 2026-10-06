/**
 * inject-pwa.js — makes the exported web build installable as an app.
 *
 * Expo's `expo export` does NOT add a manifest link or Apple PWA meta tags to
 * the generated dist/index.html, so Chrome/Android never fire the install
 * prompt and iOS "Add to Home Screen" looks unbranded. This patches the built
 * HTML after export. Idempotent — safe to run on every build.
 *
 * The service worker (public/sw.js) and manifest (public/manifest.json) are
 * copied into dist/ automatically by Expo (public/ → dist root), so we only
 * need to reference them + register the SW here.
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(indexPath)) {
  console.warn('[inject-pwa] dist/index.html not found — skipping (run after expo export).');
  process.exit(0);
}

// ── Fail the build if the bundle has no Supabase URL ────────────────────────
// A build made without the env vars produces a bundle that throws
// "Invalid supabaseUrl" on boot — a WHITE SCREEN for every user. That exact
// thing shipped to production once (2026-07-12) and nobody noticed until the
// health check caught it. Never again: refuse to produce a deployable dist.
const jsDir = path.join(__dirname, '..', 'dist', '_expo', 'static', 'js', 'web');
if (fs.existsSync(jsDir)) {
  const entry = fs.readdirSync(jsDir).find(f => /^AppEntry-.*\.js$/.test(f));
  if (entry) {
    const bundle = fs.readFileSync(path.join(jsDir, entry), 'utf8');
    if (!/https:\/\/[a-z0-9]+\.supabase\.co/.test(bundle)) {
      console.error(
        '\n[inject-pwa] FATAL: the bundle contains no Supabase URL.\n' +
        '  This build was made without EXPO_PUBLIC_SUPABASE_URL / ANON_KEY.\n' +
        '  Deploying it would white-screen every user. Refusing to continue.\n' +
        '  Fix: ensure .env (local) or the repo secrets (CI) are set, then rebuild.\n'
      );
      process.exit(1);
    }
  }
}

let html = fs.readFileSync(indexPath, 'utf8');

if (html.includes('rel="manifest"')) {
  console.log('[inject-pwa] Already injected — nothing to do.');
  process.exit(0);
}

const SITE = 'https://thegruvs.com';
const TITLE = 'The Gruvs — Discover what’s on tonight';
const DESC = 'The Gruvs is South Africa’s realtime nightlife & events discovery app — find what’s on tonight, RSVP, Touch Down at the venue, and see who else is out. Real nights, verified.';
const OG_IMAGE = `${SITE}/icon-512.png`;

const head = `
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icon-512.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="The Gruvs" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="The Gruvs" />
    <meta name="google-site-verification" content="bPRhAOVtjTVgWbL5K-p0Y9L4qwQtw8Ja9y4enHRp_QA" />
    <link rel="canonical" href="${SITE}/" />

    <!-- Open Graph — the card shown when the link is shared on WhatsApp / IG / FB -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="The Gruvs" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESC}" />
    <meta property="og:url" content="${SITE}/" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:image:alt" content="The Gruvs" />
    <meta property="og:locale" content="en_ZA" />

    <!-- Twitter / X card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESC}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />

    <!--
      JSON-LD. Google reads this straight out of the raw HTML with no JS, so it
      is the one place we can state what this site IS to a crawler that never
      waits for the bundle. WebSite + SearchAction also makes us eligible for a
      sitelinks search box once the domain has any authority.
    -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "${SITE}/#org",
          "name": "The Gruvs",
          "url": "${SITE}/",
          "logo": "${OG_IMAGE}",
          "description": "${DESC}"
        },
        {
          "@type": "WebSite",
          "@id": "${SITE}/#site",
          "url": "${SITE}/",
          "name": "The Gruvs",
          "description": "${DESC}",
          "publisher": { "@id": "${SITE}/#org" },
          "inLanguage": "en-ZA"
        },
        {
          "@type": "MobileApplication",
          "name": "The Gruvs",
          "applicationCategory": "LifestyleApplication",
          "operatingSystem": "Web, Android, iOS",
          "url": "${SITE}/",
          "description": "${DESC}",
          "publisher": { "@id": "${SITE}/#org" }
        }
      ]
    }
    </script>

    <script>
      // Register the service worker as early as possible so the browser marks
      // the site installable. The in-app InstallAppBanner also registers it,
      // but doing it here covers the first paint before React mounts.
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
      }
    </script>
`;

// Upgrade the bare <title>/description that Expo emits to something search- and
// share-friendly (the SPA still overrides document.title per tab once booted).
html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
if (/<meta name="description"[^>]*>/.test(html)) {
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${DESC}" />`);
} else {
  html = html.replace('</head>', `    <meta name="description" content="${DESC}" />\n</head>`);
}

// Dark background from the very first paint. Without it the loading shell was
// a white page (its body text is white, so it was invisible) until the bundle
// ran: visitors saw what looked like a blank, broken site.
if (!html.includes('id="gruvs-boot-bg"')) {
  html = html.replace('</head>', '    <style id="gruvs-boot-bg">html,body{background:#0d1112;color:#fff}</style>\n</head>');
}
html = html.replace('</head>', head + '</head>');

// Preload the Feather icon font (96% of the app's icons) so it downloads in
// parallel with the JS bundle instead of after it. Path is content-hashed.
try {
  const fontRoot = path.join(__dirname, '..', 'dist', 'assets');
  const findFeather = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { const hit = findFeather(p); if (hit) return hit; }
      else if (/^Feather\.[0-9a-f]+\.ttf$/.test(e.name)) return p;
    }
    return null;
  };
  const feather = fs.existsSync(fontRoot) && findFeather(fontRoot);
  if (feather && !html.includes('rel="preload" href="/assets/')) {
    const href = '/' + path.relative(path.join(__dirname, '..', 'dist'), feather).split(path.sep).join('/');
    html = html.replace('</head>', `    <link rel="preload" href="${href}" as="font" type="font/ttf" crossorigin />\n</head>`);
  }
} catch { /* preload is an optimisation only */ }

// ── Crawlable first paint ───────────────────────────────────────────────────
// Expo ships `<div id="root"></div>` — literally zero text. Googlebot's first
// pass reads raw HTML; JS rendering is a deferred second pass that is slower
// and far less reliable, so a body with no words is the single biggest reason
// a working SPA fails to rank. React wipes this the moment it mounts, so it
// costs real users nothing — and while the 3.8MB bundle parses they now see a
// branded splash instead of a black screen.
// The spinner + "Opening The Gruvs" line tells people the app is on its way
// while the bundle downloads and runs (several seconds on a mid-range phone);
// without it the text page looked like the whole site. Pure CSS, no JS.
const SEO_BODY = `<div id="seo-shell" style="margin:auto;padding:40px 24px;max-width:640px;text-align:center;font-family:Inter,system-ui,sans-serif;color:#fff">
      <style>@keyframes gruvs-spin{to{transform:rotate(360deg)}}</style>
      <div role="status" aria-live="polite" style="display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 22px;color:#00f2ff;font-size:14px;font-weight:700">
        <span style="width:18px;height:18px;border:2.5px solid rgba(0,242,255,0.25);border-top-color:#00f2ff;border-radius:50%;display:inline-block;animation:gruvs-spin .8s linear infinite"></span>
        Opening The Gruvs…
      </div>
      <h1 style="font-size:28px;font-weight:900;color:#00f2ff;margin:0 0 14px">The Gruvs — discover what’s on tonight</h1>
      <p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.75);margin:0 0 18px">${DESC}</p>
      <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.55);margin:0 0 18px">Find parties, gigs, live music, sport and nightlife near you in Johannesburg, Cape Town, Durban, Pretoria and across South Africa. See which events are actually busy right now, RSVP with friends, and Touch Down when you arrive.</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.4);margin:0"><a href="/get.html" style="color:#00f2ff">Get the app</a> · <a href="/privacy.html" style="color:#00f2ff">Privacy</a> · <a href="/terms.html" style="color:#00f2ff">Terms</a></p>
    </div>`;

if (html.includes('<div id="root"></div>')) {
  html = html.replace('<div id="root"></div>', `<div id="root">${SEO_BODY}</div>`);
} else {
  console.warn('[inject-pwa] WARNING: `<div id="root"></div>` not found — SEO body NOT injected. The homepage will ship with no crawlable text.');
}

fs.writeFileSync(indexPath, html);
console.log('[inject-pwa] Injected manifest, Apple PWA meta, Open Graph + Twitter cards, canonical, SEO title/description, and SW registration into dist/index.html');
