/**
 * CheckinSync — offline resilience for Touch Down (#248). If a check-in can't
 * reach the server, queue it locally and replay it when connectivity returns.
 * Wraps the tested checkinQueue util with AsyncStorage + Supabase. So a dead
 * zone never costs a verified-presence record.
 *
 * The venue case this is really built for: a club basement where the phone is
 * "connected" to a wifi that goes nowhere. navigator.onLine says true, the write
 * times out. So we queue on FAILURE, not on a self-reported offline flag —
 * callers only reach queueFailed() after a send has already failed.
 */
import { supabase } from './supabase';
import { enqueueCheckin, readCheckinQueue, removeCheckin, isStale } from '../utils/checkinQueue';

let Storage = null;
try { Storage = require('@react-native-async-storage/async-storage').default; } catch { /* web/test fallback below */ }
if (!Storage && typeof window !== 'undefined' && window.localStorage) {
  Storage = { getItem: async (k) => window.localStorage.getItem(k), setItem: async (k, v) => window.localStorage.setItem(k, v) };
}

let draining = false;
let autoDrainBound = false;

export const CheckinSync = {
  /**
   * Queue a Touch Down whose send already failed. Returns true if it's safely
   * persisted for replay.
   * @param {object} [opts] {identityMode, expiresAt} — carried through the replay.
   */
  async queueFailed(eventId, userId, coords, opts = {}) {
    if (!Storage) return false;
    return enqueueCheckin(Storage, {
      eventId, userId, coords,
      identityMode: opts.identityMode || null,
      expiresAt: opts.expiresAt || null,
    });
  },

  // Replay queued check-ins. Safe to call on app start / when back online.
  async drain() {
    if (!Storage || draining) return 0;
    draining = true;
    try {
      const queue = await readCheckinQueue(Storage);
      let synced = 0;
      for (const c of queue) {
        if (isStale(c)) { await removeCheckin(Storage, c.eventId, c.userId); continue; }
        try {
          // Route through the real check-in path so a replayed Touch Down earns
          // the same vibe_score, equity and host notification as a live one —
          // the old raw insert here skipped all of it.
          const { CheckInManager } = require('./dataFlow');
          const ok = await CheckInManager.touchDown(c.eventId, c.userId, c.coords || {}, {
            replay: true,
            checkedInAt: Number.isFinite(Number(c.queuedAt)) ? new Date(Number(c.queuedAt)).toISOString() : undefined,
            identityMode: c.identityMode || undefined,
            expiresAt: c.expiresAt || undefined,
          });
          if (ok) { await removeCheckin(Storage, c.eventId, c.userId); synced++; }
        } catch { /* leave it queued for the next drain */ }
      }
      return synced;
    } finally {
      draining = false;
    }
  },

  /**
   * Replay the moment the network comes back, not just at next session start.
   * Without this a Touch Down queued at the door sits until the app restarts —
   * which, for someone who installed at that door, may be never.
   */
  startAutoDrain() {
    if (autoDrainBound || typeof window === 'undefined' || !window.addEventListener) return;
    autoDrainBound = true;
    window.addEventListener('online', () => { CheckinSync.drain().catch(() => {}); });
  },
};

export default CheckinSync;
