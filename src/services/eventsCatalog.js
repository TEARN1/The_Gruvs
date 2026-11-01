/**
 * eventsCatalog — the curated fallback events list, loaded on demand.
 *
 * It used to be a 1.9 MB JavaScript constant (src/constants/globalEventsCatalog.js)
 * imported by dataFlow, so every visitor downloaded and executed it before the
 * app could open — about a fifth of the whole web bundle — even though it is
 * only shown when the database returns fewer than 15 events. It now lives in
 * public/data/events-catalog.json (~56 KB gzipped) and is fetched the first
 * time it's needed, then kept in memory. Regenerate with scripts/generate_events.js.
 *
 * Failure is silent by design: no catalog just means no fallback events.
 */
import { Platform } from 'react-native';
import { APP_WEB_URL } from '../constants/appUrl';

const PATH = '/data/events-catalog.json';
let _catalog = null;   // array once loaded
let _pending = null;   // in-flight promise, shared by concurrent callers

const catalogUrl = () => (Platform.OS === 'web' ? PATH : `${APP_WEB_URL}${PATH}`);

export function loadEventsCatalog() {
  if (_catalog) return Promise.resolve(_catalog);
  if (_pending) return _pending;
  if (typeof fetch !== 'function') return Promise.resolve([]);
  _pending = fetch(catalogUrl())
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => { _catalog = Array.isArray(list) ? list : []; return _catalog; })
    .catch(() => [])
    .finally(() => { _pending = null; });
  return _pending;
}

/** Synchronous view of whatever has loaded so far (empty until the first fetch resolves). */
export const peekEventsCatalog = () => _catalog || [];

/** Test hook. */
export const __setEventsCatalogForTests = (list) => { _catalog = list; _pending = null; };
