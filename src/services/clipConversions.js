/**
 * clipConversions.js — did a clip send anyone to its event?
 *
 * Views were the only number a clip ever had (11, in total, so far), and none
 * of them said whether a single person went. This records the two steps that
 * matter:
 *   recordOpen  — a viewer tapped a clip's event (Reels → event page);
 *   recordRsvp  — that viewer then RSVP'd within a day.
 *
 * The device remembers which clip opened which event; the database re-checks
 * everything (the clip is tagged to that event, posted by someone else, and an
 * "rsvp" needs an earlier "event_open" plus a real RSVP — see
 * supabase/migrations/20261020000100_reels_guest_safety_clip_stats.sql), so a
 * client cannot inflate anyone's numbers. Best-effort: nothing here may block
 * or break an RSVP.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const KEY = (eventId) => `gruvs.clipOpen.${eventId}`;
const WINDOW_MS = 24 * 3600 * 1000;

const write = async (row) => {
  try {
    // Repeats are ignored by the (reel, viewer, kind) unique key.
    await supabase.from('reel_conversions').upsert(row, { onConflict: 'reel_id,viewer_id,kind', ignoreDuplicates: true });
  } catch { /* table not migrated yet, or offline — the RSVP itself already succeeded */ }
};

export const ClipConversions = {
  /** A viewer opened the event a clip is tagged to. */
  async recordOpen({ reelId, eventId, viewerId, authorId }) {
    if (!reelId || !eventId) return;
    try { await AsyncStorage.setItem(KEY(eventId), JSON.stringify({ reelId, at: Date.now() })); } catch { /* still try the row */ }
    // Guests can't be credited (no account), and creators don't credit themselves.
    if (!viewerId || viewerId === authorId) return;
    await write({ reel_id: reelId, event_id: eventId, viewer_id: viewerId, kind: 'event_open' });
  },

  /** The clip that opened this event in the last day, if any. */
  async openedFrom(eventId, now = Date.now()) {
    if (!eventId) return null;
    try {
      const saved = JSON.parse((await AsyncStorage.getItem(KEY(eventId))) || 'null');
      return saved?.reelId && now - Number(saved.at) < WINDOW_MS ? saved.reelId : null;
    } catch { return null; }
  },

  /** Call after an RSVP of "going" or "maybe" succeeds. */
  async recordRsvp({ eventId, viewerId }) {
    if (!eventId || !viewerId) return;
    const reelId = await ClipConversions.openedFrom(eventId);
    if (!reelId) return;
    await write({ reel_id: reelId, event_id: eventId, viewer_id: viewerId, kind: 'rsvp' });
  },
};

export default ClipConversions;
