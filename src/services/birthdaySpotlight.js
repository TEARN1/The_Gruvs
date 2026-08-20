/**
 * birthdaySpotlight — make people feel celebrated on The Gruvs (zero cost, no
 * API, no AI). Three jobs:
 *
 *   1. peopleWithBirthdayToday(radiusKm)  — who near me has a birthday today, so
 *      the app can nudge friends/locals to wish them well.
 *   2. myBirthdayTwins()                  — people who SHARE your day ("you both
 *      turn up today"), a built-in reason to connect.
 *   3. myBirthdayLeadUp()                 — fires from 40 days out: tells you
 *      your day is coming and surfaces good places/events to plan around it.
 *
 * #1 and #2 read OTHER users' birthdays, so they go through the
 * birthdays_nearby() / birthday_twins() RPCs (birthday_privacy.sql) — these
 * return only a distance + a match, never another user's raw birth_date/year.
 * #3 reads only the caller's own row, where birth_date is fine to read directly.
 * Everything degrades gracefully (via isSchemaMiss) if the RPCs aren't migrated
 * yet, so this ships safely ahead of or behind the DB migration.
 */

import { supabase } from './supabase';
import { daysUntilBirthday } from '../utils/birthday';
import { isSchemaMiss } from '../utils/resilience';

export const BIRTHDAY_LEAD_DAYS = 40; // start the build-up this far ahead

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * peopleWithBirthdayToday — discoverable users whose birthday is today, within
 * radiusKm of the given centre (defaults to the caller's profile location).
 * Returns lightweight profile rows the UI can render as "wish them well" cards.
 * Server-side (birthdays_nearby RPC) — never fetches another user's raw
 * birth_date to the client.
 */
export async function peopleWithBirthdayToday({ centerLat, centerLon, radiusKm = 50, limit = 30 } = {}) {
  try {
    const { data, error } = await supabase.rpc('birthdays_nearby', {
      p_lat: centerLat ?? null,
      p_lon: centerLon ?? null,
      p_radius_km: radiusKm,
      p_limit: limit,
    });
    if (error) throw error;

    const rows = data || [];
    const inRange = (centerLat && centerLon)
      ? rows.filter((p) => p.distance_km == null || p.distance_km <= radiusKm)
      : rows;
    return inRange.map((p) => ({ ...p, _distanceKm: p.distance_km }));
  } catch (e) {
    if (isSchemaMiss(e)) {
      console.warn('[birthdaySpotlight] birthdays_nearby not migrated yet — degrading gracefully.');
    } else {
      console.warn('[birthdaySpotlight] peopleWithBirthdayToday failed:', e.message);
    }
    return [];
  }
}

/**
 * myBirthdayTwins — other people who share the caller's birthday (same month+day).
 * The "people you share the day with" feature. Server-side (birthday_twins RPC)
 * — never fetches another user's raw birth_date to the client.
 */
export async function myBirthdayTwins(userId, { limit = 20 } = {}) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase.rpc('birthday_twins', {
      p_user_id: userId,
      p_limit: limit,
    });
    if (error) throw error;
    return (data || []).map((p) => ({ ...p, _distanceKm: p.distance_km }));
  } catch (e) {
    if (isSchemaMiss(e)) {
      console.warn('[birthdaySpotlight] birthday_twins not migrated yet — degrading gracefully.');
    } else {
      console.warn('[birthdaySpotlight] myBirthdayTwins failed:', e.message);
    }
    return [];
  }
}

/**
 * myBirthdayLeadUp — the 40-days-out build-up. Returns null when the birthday is
 * further than BIRTHDAY_LEAD_DAYS away, otherwise a plan object:
 *   { daysUntil, isToday, suggestions: [events near the user, good for a celebration] }
 *
 * "Good places to go" = upcoming, nearby, celebration-friendly events the user
 * can plan around. We surface real events (no fabricated data); if none match we
 * still return the countdown so the UI can show the spotlight.
 */
export async function myBirthdayLeadUp(userId, { radiusKm = 60, limit = 12 } = {}) {
  if (!userId) return null;
  try {
    const { data: me } = await supabase
      .from('profiles').select('birth_date, city, lat, lon').eq('id', userId).single();
    if (!me?.birth_date) return null;

    const daysUntil = daysUntilBirthday(me.birth_date);
    if (daysUntil == null || daysUntil > BIRTHDAY_LEAD_DAYS) return null;

    const today = new Date();
    const horizon = new Date(today.getTime() + (daysUntil + 3) * 86400000); // up to a few days after
    const fromStr = today.toISOString().split('T')[0];
    const toStr = horizon.toISOString().split('T')[0];

    // Celebration-friendly categories make the best birthday outings.
    const PARTY_CATS = ['nightlife', 'music', 'food', 'dance', 'party', 'market', 'art'];

    const { data: events } = await supabase
      .from('events')
      .select('id, title, category, city, lat, lon, event_date, event_time, cover_url, price_min, going')
      .eq('status', 'published')
      .neq('status', 'cancelled')
      .gte('event_date', fromStr)
      .lte('event_date', toStr)
      .limit(200);

    let suggestions = (events || []).map((ev) => ({
      ...ev,
      _distanceKm: (me.lat && me.lon && ev.lat && ev.lon)
        ? haversineKm(me.lat, me.lon, ev.lat, ev.lon) : null,
    }));

    // Prefer nearby + celebration-friendly; keep within radius when we have geo.
    suggestions = suggestions
      .filter((ev) => ev._distanceKm == null || ev._distanceKm <= radiusKm)
      .sort((a, b) => {
        const aParty = PARTY_CATS.includes(a.category) ? 0 : 1;
        const bParty = PARTY_CATS.includes(b.category) ? 0 : 1;
        if (aParty !== bParty) return aParty - bParty;
        return (a._distanceKm ?? 1e9) - (b._distanceKm ?? 1e9);
      })
      .slice(0, limit);

    return {
      daysUntil,
      isToday: daysUntil === 0,
      birthDate: me.birth_date,
      suggestions,
    };
  } catch (e) {
    console.warn('[birthdaySpotlight] myBirthdayLeadUp failed:', e.message);
    return null;
  }
}

export default {
  BIRTHDAY_LEAD_DAYS,
  peopleWithBirthdayToday,
  myBirthdayTwins,
  myBirthdayLeadUp,
};
