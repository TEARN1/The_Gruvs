/**
 * birthdaySpotlight — make people feel celebrated on The Gruvs (zero cost, no
 * API, no AI). Three jobs, all driven by profiles.birth_date (month+day only,
 * year stays private — see src/utils/birthday.js):
 *
 *   1. peopleWithBirthdayToday()  — who near me has a birthday today, so the app
 *      can nudge friends/locals to wish them well.
 *   2. myBirthdayTwins()          — people who SHARE your day ("you both turn up
 *      today"), a built-in reason to connect.
 *   3. myBirthdayLeadUp()         — fires from 40 days out: tells you your day is
 *      coming and surfaces good places/events to plan around it.
 *
 * ── Why this is all RPC-based ────────────────────────────────────────────────
 * Proximity here is computed SERVER-SIDE and comes back as a coarse bucket
 * ('1-5 km'), never a number and never a coordinate pair. `profiles.lat/lon` are
 * not SELECT-able by `authenticated` — and because column grants are not
 * row-aware, that includes reading your OWN. An earlier version of this file
 * selected lat/lon in all three functions; every one threw `permission denied`,
 * the catch swallowed it, and The Drop's birthday rails rendered nothing for
 * weeks. Keep the geo in the database: see supabase/queries/birthday_spotlight.sql.
 */

import { supabase } from './supabase';
import { daysUntilBirthday } from '../utils/birthday';

export const BIRTHDAY_LEAD_DAYS = 40; // start the build-up this far ahead

// Celebration-friendly categories make the best birthday outings.
const PARTY_CATS = ['nightlife', 'music', 'food', 'dance', 'party', 'market', 'art'];

/**
 * peopleWithBirthdayToday — discoverable users whose birthday is today, near the
 * caller. The centre is the caller's own stored location, resolved inside the
 * RPC from auth.uid(); no location is passed in, so this cannot be used to probe
 * where someone lives by sweeping a centre point around.
 *
 * Rows carry `distance_bucket` ('under 1 km' … 'over 50 km', or null when either
 * side has no location). Someone without a stored location is still returned —
 * a missing pin must never make you invisible on your birthday.
 */
export async function peopleWithBirthdayToday({ radiusKm = 100, limit = 30 } = {}) {
  try {
    const { data, error } = await supabase.rpc('birthdays_near_me', {
      p_radius_km: radiusKm,
      p_limit: limit,
    });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[birthdaySpotlight] peopleWithBirthdayToday failed:', e.message);
    return [];
  }
}

/**
 * myBirthdayTwins — other people who share the caller's exact day (month + day).
 * Same privacy shape as above: coarse bucket, no coordinates.
 */
export async function myBirthdayTwins({ limit = 20 } = {}) {
  try {
    const { data, error } = await supabase.rpc('my_birthday_twins', { p_limit: limit });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[birthdaySpotlight] myBirthdayTwins failed:', e.message);
    return [];
  }
}

/**
 * myBirthdayLeadUp — the 40-days-out build-up. Returns null when the birthday is
 * further than BIRTHDAY_LEAD_DAYS away, otherwise:
 *   { daysUntil, isToday, birthDate, suggestions: [full event rows] }
 *
 * The ranking-by-distance happens in `birthday_event_suggestions` (the caller's
 * position never leaves the DB); the event rows themselves are then read
 * normally, because event coordinates are public — they are already on the map.
 * Real events only, no fabricated data: if nothing matches we still return the
 * countdown so the UI can show the spotlight.
 */
export async function myBirthdayLeadUp(userId, { radiusKm = 60, limit = 12 } = {}) {
  if (!userId) return null;
  try {
    // birth_date IS readable; lat/lon deliberately are not (see file header).
    const { data: me } = await supabase
      .from('profiles').select('birth_date').eq('id', userId).single();
    if (!me?.birth_date) return null;

    const daysUntil = daysUntilBirthday(me.birth_date);
    if (daysUntil == null || daysUntil > BIRTHDAY_LEAD_DAYS) return null;

    const today = new Date();
    const horizon = new Date(today.getTime() + (daysUntil + 3) * 86400000); // a few days after, too
    const fromStr = today.toISOString().split('T')[0];
    const toStr = horizon.toISOString().split('T')[0];

    let suggestions = [];
    const { data: ranked } = await supabase.rpc('birthday_event_suggestions', {
      p_from: fromStr,
      p_to: toStr,
      p_radius_km: radiusKm,
      p_limit: limit,
    });

    const ids = (ranked || []).map((r) => r.id);
    if (ids.length) {
      const distanceById = new Map((ranked || []).map((r) => [r.id, r.distance_km]));
      const { data: events } = await supabase
        .from('events')
        .select('id, title, category, city, event_date, event_time, cover_url, price_min, going')
        .in('id', ids);

      suggestions = (events || [])
        .map((ev) => ({ ...ev, _distanceKm: distanceById.get(ev.id) ?? null }))
        // Celebration-friendly first, then nearest — the RPC already ordered by
        // distance, so this only lifts the party categories above the rest.
        .sort((a, b) => {
          const aParty = PARTY_CATS.includes(a.category) ? 0 : 1;
          const bParty = PARTY_CATS.includes(b.category) ? 0 : 1;
          if (aParty !== bParty) return aParty - bParty;
          return (a._distanceKm ?? 1e9) - (b._distanceKm ?? 1e9);
        });
    }

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
