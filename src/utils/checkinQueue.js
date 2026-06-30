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
    cur.push({ eventId: item.eventId, userId: item.userId, coords: item.coords || null, queuedAt: Date.now() });
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

// Offline only when we can positively tell (browser/RN NetInfo set navigator.onLine).
// Unknown (undefined) = assume online, so we never wrongly swallow a real server error.
export function isOffline() {
  try { return typeof navigator !== 'undefined' && navigator.onLine === false; } catch { return false; }
}
