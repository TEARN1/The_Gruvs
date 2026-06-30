/**
 * CheckinSync — offline resilience for Touch Down (#248). If a check-in can't
 * reach the server because the phone is offline, queue it locally and replay it
 * when connectivity returns. Wraps the tested checkinQueue util with AsyncStorage
 * + Supabase. So a dead zone never costs a verified-presence record.
 */
import { supabase } from './supabase';
import { enqueueCheckin, readCheckinQueue, removeCheckin, isOffline } from '../utils/checkinQueue';

let Storage = null;
try { Storage = require('@react-native-async-storage/async-storage').default; } catch { /* web/test fallback below */ }
if (!Storage && typeof window !== 'undefined' && window.localStorage) {
  Storage = { getItem: async (k) => window.localStorage.getItem(k), setItem: async (k, v) => window.localStorage.setItem(k, v) };
}

export const CheckinSync = {
  // Returns true if the check-in was queued for later (i.e. we're offline).
  async queueIfOffline(eventId, userId, coords) {
    if (!Storage || !isOffline()) return false;
    return enqueueCheckin(Storage, { eventId, userId, coords });
  },

  // Replay any queued check-ins. Safe to call on app start / when back online.
  async drain() {
    if (!Storage || isOffline()) return 0;
    const queue = await readCheckinQueue(Storage);
    let synced = 0;
    for (const c of queue) {
      try {
        const { error } = await supabase.from('live_checkins').insert({
          user_id: c.userId, event_id: c.eventId,
          lat: c.coords?.lat ?? null, lon: c.coords?.lon ?? null,
          checked_in_at: new Date().toISOString(),
        });
        if (!error || /duplicate|unique|conflict/i.test(error.message || '')) {
          await removeCheckin(Storage, c.eventId, c.userId);
          synced++;
        }
      } catch { /* leave it queued for the next drain */ }
    }
    return synced;
  },
};
