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

html = html.replace('</head>', head + '</head>');
fs.writeFileSync(indexPath, html);
console.log('[inject-pwa] Injected manifest, Apple PWA meta, Open Graph + Twitter cards, canonical, SEO title/description, and SW registration into dist/index.html');
