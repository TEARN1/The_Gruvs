/**
 * geocoding.js — the one place addresses ↔ coordinates are resolved.
 *
 * Why this exists: geocoding was scattered (PostEventModal did its own, region.js
 * did reverse for country, locationService used Expo Location which DOESN'T exist
 * on web — so web address lookups silently failed). This centralises it so every
 * surface — event posting, the map search, and any future ride/pickup flow —
 * resolves places the same, correct, keyless way.
 *
 * Provider: OpenStreetMap Nominatim (free, keyless). Its usage policy caps us at
 * ~1 request/second and forbids heavy bulk use, so we THROTTLE (a serial queue,
 * ≥1.1s apart) and CACHE aggressively. On native we prefer the on-device
 * geocoder first (instant, no rate limit) and fall back to Nominatim.
 *
 * ⚠️ SCALING NOTE for a ride-hailing product: Nominatim is fine for posting
 * events and occasional lookups, but a live pickup/dropoff app needs a paid,
 * high-QPS geocoder (Mapbox/Google/HERE) or a self-hosted Nominatim. This module
 * is the seam to swap the provider in ONE place when that day comes.
 */
import { Platform } from 'react-native';

let ExpoLocation = null; // native on-device geocoder (lazy; absent on web)
try { ExpoLocation = require('expo-location'); } catch { ExpoLocation = null; }

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const MIN_GAP_MS = 1100;          // Nominatim: max ~1 req/s
const CACHE_MAX = 500;

const fwdCache = new Map();       // query(lower) -> result | null
const revCache = new Map();       // "lat,lon"(rounded) -> result | null

// ── Serial, rate-limited queue so we never exceed Nominatim's policy ────────
let lastCall = 0;
let chain = Promise.resolve();
function throttled(task) {
  chain = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try { return await task(); } finally { lastCall = Date.now(); }
  });
  return chain;
}

const cachePut = (map, key, val) => {
  if (map.size >= CACHE_MAX) map.delete(map.keys().next().value); // drop oldest
  map.set(key, val);
};

// Normalise a Nominatim record to our stable shape.
function shape(rec) {
  if (!rec) return null;
  const lat = parseFloat(rec.lat), lon = parseFloat(rec.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const a = rec.address || {};
  return {
    lat, lon,
    displayName: rec.display_name || null,
    road: a.road || a.pedestrian || a.footway || null,
    suburb: a.suburb || a.neighbourhood || a.city_district || null,
    city: a.city || a.town || a.village || a.municipality || null,
    province: a.state || a.province || null,
    country: a.country || null,
    countryCode: (a.country_code || '').toUpperCase() || null,
    postcode: a.postcode || null,
    placeId: rec.place_id ? String(rec.place_id) : null,
    source: 'nominatim',
  };
}

/**
 * Address string → place. Native tries the on-device geocoder first.
 * @returns {Promise<null | {lat,lon,displayName,city,...}>}
 */
export async function forwardGeocode(query, { city } = {}) {
  const q = [query, city].filter((s) => s && String(s).trim()).join(', ').trim();
  if (!q || q.length < 4) return null;
  const key = q.toLowerCase();
  if (fwdCache.has(key)) return fwdCache.get(key);

  // Native on-device first — instant and unmetered.
  if (Platform.OS !== 'web' && ExpoLocation?.geocodeAsync) {
    try {
      const r = await ExpoLocation.geocodeAsync(q);
      if (r?.length) {
        const out = { lat: r[0].latitude, lon: r[0].longitude, displayName: q, city: city || null, source: 'device' };
        cachePut(fwdCache, key, out);
        return out;
      }
    } catch { /* fall through to Nominatim */ }
  }

  const out = await throttled(async () => {
    try {
      const res = await fetch(`${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=1`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return shape(json?.[0]);
    } catch { return null; }
  });
  cachePut(fwdCache, key, out);
  return out;
}

/**
 * Coordinates → address (pickup/dropoff labels, "where am I"). Native first.
 * @returns {Promise<null | {displayName, road, city, country, ...}>}
 */
export async function reverseGeocode(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (revCache.has(key)) return revCache.get(key);

  if (Platform.OS !== 'web' && ExpoLocation?.reverseGeocodeAsync) {
    try {
      const r = await ExpoLocation.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (r?.length) {
        const p = r[0];
        const out = {
          lat, lon,
          displayName: [p.name, p.street, p.city, p.region, p.country].filter(Boolean).join(', ') || null,
          road: p.street || null, suburb: p.district || null,
          city: p.city || p.subregion || null, province: p.region || null,
          country: p.country || null, countryCode: (p.isoCountryCode || '').toUpperCase() || null,
          postcode: p.postalCode || null, placeId: null, source: 'device',
        };
        cachePut(revCache, key, out);
        return out;
      }
    } catch { /* fall through */ }
  }

  const out = await throttled(async () => {
    try {
      const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      return shape(await res.json());
    } catch { return null; }
  });
  cachePut(revCache, key, out);
  return out;
}

/** Type-ahead suggestions for an address search box (returns up to `limit`). */
export async function searchPlaces(query, { limit = 5, near } = {}) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  const viewbox = near
    ? `&viewbox=${near.lon - 0.3},${near.lat - 0.3},${near.lon + 0.3},${near.lat + 0.3}&bounded=0`
    : '';
  return throttled(async () => {
    try {
      const res = await fetch(`${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=${limit}${viewbox}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json || []).map(shape).filter(Boolean);
    } catch { return []; }
  });
}

/** Two coordinates → straight-line distance in km (great-circle). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Sanity gate: are these plausible on-Earth coordinates (and not 0,0 null-island)? */
export function isValidCoord(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    && !(Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01);
}

export default { forwardGeocode, reverseGeocode, searchPlaces, distanceKm, isValidCoord };
