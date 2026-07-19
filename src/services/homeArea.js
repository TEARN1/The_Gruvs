/**
 * homeArea — "what's on near where I LIVE", not where I'm standing right now.
 *
 * The home area is ALWAYS user-set. We never derive it from late-hour GPS:
 * that is ambient tracking (the thing Crossed Paths was deliberately designed
 * to avoid), a POPIA problem, and wrong constantly in practice — night shifts,
 * travel, staying over at someone's place.
 *
 * Coordinates are handled entirely server-side. The client can set a home area
 * and ask for events near it, but can never read the stored point back at full
 * precision — set_home_area() rounds to ~1.1km before storing, and the raw
 * columns aren't readable by clients at all (lock_profile_coordinates.sql).
 */
import { supabase } from './supabase';

/**
 * Save the user's home area. Coordinates are optional — a label alone is still
 * useful for city-level matching. Rounding is done by the RPC, never here: a
 * client-side round is one devtools call away from being skipped.
 */
export async function setHomeArea(label, coords = null) {
  const { error } = await supabase.rpc('set_home_area', {
    p_label: label || null,
    p_lat: coords?.lat ?? null,
    p_lon: coords?.lon ?? null,
  });
  if (error) throw error;
  return true;
}

/** The caller's own home area. Returns null when they haven't set one. */
export async function getMyHomeArea() {
  const { data, error } = await supabase.rpc('my_home_area');
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.home_area && row?.lat == null) return null;
  return { label: row.home_area || null, lat: row.lat ?? null, lon: row.lon ?? null };
}

/** True once there's enough to run a "near home" query. */
export async function hasHomeArea() {
  const home = await getMyHomeArea();
  return !!(home && home.lat != null && home.lon != null);
}

/**
 * Upcoming events near the user's home area, nearest first.
 * Returns [{ id, distance_km }] — hydrate the full rows from your existing
 * event fetch rather than duplicating the select here.
 *
 * Empty array when no home area is set: callers should fall back to their
 * normal feed, never to a silent GPS lookup.
 */
export async function eventsNearHome({ radiusKm = 25, limit = 50 } = {}) {
  const { data, error } = await supabase.rpc('events_near_home', {
    p_radius_km: radiusKm,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];
  return data;
}
