// ── Offline check-in queue ────────────────────────────────────────────────────
// Never lose a Touch Down in a dead zone (#248). When a check-in can't reach the
// server because the phone is offline, persist it and replay when back online.
// Storage is injected (AsyncStorage in the app) so the logic is fully testable.
// Pure over an async key-value store.

const KEY = 'gruvs_pending_checkins_v1';
const CAP = 50;

export async function enqueueCheckin(store, item) {
  if (!store || !item || !item.eventId || !item.userId) return false;
  try {
    const cur = JSON.parse((await store.getItem(KEY)) || '[]');
    if (cur.some((c) => c.eventId === item.eventId && c.userId === item.userId)) return true; // dedupe
    // identityMode + expiresAt ride along: a ghost check-in that replays without
    // its identity mode would come back PUBLIC, silently outing someone who
    // chose to be invisible. expiresAt keeps the replayed footprint honest too.
    cur.push({
      eventId: item.eventId,
      userId: item.userId,
      coords: item.coords || null,
      identityMode: item.identityMode || null,
      expiresAt: item.expiresAt || null,
      queuedAt: Date.now(),
    });
    await store.setItem(KEY, JSON.stringify(cur.slice(-CAP)));
    return true;
  } catch { return false; }
}

export async function readCheckinQueue(store) {
  if (!store) return [];
  try { return JSON.parse((await store.getItem(KEY)) || '[]'); } catch { return []; }
}

export async function removeCheckin(store, eventId, userId) {
  if (!store) return [];
  try {
    const cur = JSON.parse((await store.getItem(KEY)) || '[]');
    const next = cur.filter((c) => !(c.eventId === eventId && c.userId === userId));
    await store.setItem(KEY, JSON.stringify(next));
    return next;
  } catch { return []; }
}

// A queued Touch Down is only worth replaying while it still describes a real
// night. Past this, the event is over and a retry that keeps failing (a rejected
// write, not a dead network) would otherwise sit in the queue forever.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isStale(item, now = Date.now()) {
  const at = Number(item?.queuedAt);
  if (!Number.isFinite(at)) return false; // unknown age — keep it, don't destroy data
  return now - at > MAX_AGE_MS;
}
