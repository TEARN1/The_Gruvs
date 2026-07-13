/**
 * region — where the user actually is, and what that changes.
 *
 * The Gruvs is global. The same string means different things in different
 * countries, and getting it wrong silently corrupts an event:
 *
 *   "05/07/2026"  → 5 July in Johannesburg, London, Lagos
 *                 → 7 May   in New York
 *
 * A host in NYC whose poster says 05/07 and whose event lands on 5 July has had
 * their event destroyed by the autofill. So the parser must know the country.
 *
 * Resolution order (each is free + keyless — no paid geo API):
 *   1. GPS coords → country, via the same free Nominatim reverse geocode the
 *      app already uses for venues. Most accurate: where they REALLY are.
 *   2. Device locale region (Intl / navigator.language) — instant, no permission.
 *   3. ZA — the launch market, and the safest default (day-first is the world
 *      majority anyway; only the US is month-first).
 *
 * Cached, so we geocode once per install rather than per poster.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithTimeout } from './fetchWithTimeout';

const CACHE_KEY = 'gruvs_region_v1';
const TTL_MS = 30 * 24 * 3600 * 1000; // a month — people don't emigrate weekly

// Month-first is a US peculiarity. Nearly everywhere else is day-first, so the
// safe default for an unknown country is DMY.
const MDY_COUNTRIES = new Set(['US']);

let _region = null; // { country, dateOrder, source, ts }

const mk = (country, source) => ({
  country: String(country || 'ZA').toUpperCase(),
  dateOrder: MDY_COUNTRIES.has(String(country || '').toUpperCase()) ? 'MDY' : 'DMY',
  source,
  ts: Date.now(),
});

/** Country from the device's own locale — instant, needs no permission. */
export function countryFromLocale() {
  try {
    const loc =
      (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().locale) ||
      (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) ||
      '';
    // "en-ZA" → ZA ; "en-US" → US
    const m = String(loc).match(/[-_]([A-Za-z]{2})\b/);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

/** Best-known region right now, without waiting on the network. */
export function getRegion() {
  if (_region) return _region;
  const fromLocale = countryFromLocale();
  _region = mk(fromLocale || 'ZA', fromLocale ? 'locale' : 'default');
  return _region;
}

/** Load a previously resolved region off disk (call once at boot). */
export async function loadRegion() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.country && Date.now() - (cached.ts || 0) < TTL_MS) {
        _region = cached;
        return _region;
      }
    }
  } catch { /* ignore corrupt cache */ }
  return getRegion();
}

/**
 * Pin the region from real GPS coords — the most truthful signal. Free + keyless
 * (Nominatim), bounded by a timeout, and never throws: on any failure we simply
 * keep the locale-derived region.
 */
export async function resolveRegionFromCoords(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return getRegion();
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=3`,
      { headers: { Accept: 'application/json' } },
      8000
    );
    const json = await res.json();
    const cc = json?.address?.country_code;
    if (cc) {
      _region = mk(cc, 'gps');
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(_region)).catch(() => {});
    }
  } catch { /* keep whatever we had — a failed lookup must never break posting */ }
  return getRegion();
}

/** 'DMY' | 'MDY' — how to read an ambiguous "05/07/2026". */
export const getDateOrder = () => getRegion().dateOrder;

export default { getRegion, loadRegion, resolveRegionFromCoords, getDateOrder, countryFromLocale };
