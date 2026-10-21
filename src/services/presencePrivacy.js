/**
 * presencePrivacy.js — the people you hide from.
 *
 * Someone on this list never sees you in "who's nearby" or on the map, and
 * never sees your RSVPs or check-ins. They are not told. The database enforces
 * it (presence_hidden_from + can_see_presence, see
 * supabase/migrations/20261021000100_find_me_privacy.sql); this only edits the
 * list. Until that migration is applied, every call reports `available: false`
 * and the screen says so instead of pretending.
 */
import { supabase } from './supabase';
import { escapeLike } from '../utils/handleGuard';

const missingTable = (error) => !!error && /presence_hidden_from|does not exist|schema cache/i.test(error.message || '');

export const PresencePrivacy = {
  /** { available, people: [{ id, username, avatar_url }] } */
  async listHidden(userId) {
    if (!userId) return { available: true, people: [] };
    const { data, error } = await supabase
      .from('presence_hidden_from')
      // two links to profiles (owner_id, hidden_id): name the one we mean
      .select('hidden_id, profiles:hidden_id(id, username, avatar_url)')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (missingTable(error)) return { available: false, people: [] };
    if (error) throw error;
    return { available: true, people: (data || []).map((r) => r.profiles || { id: r.hidden_id }) };
  },

  async hide(userId, hiddenId) {
    if (!userId || !hiddenId || userId === hiddenId) return false;
    const { error } = await supabase.from('presence_hidden_from')
      .upsert({ owner_id: userId, hidden_id: hiddenId }, { onConflict: 'owner_id,hidden_id', ignoreDuplicates: true });
    if (error) throw error;
    return true;
  },

  async unhide(userId, hiddenId) {
    const { error } = await supabase.from('presence_hidden_from').delete().eq('owner_id', userId).eq('hidden_id', hiddenId);
    if (error) throw error;
    return true;
  },

  /** People you might want to hide from: anyone you follow or who follows you, by @name. */
  async candidates(userId, query = '') {
    if (!userId) return [];
    const [{ data: iFollow }, { data: followMe }] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', userId).limit(500),
      supabase.from('follows').select('follower_id').eq('following_id', userId).limit(500),
    ]);
    const ids = [...new Set([...(iFollow || []).map((r) => r.following_id), ...(followMe || []).map((r) => r.follower_id)])]
      .filter((id) => id && id !== userId);
    if (!ids.length) return [];
    let q = supabase.from('profiles').select('id, username, avatar_url').in('id', ids.slice(0, 300)).limit(20);
    const term = String(query || '').replace(/^@/, '').trim();
    if (term) q = q.ilike('username', `%${escapeLike(term)}%`);
    const { data } = await q;
    return data || [];
  },
};

export default PresencePrivacy;
