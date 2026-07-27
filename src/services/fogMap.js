/**
 * fogMap.js — "Fog of the City": your personal map, lit only by where you've
 * actually been.
 *
 * Every Touch Down permanently lights a place on YOUR map. Un-grindable from the
 * couch (presence-only), so the whole territory is unfakeable proof you live the
 * life — the leveling philosophy, spatialised. Reuses the same live_checkins
 * source and the existing buildVibePassport util the Vibe Card already uses.
 */
import { supabase } from './supabase';
import { buildVibePassport } from '../utils/vibePassport';

export async function getMyFog(userId) {
  if (!userId) return { points: [], passport: null };
  try {
    const { data } = await supabase
      .from('live_checkins')
      .select('lat, lon, checked_in_at, venue_name, events(title, city, category, latitude, longitude)')
      .eq('user_id', userId)
      .order('checked_in_at', { ascending: false })
      .limit(500);

    const rows = data || [];

    // Map points — prefer the check-in's own coords, fall back to the event's.
    const points = rows
      .map((r) => {
        const lat = r.lat ?? r.events?.latitude;
        const lng = r.lon ?? r.events?.longitude;
        if (lat == null || lng == null) return null;
        return {
          lat: Number(lat), lng: Number(lng),
          title: r.events?.title || r.venue_name || 'Touch Down',
          venue_name: r.venue_name || null,
          city: r.events?.city || null,
          category: r.events?.category || null,
          at: r.checked_in_at,
        };
      })
      .filter(Boolean);

    // Passport stats (venues / cities / scenes / regulars / badges) — reused util.
    const passport = buildVibePassport(rows.map((r) => ({
      venue_name: r.venue_name || null,
      city: r.events?.city || null,
      category: r.events?.category || null,
      checked_in_at: r.checked_in_at,
    })));

    return { points, passport };
  } catch {
    return { points: [], passport: null };
  }
}
