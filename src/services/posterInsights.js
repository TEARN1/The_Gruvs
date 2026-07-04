/**
 * posterInsights — per-event "know your real fans" analytics for the host.
 *
 * For ONE event (the poster), rolls up the real engagement signals the DB
 * actually records — likes on the poster (media_likes), reactions
 * (event_reactions), Touch Downs (live_checkins), and reach (event_views) —
 * into: headline totals, a likes-over-time trend, and a ranked list of the
 * people who engage most (your real fans), with WHAT each of them did.
 *
 * Truth Protocol: only real recorded actions, no invented "reshare" numbers
 * (the app doesn't track event reshares/reposts — only story reshares — so we
 * never fabricate them). Ghost/anonymous Touch Downs count toward the TOTAL but
 * are never attributed to a named fan.
 *
 * aggregatePosterInsights() is pure + unit-tested; getPosterInsights() fetches.
 */
import { supabase } from './supabase';
import { isAnonCheckin } from './superfans';

const DAY_MS = 86400000;

// Weights: showing up (Touch Down) is worth most — it's verified presence —
// then a reaction, then a like. This drives the "real fan" ranking.
const W = { like: 1, reaction: 1.5, touchdown: 3 };

/**
 * @param {{likes:Array, reactions:Array, checkins:Array, views:Array, profiles:Object, now:number, days:number, limit:number}}
 *   likes:     [{ user_id, created_at }]                (media_likes for this event)
 *   reactions: [{ user_id, reaction_key, created_at }]  (event_reactions)
 *   checkins:  [{ user_id, checked_in_at, identity_mode? }] (live_checkins)
 *   views:     [{ user_id, view_count }]                (event_views)
 */
export function aggregatePosterInsights({
  likes = [], reactions = [], checkins = [], views = [], profiles = {},
  now = Date.now(), days = 14, limit = 20,
} = {}) {
  const namedCheckins = checkins.filter(c => !isAnonCheckin(c));

  const totals = {
    likes: likes.length,
    reactions: reactions.length,
    touchdowns: checkins.length, // total presence (incl. anonymous)
    views: views.reduce((s, v) => s + (Number(v.view_count) || 1), 0),
    reach: new Set(views.map(v => v.user_id).filter(Boolean)).size,
    fans: 0, // filled below
  };

  // Likes over time — `days` daily buckets ending today.
  const startDay = new Date(new Date(now).toDateString()).getTime() - (days - 1) * DAY_MS;
  const buckets = Array.from({ length: days }, (_, i) => ({ t: startDay + i * DAY_MS, count: 0 }));
  for (const l of likes) {
    const t = new Date(l.created_at).getTime();
    if (isNaN(t)) continue;
    const idx = Math.floor((t - startDay) / DAY_MS);
    if (idx >= 0 && idx < days) buckets[idx].count += 1;
  }
  const likesOverTime = buckets.map(b => ({ date: new Date(b.t).toISOString().slice(0, 10), count: b.count }));

  // Per-fan roll-up across all signals.
  const byUser = new Map();
  const bump = (uid, field, weight) => {
    if (!uid) return;
    if (!byUser.has(uid)) byUser.set(uid, { userId: uid, likes: 0, reactions: 0, touchdowns: 0, score: 0 });
    const u = byUser.get(uid);
    u[field] += 1;
    u.score += weight;
  };
  for (const l of likes) bump(l.user_id, 'likes', W.like);
  for (const r of reactions) bump(r.user_id, 'reactions', W.reaction);
  for (const c of namedCheckins) bump(c.user_id, 'touchdowns', W.touchdown);

  const topFans = [...byUser.values()].map(u => {
    const p = profiles[u.userId] || {};
    const signalTypes = (u.likes > 0 ? 1 : 0) + (u.reactions > 0 ? 1 : 0) + (u.touchdowns > 0 ? 1 : 0);
    return {
      userId: u.userId,
      username: p.username || null,
      avatar_url: p.avatar_url || null,
      likes: u.likes,
      reactions: u.reactions,
      touchdowns: u.touchdowns,
      score: Math.round(u.score * 10) / 10,
      // A real fan showed up, OR engaged in 2+ different ways, OR racked up a
      // meaningful score — not just a single drive-by like.
      isRealFan: u.touchdowns > 0 || signalTypes >= 2 || u.score >= 4,
    };
  }).sort((a, b) => b.score - a.score || b.touchdowns - a.touchdowns || b.likes - a.likes);

  totals.fans = topFans.length;
  const realFanCount = topFans.filter(f => f.isRealFan).length;

  return { totals, likesOverTime, topFans: topFans.slice(0, limit), realFanCount };
}

/** Fetch + aggregate insights for a single event (poster). */
export async function getPosterInsights(eventId, { limit = 20 } = {}) {
  if (!eventId) return aggregatePosterInsights({});
  try {
    // Touch Downs — prefer identity_mode (to exclude Ghost from naming); tolerate
    // an un-migrated DB without the column.
    let ci = await supabase.from('live_checkins')
      .select('user_id, checked_in_at, identity_mode').eq('event_id', eventId).limit(5000);
    if (ci.error) {
      ci = await supabase.from('live_checkins')
        .select('user_id, checked_in_at').eq('event_id', eventId).limit(5000);
    }
    const [likesR, reactionsR, viewsR] = await Promise.all([
      supabase.from('media_likes').select('user_id, created_at').eq('event_id', eventId).limit(5000),
      supabase.from('event_reactions').select('user_id, reaction_key, created_at').eq('event_id', eventId).limit(5000),
      supabase.from('event_views').select('user_id, view_count').eq('event_id', eventId).limit(5000),
    ]);

    const likes = likesR.data || [];
    const reactions = reactionsR.data || [];
    const checkins = ci.data || [];
    const views = viewsR.data || [];

    const userIds = [...new Set([
      ...likes.map(x => x.user_id),
      ...reactions.map(x => x.user_id),
      ...checkins.filter(c => !isAnonCheckin(c)).map(x => x.user_id),
    ].filter(Boolean))];

    const profiles = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, username, avatar_url').in('id', userIds).limit(1000);
      for (const p of profs || []) profiles[p.id] = p;
    }
    return aggregatePosterInsights({ likes, reactions, checkins, views, profiles, limit });
  } catch {
    return aggregatePosterInsights({});
  }
}

export default { aggregatePosterInsights, getPosterInsights };
