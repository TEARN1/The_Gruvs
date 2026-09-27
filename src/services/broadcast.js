/**
 * broadcast — the host needs to reach everyone who's coming. Right now.
 *
 * "Moved to Hall B." · "Doors pushed to 22:00." · "Cancelled — refunds at the door."
 *
 * Without this, a host with a last-minute change has no way to tell the people
 * who already committed, and those people arrive at a locked door. That single
 * experience destroys trust in the app far more than any missing feature.
 *
 * Rules:
 *  • ONLY the event's host may broadcast (checked here AND by RLS server-side).
 *  • Only to people who RSVP'd or Touched Down — never a general blast. This is
 *    a utility, not a marketing channel, and it must never become spam.
 *  • Rate-limited: a host cannot hammer their attendees.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';

const MAX_LEN = 280;
const MIN_GAP_MS = 5 * 60 * 1000;      // 5 minutes between broadcasts
const _lastSent = new Map();           // eventId -> ts

export const BROADCAST_KINDS = {
  update: { key: 'update', title: 'Update' },
  venue: { key: 'venue', title: 'Venue change' },
  time: { key: 'time', title: 'Time change' },
  cancel: { key: 'cancel', title: 'Cancelled' },
};

/**
 * @returns {Promise<{ok:boolean, sent:number, error?:string}>}
 */
export async function broadcastToAttendees(event, message, kind = 'update', hostId) {
  const eventId = event?.id;
  if (!eventId || !hostId) return { ok: false, sent: 0, error: 'Missing event or host.' };

  // Only the host. (RLS enforces this too — this is the fast, honest failure.)
  if (event.author_id !== hostId) {
    return { ok: false, sent: 0, error: 'Only the host can send an update.' };
  }

  const text = String(message || '').trim().slice(0, MAX_LEN);
  if (text.length < 3) return { ok: false, sent: 0, error: 'Write a short message first.' };

  const last = _lastSent.get(eventId) || 0;
  if (Date.now() - last < MIN_GAP_MS) {
    const wait = Math.ceil((MIN_GAP_MS - (Date.now() - last)) / 60000);
    return { ok: false, sent: 0, error: `Please wait ${wait} min before sending another update.` };
  }

  try {
    // Everyone who committed OR actually walked in. A walk-in never RSVP'd but
    // is standing in the room — they need to know the venue changed.
    const [{ data: rsvps }, { data: checkins }] = await Promise.all([
      supabase.from('event_rsvps').select('user_id').eq('event_id', eventId).in('status', ['going', 'maybe']),
      supabase.from('live_checkins').select('user_id').eq('event_id', eventId),
    ]);

    const recipients = [...new Set([
      ...(rsvps || []).map((r) => r.user_id),
      ...(checkins || []).map((c) => c.user_id),
    ].filter((id) => id && id !== hostId))];

    if (!recipients.length) return { ok: true, sent: 0 };

    const meta = BROADCAST_KINDS[kind] || BROADCAST_KINDS.update;
    const rows = recipients.map((uid) => ({
      recipient_id: uid,
      actor_id: hostId,
      event_id: eventId,
      type: 'event_update',
      title: `${meta.title}: ${event.title || 'your Gruv'}`,
      body: text,
      read: false,
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) throw error;

    _lastSent.set(eventId, Date.now());
    return { ok: true, sent: recipients.length };
  } catch (e) {
    logError('Broadcast.send', e, { eventId, kind });
    return { ok: false, sent: 0, error: "Couldn't send the update — please try again." };
  }
}

export default { broadcastToAttendees, BROADCAST_KINDS };
