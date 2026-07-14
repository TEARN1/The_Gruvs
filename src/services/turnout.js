/**
 * turnout — what will ACTUALLY be in the room.
 *
 * Pulls the RSVPs for an event plus each attendee's personal show-up history,
 * and turns them into the one number a host can plan against and an attendee can
 * trust. See utils/attendance for the maths (pure + tested).
 *
 * Fails soft: on any error it degrades to the plain RSVP count rather than
 * showing nothing — a slightly less honest number beats a blank card.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';
import { showUpRate, expectedTurnout, capacityState } from '../utils/attendance';

/**
 * @returns {Promise<{expected, going, maybe, confidence, capacity}>}
 */
export async function getTurnout(event) {
  const eventId = event?.id;
  const empty = { expected: 0, going: 0, maybe: 0, confidence: 'low', capacity: { state: 'open', pct: 0, label: '' } };
  if (!eventId) return empty;

  try {
    const { data: rsvps, error } = await supabase
      .from('event_rsvps')
      // never select `id` on event_rsvps — composite PK, there is no id column
      .select('user_id, status')
      .eq('event_id', eventId)
      .in('status', ['going', 'maybe']);
    if (error) throw error;
    if (!rsvps?.length) return empty;

    const userIds = [...new Set(rsvps.map((r) => r.user_id).filter(Boolean))];

    // Each attendee's history: how often did they say yes, and how often did they
    // actually walk in? Two counts, not per-user round-trips.
    const [{ data: theirRsvps }, { data: theirCheckins }] = await Promise.all([
      supabase.from('event_rsvps').select('user_id').in('user_id', userIds).eq('status', 'going').limit(5000),
      supabase.from('live_checkins').select('user_id').in('user_id', userIds).limit(5000),
    ]);

    const tally = (rows) => {
      const m = new Map();
      for (const r of rows || []) m.set(r.user_id, (m.get(r.user_id) || 0) + 1);
      return m;
    };
    const saidYes = tally(theirRsvps);
    const showedUp = tally(theirCheckins);

    const withRates = rsvps.map((r) => ({
      status: r.status,
      rate: showUpRate({
        rsvps: saidYes.get(r.user_id) || 0,
        touchdowns: showedUp.get(r.user_id) || 0,
      }).rate,
    }));

    const t = expectedTurnout(withRates);
    return { ...t, capacity: capacityState(event, t.expected) };
  } catch (e) {
    logError('Turnout.get', e, { eventId });
    // Degrade honestly rather than showing nothing.
    const going = Number(event?.going) || 0;
    return { ...empty, going, capacity: capacityState(event, going) };
  }
}

export default { getTurnout };
