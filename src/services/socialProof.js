/**
 * socialProof — "3 people you follow are going."
 *
 * The single strongest driver of an RSVP in any social product is not the poster,
 * the price or the lineup. It is knowing that someone you actually know will be
 * there. Nobody wants to walk into a room alone.
 *
 * The Gruvs can go one better than "3 friends are interested", because it knows
 * who VERIFIABLY turned up before:
 *
 *   "Thabo and 2 others you follow are going"
 *   "Lerato touched down here last time"
 *
 * Privacy: only ever surfaces people the viewer already follows, and only their
 * public RSVP/attendance on a public event. Never a stranger's movements — that
 * would be surveillance, which is the opposite of what this app is for.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';

/**
 * Which of the people I follow are going to these events?
 *
 * Batched across the whole feed in ONE query — doing it per card would be N+1
 * and would make the feed crawl.
 *
 * @param {string} userId
 * @param {string[]} eventIds
 * @returns {Promise<Map<string, Array<{userId, username, avatarUrl, status}>>>}
 */
export async function friendsGoing(userId, eventIds) {
  const out = new Map();
  if (!userId || !eventIds?.length) return out;

  try {
    // never select `id` on follows — composite PK, there is no id column
    const { data: follows, error: fErr } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .limit(2000);
    if (fErr) throw fErr;

    const followingIds = (follows || []).map((f) => f.following_id).filter(Boolean);
    if (!followingIds.length) return out;

    const { data: rsvps, error: rErr } = await supabase
      .from('event_rsvps')
      // never select `id` on event_rsvps — composite PK
      .select('event_id, user_id, status, profiles:user_id(username, avatar_url)')
      .in('event_id', eventIds.slice(0, 100))
      .in('user_id', followingIds)
      .eq('status', 'going');
    if (rErr) throw rErr;

    for (const r of rsvps || []) {
      const list = out.get(r.event_id) || [];
      list.push({
        userId: r.user_id,
        username: r.profiles?.username || 'someone',
        avatarUrl: r.profiles?.avatar_url || null,
        status: r.status,
      });
      out.set(r.event_id, list);
    }
    return out;
  } catch (e) {
    logError('SocialProof.friendsGoing', e);
    return out;   // a failure here must never blank the feed
  }
}

/**
 * "Thabo and 2 others you follow are going"
 * Names the person — an abstract count is far weaker than a face you know.
 */
export function friendsLabel(friends) {
  const list = (friends || []).filter(Boolean);
  if (!list.length) return '';
  const [first, ...rest] = list;
  if (!rest.length) return `${first.username} is going`;
  if (rest.length === 1) return `${first.username} and ${rest[0].username} are going`;
  return `${first.username} and ${rest.length} others you follow are going`;
}

export default { friendsGoing, friendsLabel };
