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
    ? new Date(`${first.event_date}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
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
