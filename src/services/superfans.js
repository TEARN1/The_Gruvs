/**
 * superfans — "who keeps coming back." For event hosts: rank the people who
 * Touch Down (verified check-in) at YOUR events the most, bucketed by month /
 * year / all-time, with a nudge to treat your most loyal fans special.
 *
 * Built ONLY on real live_checkins (Truth Protocol — a body actually showed up),
 * never RSVPs or impressions. Privacy: Ghost / anonymous check-ins are EXCLUDED
 * — you can never out someone who chose to be invisible (safety stance).
 *
 * rankSuperfans() is a pure, unit-tested function; getHostSuperfans() fetches a
 * host's events + check-ins and rolls them up.
 */
import { supabase } from './supabase';

// A check-in is anonymous (and must NOT surface a fan) when its identity_mode is
// ghost / anonymous / incognito. Unknown/absent identity_mode = public (default).
export const isAnonCheckin = (c) => {
  const m = String(c?.identity_mode || '').toLowerCase();
  return m === 'ghost' || m === 'anonymous' || m === 'anon' || m === 'incognito' || m === 'celebrity';
};

// Fan tiers by how many DISTINCT events of yours they showed up to.
const TIER_META = {
  superfan: { label: 'Superfan',  emoji: '👑', order: 3, suggestion: 'Roll out the red carpet — comp their entry or hand them a VIP upgrade.' },
  true_fan: { label: 'True Fan',  emoji: '⭐', order: 2, suggestion: 'Give them a shoutout or a drink on the house — they keep coming back.' },
  regular:  { label: 'Regular',   emoji: '🔁', order: 1, suggestion: 'Came more than once — a small perk turns them into a superfan.' },
  newcomer: { label: 'First-timer', emoji: '✨', order: 0, suggestion: 'A warm welcome makes a first-timer come back.' },
};

export function fanTier(distinctEvents) {
  if (distinctEvents >= 5) return 'superfan';
  if (distinctEvents >= 3) return 'true_fan';
  if (distinctEvents >= 2) return 'regular';
  return 'newcomer';
}

/** Start-of-window timestamp (ms) for a period, anchored on `now`. */
export function periodStart(period, now = Date.now()) {
  const d = new Date(now);
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (period === 'year')  return new Date(d.getFullYear(), 0, 1).getTime();
  return 0; // all-time
}

/**
 * Rank a host's fans from their events + check-ins.
 * @param {{events:Array, checkins:Array, profiles:Object, period:'month'|'year'|'all', now:number, limit:number}}
 *   events:   [{ id, title, event_date }]
 *   checkins: [{ event_id, user_id, checked_in_at, identity_mode? }]
 *   profiles: { [user_id]: { username, avatar_url } }
 * @returns {{ period, totalFans, superfans, fans:Array }}
 */
export function rankSuperfans({ events = [], checkins = [], profiles = {}, period = 'all', now = Date.now(), limit = 20 } = {}) {
  const eventIds = new Set(events.map(e => e.id));
  const start = periodStart(period, now);

  const ci = checkins.filter(c =>
    c && eventIds.has(c.event_id) && !isAnonCheckin(c) &&
    new Date(c.checked_in_at).getTime() >= start
  );

  // How many of the host's OWN events fall in this window — the denominator for
  // "attended X% of your events".
  const hostEventsInWindow = (period === 'all'
    ? events.length
    : events.filter(e => new Date(e.event_date || 0).getTime() >= start).length) || events.length;

  const byUser = new Map();
  for (const c of ci) {
    if (!byUser.has(c.user_id)) byUser.set(c.user_id, { userId: c.user_id, checkins: 0, events: new Set(), last: 0 });
    const u = byUser.get(c.user_id);
    u.checkins += 1;
    u.events.add(c.event_id);
    const t = new Date(c.checked_in_at).getTime();
    if (!isNaN(t) && t > u.last) u.last = t;
  }

  const fans = [...byUser.values()].map(u => {
    const distinctEvents = u.events.size;
    const tier = fanTier(distinctEvents);
    const meta = TIER_META[tier];
    const p = profiles[u.userId] || {};
    return {
      userId: u.userId,
      username: p.username || null,
      avatar_url: p.avatar_url || null,
      checkins: u.checkins,
      events: distinctEvents,
      lastCheckin: u.last || null,
      sharePct: hostEventsInWindow > 0 ? Math.min(100, Math.round((distinctEvents / hostEventsInWindow) * 100)) : 0,
      tier,
      tierLabel: meta.label,
      tierEmoji: meta.emoji,
      suggestion: meta.suggestion,
      // The people worth treating special: proven repeat fans (True Fan+).
      dueForReward: tier === 'superfan' || tier === 'true_fan',
    };
  });

  fans.sort((a, b) =>
    b.events - a.events ||
    b.checkins - a.checkins ||
    (b.lastCheckin || 0) - (a.lastCheckin || 0)
  );

  return {
    period,
    totalFans: fans.length,
    superfans: fans.filter(f => f.tier === 'superfan').length,
    trueFans: fans.filter(f => f.tier === 'true_fan').length,
    fans: fans.slice(0, limit),
  };
}

/** Fetch + rank a host's superfans for the given period. */
export async function getHostSuperfans(userId, { period = 'all', limit = 20 } = {}) {
  if (!userId) return rankSuperfans({});
  try {
    const { data: events } = await supabase
      .from('events')
      .select('id, title, event_date')
      .eq('author_id', userId)
      .limit(300);
    if (!events?.length) return rankSuperfans({ events: [], period });

    const ids = events.map(e => e.id);
    // Prefer selecting identity_mode (to exclude Ghost check-ins); fall back
    // without it on an un-migrated DB that lacks the column.
    let checkins = [];
    let r = await supabase.from('live_checkins')
      .select('event_id, user_id, checked_in_at, identity_mode').in('event_id', ids).limit(10000);
    if (r.error) {
      r = await supabase.from('live_checkins')
        .select('event_id, user_id, checked_in_at').in('event_id', ids).limit(10000);
    }
    checkins = r.data || [];

    const userIds = [...new Set(checkins.filter(c => !isAnonCheckin(c)).map(c => c.user_id))];
    const profiles = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, username, avatar_url').in('id', userIds).limit(1000);
      for (const p of profs || []) profiles[p.id] = p;
    }
    return rankSuperfans({ events, checkins, profiles, period, limit });
  } catch {
    return rankSuperfans({ period });
  }
}

export default { rankSuperfans, getHostSuperfans, fanTier, periodStart, isAnonCheckin };
