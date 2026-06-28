/**
 * birthdaySpotlight — make people feel celebrated on The Gruvs (zero cost, no
 * API, no AI). Three jobs, all driven by profiles.birth_date (month+day only,
 * year stays private — see src/utils/birthday.js):
 *
 *   1. peopleWithBirthdayToday(radiusKm)  — who near me has a birthday today, so
 *      the app can nudge friends/locals to wish them well.
 *   2. myBirthdayTwins()                  — people who SHARE your day ("you both
 *      turn up today"), a built-in reason to connect.
 *   3. myBirthdayLeadUp()                 — fires from 40 days out: tells you
 *      your day is coming and surfaces good places/events to plan around it.
 *
 * Distance uses the same lat/lon already on profiles. Everything degrades
 * gracefully if a column/table isn't migrated yet.
 */

import { supabase } from './supabase';
import { daysUntilBirthday, isBirthdayToday } from '../utils/birthday';

export const BIRTHDAY_LEAD_DAYS = 40; // start the build-up this far ahead

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// month/day of "today" (or an offset day), used to query the DB cheaply.
function monthDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * peopleWithBirthdayToday — discoverable users whose birthday is today, within
 * radiusKm of the given centre (defaults to the caller's profile location).
 * Returns lightweight profile rows the UI can render as "wish them well" cards.
 */
export async function peopleWithBirthdayToday({ centerLat, centerLon, radiusKm = 50, limit = 30 } = {}) {
  const { month, day } = monthDay(0);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, city, lat, lon, birth_date')
      .eq('is_discoverable', true)
      .not('birth_date', 'is', null)
      .limit(5000);
    if (error) throw error;

    const todays = (data || []).filter((p) => isBirthdayToday(p.birth_date));
    const withDist = todays.map((p) => {
      const dist = (centerLat && centerLon && p.lat && p.lon)
        ? haversineKm(centerLat, centerLon, p.lat, p.lon) : null;
      return { ...p, _distanceKm: dist };
    });
    // If we have a centre, keep only those inside the radius; else keep all.
    const inRange = (centerLat && centerLon)
      ? withDist.filter((p) => p._distanceKm == null || p._distanceKm <= radiusKm)
      : withDist;
    return inRange
      .sort((a, b) => (a._distanceKm ?? 1e9) - (b._distanceKm ?? 1e9))
      .slice(0, limit);
  } catch (e) {
    console.warn('[birthdaySpotlight] peopleWithBirthdayToday failed:', e.message);
    return [];
  }
}

/**
 * myBirthdayTwins — other people who share the caller's birthday (same month+day).
 * The "people you share the day with" feature.
 */
export async function myBirthdayTwins(userId, { limit = 20 } = {}) {
  if (!userId) return [];
  try {
    const { data: me } = await supabase
      .from('profiles').select('birth_date, lat, lon').eq('id', userId).single();
    if (!me?.birth_date) return [];

    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, city, lat, lon, birth_date')
      .eq('is_discoverable', true)
      .neq('id', userId)
      .not('birth_date', 'is', null);

    return (data || [])
      .filter((p) => sameDay(p.birth_date, me.birth_date))
      .map((p) => ({
        ...p,
        _distanceKm: (me.lat && me.lon && p.lat && p.lon)
          ? haversineKm(me.lat, me.lon, p.lat, p.lon) : null,
      }))
      .sort((a, b) => (a._distanceKm ?? 1e9) - (b._distanceKm ?? 1e9))
      .slice(0, limit);
  } catch (e) {
    console.warn('[birthdaySpotlight] myBirthdayTwins failed:', e.message);
    return [];
  }
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.slice(5, 10) === b.slice(5, 10); // compare MM-DD
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
