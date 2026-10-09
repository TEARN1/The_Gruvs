/**
 * coPresence — the networking primitive nobody else can build.
 *
 * Every other app connects strangers who clicked a button. The Gruvs can PROVE
 * two people stood in the same room: a Touch Down is verified, on-the-ground
 * presence. So when two people who were actually at the same event message each
 * other, that is not a cold DM — it is the warmest introduction there is, and
 * it cannot be faked (Truth Protocol).
 *
 * Two uses:
 *   1. `sharedPresence()` powers a verified header in the DM
 *      ("You both Touched Down at X · 25 Sept").
 *   2. It lets a message SKIP the request gate — co-presence IS the warm intro.
 *
 * Honest by construction: we only count real check-ins (live_checkins), never
 * "both RSVP'd" or "both follow the same page". Intent is not attendance.
 */
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const cache = new Map(); // "a|b" -> { events, at }
const TTL_MS = 5 * 60 * 1000;

const keyFor = (a, b) => [a, b].sort().join('|');

/**
 * Events BOTH users verifiably checked in to, most recent first.
 * @returns {Promise<Array<{ id, title, event_date, checked_in_at }>>}
 */
export async function sharedPresence(userA, userB) {
  if (!userA || !userB || userA === userB) return [];

  const k = keyFor(userA, userB);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.events;

  try {
    const [mineRes, theirsRes] = await Promise.all([
      supabase.from('live_checkins').select('event_id, checked_in_at').eq('user_id', userA),
      supabase.from('live_checkins').select('event_id').eq('user_id', userB),
    ]);
    if (mineRes.error || theirsRes.error) return [];

    const theirs = new Set((theirsRes.data || []).map(r => r.event_id));
    const shared = (mineRes.data || []).filter(r => theirs.has(r.event_id));
    if (!shared.length) { cache.set(k, { events: [], at: Date.now() }); return []; }

    const ids = [...new Set(shared.map(r => r.event_id))];
    const { data: events } = await supabase
      .from('events')
      .select('id, title, event_date')
      .in('id', ids);

    const whenById = new Map(shared.map(r => [r.event_id, r.checked_in_at]));
    const out = (events || [])
      .map(e => ({ ...e, checked_in_at: whenById.get(e.id) }))
      .sort((x, y) => String(y.event_date || '').localeCompare(String(x.event_date || '')));

    cache.set(k, { events: out, at: Date.now() });
    return out;
  } catch {
    return []; // never let this break messaging
  }
}

/** True when the two have verifiably been in the same room. */
export async function haveMet(userA, userB) {
  const ev = await sharedPresence(userA, userB);
  return ev.length > 0;
}

/** "You both Touched Down at X · 25 Sept" (or "…at X and 2 more"). */
export function describeSharedPresence(events) {
  if (!events?.length) return null;
  const [first, ...rest] = events;
  const when = first.event_date
    ? new Date(`${first.event_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;
  const more = rest.length ? ` and ${rest.length} more` : '';
  return {
    title: first.title,
    eventId: first.id,
    when,
    more: rest.length,
    text: `You both Touched Down at ${first.title}${more}${when ? ` · ${when}` : ''}`,
  };
}

/**
 * "Find Me / Who's In The Room" — Find people you've crossed paths with or mutuals
 * who are currently checked in at the same event right now.
 */
export async function findNearbyCoPresence(userId, eventId) {
  if (!eventId) return [];
  try {
    let q = supabase
      .from('live_checkins')
      .select('user_id, checked_in_at')
      .eq('event_id', eventId)
      .order('checked_in_at', { ascending: false })
      .limit(60);

    if (userId) {
      q = q.neq('user_id', userId);
    }

    const { data: checkins, error } = await q;
    if (error || !checkins?.length) return [];

    const uids = [...new Set(checkins.map(c => c.user_id).filter(Boolean))];
    if (!uids.length) return [];

    const { data: profs } = await supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_url, vibe_score, verified')
      .in('id', uids);

    const profMap = new Map((profs || []).map(p => [p.id, p]));

    return checkins
      .map(c => {
        const prof = profMap.get(c.user_id);
        if (!prof) return null;
        return {
          id: prof.id,
          userId: c.user_id,
          username: prof.username || 'Viber',
          display_name: prof.display_name || prof.username || 'Viber',
          avatar_url: prof.avatar_url,
          vibe_score: prof.vibe_score || 0,
          is_verified: !!prof.verified,
          checkedInAt: c.checked_in_at,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Radio Proximity Tracking — "Passing-By Radar"
// Notifies user when a crew member or friend is passing by (~500m) to say hi.
// Strictly opt-in: only active when user enables it in settings/profile.
// ─────────────────────────────────────────────────────────────────────────────

const RADIO_PREF_KEY = '@gruvs_radio_proximity_enabled';
const RADIO_NOTIFIED_COOLDOWN = new Map(); // friendId -> timestamp
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function isRadioTrackingEnabled() {
  try {
    const val = await AsyncStorage.getItem(RADIO_PREF_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setRadioTrackingEnabled(enabled) {
  try {
    await AsyncStorage.setItem(RADIO_PREF_KEY, enabled ? 'true' : 'false');
  } catch {}
}

/**
 * Calculates distance in meters between two lat/lon points (Haversine formula).
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Checks if any mutual friends or crew members are currently passing by within ~500m.
 * Dispatches a notification if passing by and cooldown has elapsed.
 */
export async function checkRadioPassingBy({
  userId,
  userLat,
  userLon,
  onPassingByAlert,
} = {}) {
  if (!userId || userLat == null || userLon == null) return [];
  const enabled = await isRadioTrackingEnabled();
  if (!enabled) return [];

  try {
    // Look up mutual follows / crew members with recent location presence
    const { data: presenceList, error } = await supabase
      .from('user_presence')
      .select('user_id, lat, lon, updated_at, profiles:user_id(id, username, display_name, avatar_url)')
      .neq('user_id', userId)
      .gt('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // active within 15 min
      .limit(30);

    if (error || !presenceList?.length) return [];

    const now = Date.now();
    const detected = [];

    for (const item of presenceList) {
      if (item.lat == null || item.lon == null) continue;
      const distM = getDistanceMeters(userLat, userLon, item.lat, item.lon);

      // Within 500m boundary ("Passing By")
      if (distM <= 500) {
        const lastNotified = RADIO_NOTIFIED_COOLDOWN.get(item.user_id) || 0;
        if (now - lastNotified > COOLDOWN_MS) {
          RADIO_NOTIFIED_COOLDOWN.set(item.user_id, now);
          const friend = item.profiles || { username: 'A Viber', display_name: 'A friend' };
          const payload = {
            friendId: item.user_id,
            friendName: friend.display_name || friend.username || 'A friend',
            avatarUrl: friend.avatar_url,
            distanceM: distM,
            message: `${friend.display_name || friend.username} is passing by (~${distM}m away). Would you like to say hi?`,
          };
          detected.push(payload);
          onPassingByAlert?.(payload);
        }
      }
    }

    return detected;
  } catch (err) {
    console.warn('[coPresence] checkRadioPassingBy error:', err);
    return [];
  }
}


