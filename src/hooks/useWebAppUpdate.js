import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * useWebAppUpdate — detects when a newer web build has been deployed so the app
 * can offer a one-tap refresh. This is the fix for "I deployed but users still
 * see the old version": browsers can hold a cached bundle, so we actively notice
 * a new one and prompt a reload.
 *
 * How: the currently-loaded JS is `AppEntry-<hash>.js` (Expo hashes the bundle
 * per build). We read that hash from the live <script> tag, then periodically
 * re-fetch index.html (cache-busted) and compare. A different hash = a new deploy.
 *
 * Web-only; a no-op on native (which updates via EAS / app stores).
 *
 * @returns {boolean} true once a newer build is available.
 */
export function useWebAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof fetch === 'undefined') return;

    const hashOf = (str) => (str && str.match(/AppEntry-([a-f0-9]+)\.js/)?.[1]) || null;

    // The bundle currently executing.
    const currentHash = Array.from(document.querySelectorAll('script[src]'))
      .map(s => hashOf(s.src))
      .find(Boolean);
    if (!currentHash) return; // dev server / unknown build — nothing to compare against

    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/', { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.text();
        const latest = hashOf(html);
        if (latest && latest !== currentHash) { setUpdateReady(true); stopped = true; }
      } catch { /* offline / transient — try again next tick */ }
    };

    const iv = setInterval(check, 90_000);        // poll every 90s
    const onFocus = () => check();                 // and whenever the tab regains focus
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const first = setTimeout(check, 8_000);        // first check shortly after load

    return () => {
      stopped = true;
      clearInterval(iv);
      clearTimeout(first);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return updateReady;
}

/** Force a hard reload to pick up the new bundle. */
export function reloadForUpdate() {
  if (typeof window !== 'undefined') {
    try { window.location.reload(); } catch { /* ignore */ }
  }
}

export default useWebAppUpdate;
