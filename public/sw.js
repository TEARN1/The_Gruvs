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
const VERSION = 'gruvs-v4';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const NAV_TIMEOUT_MS = 3000;

// Cache the app bundle (and preloaded fonts) during install, not on first use.
// Chrome builds the full V8 code cache for scripts a service worker caches at
// install time, so from the second visit the 4 MB bundle skips parsing and
// compiling, which is most of the startup cost on a mid-range phone.
function precacheBundle() {
  return fetch('/', { cache: 'no-cache' })
    .then((res) => res.text())
    .then((html) => {
      const urls = [...html.matchAll(/(?:src|href)="(\/(?:_expo|assets)\/[^"]+\.(?:js|ttf))"/g)].map((m) => m[1]);
      return caches.open(ASSETS).then((c) => c.addAll(urls));
    })
    .catch(() => {});
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    Promise.all([
      caches.open(SHELL).then((c) => c.addAll(['/', '/index.html', '/manifest.json']).catch(() => {})),
      precacheBundle(),
    ])
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

  // Navigations / HTML → network-first, cached shell as fallback when offline
  // OR when the network is slow. On mobile data the HTML request alone could
  // take many seconds, and with no timeout a returning visitor stared at a
  // blank tab the whole time even though the app was cached. After
  // NAV_TIMEOUT_MS we serve the cached shell (its hashed JS is cached too, so it
  // opens immediately); the network response still lands and refreshes the
  // cache for next time, and the in-app update banner picks up new builds.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    const network = fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put('/index.html', copy)).catch(() => {});
      }
      return res;
    });
    const cachedShell = () => caches.match('/index.html').then((r) => r || caches.match('/'));
    const slow = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS))
      .then(cachedShell)
      .then((r) => r || network);           // nothing cached yet: keep waiting
    event.respondWith(
      Promise.race([network, slow]).catch(() => cachedShell())
    );
    event.waitUntil(network.catch(() => {}));
  }
});

/* ── Web Push — closed-tab notifications ──────────────────────────────────────
 * Delivered by the push-notify edge function (Web Push protocol + VAPID).
 * This is what makes the website behave like the real app: a DM pops on the
 * phone even when no Gruvs tab is open. */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {
    try { payload = { body: event.data.text() }; } catch {}
  }
  const title = payload.title || 'The Gruvs';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: (payload.data && payload.data.type) || 'gruvs', // same-type collapses — no pile-up
      renotify: false,
      data: payload.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ('focus' in tab) return tab.focus(); // an open Gruvs tab → bring it forward
      }
      return self.clients.openWindow('/');      // none open → launch the app
    })
  );
});
