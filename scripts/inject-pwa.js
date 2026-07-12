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

const head = `
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/logo.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="The Gruvs" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="The Gruvs" />
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

html = html.replace('</head>', head + '</head>');
fs.writeFileSync(indexPath, html);
console.log('[inject-pwa] Injected manifest link, Apple PWA meta, and SW registration into dist/index.html');
