/**
 * accommodation.js — "Stays via Resident Crew".
 *
 * The Gruvs and The Resident (Resident Crew) share one Supabase project, so The
 * Gruvs can read the Resident's real accommodation listings (res_listings)
 * directly — no new backend. When you're heading to an event out of town, the
 * map can show verified places to stay nearby, straight from the Resident crew.
 *
 * Read-only + best-effort. res_listings is publicly readable (the Resident reads
 * it with the anon client too), and it carries no private PII — just the stay.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';

// A rough degrees-per-metre at mid latitudes — good enough for a map bounding box.
const M_PER_DEG_LAT = 111_320;

export const Accommodation = {
  /**
   * Active stays within ~radiusM of a point. Cheap bounding-box filter (no
   * PostGIS needed), then distance-sorted client-side.
   */
  async near(lat, lng, { radiusM = 15000, limit = 60 } = {}) {
    if (lat == null || lng == null || !supabase) return [];
    try {
      const dLat = radiusM / M_PER_DEG_LAT;
      const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180) || 1);
      const { data, error } = await supabase
        .from('res_listings')
        .select('id, title, price, currency, suburb, city, lat, lon, images, wifi, parking, bathroom, safety_rating, landlord_lives_here, approach_photo_url, status')
        .gte('lat', lat - dLat).lte('lat', lat + dLat)
        .gte('lon', lng - dLng).lte('lon', lng + dLng)
        .limit(200);
      if (error) throw error;

      return (data || [])
        .filter((r) => r.lat != null && r.lon != null && (r.status == null || r.status === 'active'))
        .map((r) => ({
          id: r.id,
          title: r.title || 'Room to rent',
          price: r.price,
          currency: r.currency || 'ZAR',
          suburb: r.suburb || null,
          city: r.city || null,
          lat: Number(r.lat),
          lng: Number(r.lon),
          image: r.approach_photo_url || (Array.isArray(r.images) ? r.images[0] : null) || null,
          wifi: !!r.wifi,
          parking: !!r.parking,
          bathroom: r.bathroom || null,
          safety: r.safety_rating || null,
          livesHere: !!r.landlord_lives_here,
          _d: haversine(lat, lng, Number(r.lat), Number(r.lon)),
        }))
        .filter((s) => s._d <= radiusM)
        .sort((a, b) => a._d - b._d)
        .slice(0, limit);
    } catch (e) { logError('Accommodation.near', e); return []; }
  },
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
