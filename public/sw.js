/* The Gruvs — service worker (enables PWA install + light offline shell).
 *
 * Deliberately conservative so it never serves a stale app or fights the
 * in-app auto-update banner:
 *   - Navigations / HTML: network-first (always fresh when online), fall back
 *     to the cached shell only when offline.
 *   - Hashed immutable assets (/_expo/static/...): cache-first (safe — the
 *     filename changes every build, so a new build = new URL).
 *   - Everything else (Supabase, weserv images, APIs, cross-origin): pass
 *     straight through, never cached.
 */
const VERSION = 'gruvs-v2';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(['/', '/index.html', '/manifest.json']).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin; let Supabase / images / APIs go to the network untouched.
  if (url.origin !== self.location.origin) return;

  // Immutable hashed static assets → cache-first.
  if (url.pathname.startsWith('/_expo/') || /\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => fetch(req))
    );
    return;
  }

  // Navigations / HTML → network-first, cached shell as offline fallback.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
  }
});
