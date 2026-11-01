/**
 * pendingIntent.js — remember what a signed-out person tapped, so signing in
 * finishes it instead of dropping them back where they were.
 *
 * Tapping RSVP as a guest opened the sign-in sheet, and once they were in,
 * nothing had happened: they had to find the button and tap it again. Now the
 * tap is parked here and the screen that owns it picks it up after sign-in.
 *
 * Ten minutes, then it's stale. Kept in memory, and in sessionStorage on web so
 * it survives the round trip of a Facebook sign-in redirect.
 */
const TTL_MS = 10 * 60 * 1000;
const KEY = 'gruvs.pendingIntent';

let pending = null;

const store = () => {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
};

const load = () => {
  if (pending) return pending;
  try { pending = JSON.parse(store()?.getItem(KEY) || 'null'); } catch { pending = null; }
  return pending;
};

export const PendingIntent = {
  /** Park an action, e.g. set('rsvp', { eventId, status }). Replaces any earlier one. */
  set(kind, payload) {
    pending = { kind, payload, at: Date.now() };
    try { store()?.setItem(KEY, JSON.stringify(pending)); } catch { /* memory copy still works */ }
  },

  /** Hand the parked action to whoever claims it (once), if it is still fresh and matches. */
  take(kind, matches = () => true, now = Date.now()) {
    const p = load();
    if (!p || p.kind !== kind) return null;
    if (now - Number(p.at) > TTL_MS) { PendingIntent.clear(); return null; }
    if (!matches(p.payload)) return null;
    PendingIntent.clear();
    return p.payload;
  },

  clear() {
    pending = null;
    try { store()?.removeItem(KEY); } catch { /* nothing to clear */ }
  },
};

export default PendingIntent;
