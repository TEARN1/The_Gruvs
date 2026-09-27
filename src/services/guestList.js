/**
 * guestList — the door list, and the truth about who actually came.
 *
 * Hosts ask for this before they ask for anything else: a list they can work the
 * door with. The Gruvs can do something a spreadsheet cannot — put RSVP next to
 * VERIFIED ATTENDANCE (Touch Down), so the host sees not just who said they'd
 * come, but who has ever actually turned up.
 *
 * Only the event's own host may pull it (RLS enforces this server-side too).
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';

/**
 * @returns {Promise<Array<{username, rsvp, touchedDown, touchedDownAt}>>}
 */
export async function getGuestList(eventId) {
  if (!eventId) return [];
  try {
    const [{ data: rsvps, error: rErr }, { data: checkins, error: cErr }] = await Promise.all([
      supabase
        .from('event_rsvps')
        // never select `id` on event_rsvps — composite PK, no id column
        .select('user_id, status, created_at, profiles:user_id(username, display_name)')
        .eq('event_id', eventId),
      supabase
        .from('live_checkins')
        .select('user_id, checked_in_at')
        .eq('event_id', eventId),
    ]);
    if (rErr) throw rErr;
    if (cErr) throw cErr;

    const arrived = new Map((checkins || []).map((c) => [c.user_id, c.checked_in_at]));

    const rows = (rsvps || []).map((r) => ({
      userId: r.user_id,
      username: r.profiles?.username || 'unknown',
      name: r.profiles?.display_name || '',
      rsvp: r.status || 'going',
      rsvpAt: r.created_at || null,
      touchedDown: arrived.has(r.user_id),
      touchedDownAt: arrived.get(r.user_id) || null,
    }));

    // Anyone who Touched Down WITHOUT an RSVP is still a real guest — they walked
    // in. Leaving them off the list would make the door count wrong.
    for (const [userId, at] of arrived) {
      if (!rows.some((r) => r.userId === userId)) {
        rows.push({ userId, username: 'walk-in', name: '', rsvp: 'walk-in', rsvpAt: null, touchedDown: true, touchedDownAt: at });
      }
    }

    // Arrived first (that's who the host is looking for at the door), then going.
    const rank = (r) => (r.touchedDown ? 0 : r.rsvp === 'going' ? 1 : r.rsvp === 'maybe' ? 2 : 3);
    return rows.sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username));
  } catch (e) {
    logError('GuestList.load', e, { eventId });
    return [];
  }
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  // Quote anything that could break a cell, and neutralise formula injection —
  // a username starting with "=" would otherwise execute in Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Guest list as CSV text. */
export function toCsv(rows) {
  const header = ['Username', 'Name', 'RSVP', 'Arrived', 'Arrived at'];
  const body = (rows || []).map((r) => [
    csvCell(r.username),
    csvCell(r.name),
    csvCell(r.rsvp),
    r.touchedDown ? 'YES' : 'no',
    csvCell(r.touchedDownAt ? new Date(r.touchedDownAt).toISOString() : ''),
  ].join(','));
  return [header.join(','), ...body].join('\n');
}

/** Trigger a download of the guest list (web). Returns false where unsupported. */
export function downloadCsv(rows, eventTitle = 'gruv') {
  try {
    if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(eventTitle).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-guestlist.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    logError('GuestList.download', e);
    return false;
  }
}

export default { getGuestList, toCsv, downloadCsv };
