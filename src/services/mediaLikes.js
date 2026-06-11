/**
 * mediaLikes — persistent likes for individual media items (event photos,
 * profile gallery items), keyed by the media URL. Backed by the media_likes
 * table (patch 20 in schema_part_4.sql). Degrades silently if un-migrated:
 * toggles report failure and the UI rolls back rather than lying.
 */
import { supabase } from './supabase';

/** Like state for a set of URLs → { [url]: { count, mine } } */
export async function getMediaLikes(urls, userId = null) {
  const clean = (urls || []).filter(Boolean);
  if (!clean.length) return {};
  try {
    const { data, error } = await supabase
      .from('media_likes')
      .select('media_url, user_id')
      .in('media_url', clean);
    if (error) throw error;
    const out = {};
    for (const u of clean) out[u] = { count: 0, mine: false };
    for (const row of data || []) {
      const s = out[row.media_url] || (out[row.media_url] = { count: 0, mine: false });
      s.count += 1;
      if (userId && row.user_id === userId) s.mine = true;
    }
    return out;
  } catch (e) {
    console.warn('[mediaLikes] getMediaLikes failed:', e.message);
    return {};
  }
}

/** Toggle my like on one URL. Returns true on success, false on failure. */
export async function toggleMediaLike(url, userId, { like, eventId = null } = {}) {
  if (!url || !userId) return false;
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

export default { getMediaLikes, toggleMediaLike };