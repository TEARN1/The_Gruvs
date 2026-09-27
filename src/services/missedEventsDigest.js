/**
 * Weekly "you missed out" digest.
 *
 * Once a week at most, on app open, look back at events that already happened
 * near the user that they never checked into, and drop a single in-app
 * notification ("You missed N gruvs near you last week"). No paid push infra —
 * it reuses NotificationService.send (which inserts a notifications row; the
 * existing push webhook delivers the device push if a token exists).
 *
 * Honest by design: only events with a real location are considered, only the
 * recent past (last 8 days), and anything the user attended/authored is excluded.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { NotificationService } from './notificationService';
import { LocationService } from './locationService';

const LAST_RUN_KEY = '@gruvs_missed_digest_v1';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 8;
const DEFAULT_RADIUS_KM = 25;
const MAX_LIST = 10;

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Run the digest if at least a week has passed. Safe to call on every app open.
 * @param {object} user           the authenticated user ({ id })
 * @param {number} [radiusKm]      how near counts as "near you"
 */
export async function maybeSendMissedDigest(user, radiusKm = DEFAULT_RADIUS_KM) {
  try {
    if (!user?.id) return;

    // ── Weekly throttle ───────────────────────────────────────────────────────
    const last = await AsyncStorage.getItem(LAST_RUN_KEY);
    if (last && Date.now() - Number(last) < WEEK_MS) return;

    // ── Need a location to know what's "near" ────────────────────────────────
    const coords = LocationService.getCached() || (await LocationService.requestAndGet());
    if (!coords?.lat || !coords?.lon) return;

    const today = new Date();
    const from = new Date(today.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const fromStr = ymd(from);
    const todayStr = ymd(today);

    // ── Recent past events with a real location ──────────────────────────────
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, venue_name, event_date, lat, lon, vibe_count, author_id')
      .gte('event_date', fromStr)
      .lt('event_date', todayStr)
      .is('deleted_at', null)
      .or('status.is.null,status.neq.cancelled')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .limit(400);
    if (error || !Array.isArray(events) || events.length === 0) {
      // Still stamp the run so we don't re-query every open for a week.
      await AsyncStorage.setItem(LAST_RUN_KEY, String(Date.now()));
      return;
    }

    // ── Events the user attended (don't tell them they "missed" these) ───────
    let attended = new Set();
    const [ciRes, stampRes] = await Promise.allSettled([
      supabase.from('event_checkins').select('event_id').eq('user_id', user.id),
      supabase.from('event_stamps').select('event_id').eq('user_id', user.id),
    ]);
    if (ciRes.status === 'fulfilled') (ciRes.value.data || []).forEach(r => attended.add(r.event_id));
    if (stampRes.status === 'fulfilled') (stampRes.value.data || []).forEach(r => attended.add(r.event_id));

    // ── Within radius, not attended, not their own ───────────────────────────
    const missed = events
      .filter(e => e.author_id !== user.id && !attended.has(e.id))
      .map(e => ({ ...e, _dist: haversine(coords.lat, coords.lon, Number(e.lat), Number(e.lon)) }))
      .filter(e => Number.isFinite(e._dist) && e._dist <= radiusKm)
      .sort((a, b) => (b.vibe_count || 0) - (a.vibe_count || 0))
      .slice(0, MAX_LIST);

    // Always stamp the run (even if nothing missed) so it's truly ≤ 1/week.
    await AsyncStorage.setItem(LAST_RUN_KEY, String(Date.now()));
    if (missed.length === 0) return;

    const top = missed[0];
    const n = missed.length;
    const title = n === 1
      ? 'You missed a gruv near you'
      : `You missed ${n} gruvs near you`;
    const body = n === 1
      ? `${top.title}${top.venue_name ? ` · ${top.venue_name}` : ''} happened nearby — catch the next one.`
      : `Including ${top.title}${top.venue_name ? ` · ${top.venue_name}` : ''}. Check Scout so you don't miss the next.`;

    await NotificationService.send(user.id, {
      type: 'missed_digest',
      title,
      body,
      eventId: top.id,
      data: { kind: 'missed_digest', count: n, eventIds: missed.map(e => e.id) },
    });
  } catch {
    // Best-effort — never block app start on a digest failure.
  }
}
