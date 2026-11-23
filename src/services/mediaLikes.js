/**
 * mediaLikes — persistent likes for individual media items (event photos,
 * profile gallery items), keyed by the media URL. Backed by the media_likes
 * table (patch 20 in schema_part_4.sql).
 *
 * Includes shared in-memory pub-sub sync so all MediaViewers across the app
 * (e.g. Hero banner and detail preview) immediately mirror heart states & count.
 */
import { supabase } from './supabase';

const mediaLikesCache = new Map(); // url -> { count, mine }
const likeListeners = new Set();
const downloadListeners = new Set();

export function subscribeMediaLike(callback) {
  likeListeners.add(callback);
  return () => likeListeners.delete(callback);
}

export function subscribeMediaDownload(callback) {
  downloadListeners.add(callback);
  return () => downloadListeners.delete(callback);
}

export function notifyMediaDownload(url) {
  for (const cb of downloadListeners) {
    try { cb(url); } catch {}
  }
}

export function broadcastMediaLike(url, state) {
  mediaLikesCache.set(url, state);
  for (const cb of likeListeners) {
    try { cb(url, state); } catch {}
  }
}

/** Like state for a set of URLs → { [url]: { count, mine } } */
export async function getMediaLikes(urls, userId = null) {
  const clean = (urls || []).filter(Boolean);
  if (!clean.length) return {};

  const out = {};
  for (const u of clean) {
    out[u] = mediaLikesCache.get(u) || { count: 0, mine: false };
  }

  try {
    const { data, error } = await supabase
      .from('media_likes')
      .select('media_url, user_id')
      .in('media_url', clean);
    if (error) throw error;

    for (const u of clean) {
      if (!mediaLikesCache.has(u)) out[u] = { count: 0, mine: false };
    }

    for (const row of data || []) {
      const s = out[row.media_url] || (out[row.media_url] = { count: 0, mine: false });
      s.count += 1;
      if (userId && row.user_id === userId) s.mine = true;
    }

    // Update in-memory cache
    for (const u of clean) {
      mediaLikesCache.set(u, out[u]);
    }
    return out;
  } catch (e) {
    return out;
  }
}

/** Toggle my like on one URL. Returns true on success, false on failure. */
export async function toggleMediaLike(url, userId, { like, eventId = null } = {}) {
  if (!url) return false;
  const current = mediaLikesCache.get(url) || { count: 0, mine: false };
  const next = {
    count: Math.max(0, current.count + (like ? 1 : -1)),
    mine: Boolean(like),
  };
  broadcastMediaLike(url, next);

  if (!userId) return true; // Guest likes stay alive in memory & session

  try {
    if (like) {
      const { error } = await supabase.from('media_likes').upsert(
        { media_url: url, user_id: userId, event_id: eventId },
        { onConflict: 'media_url,user_id', ignoreDuplicates: true },
      );
      if (error) throw error;
    } else {
      const { error } = await supabase.from('media_likes')
        .delete().eq('media_url', url).eq('user_id', userId);
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.warn('[mediaLikes] toggleMediaLike failed:', e.message);
    return false;
  }
}

export default {
  getMediaLikes,
  toggleMediaLike,
  subscribeMediaLike,
  subscribeMediaDownload,
  notifyMediaDownload,
  broadcastMediaLike,
};
