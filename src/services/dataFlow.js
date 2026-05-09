/**
 * The Gruvs — Data Flow Engine v2
 * Centralised data layer: caching, real-time, optimistic updates, managers for
 * every domain (Feed, Trending, Vibe, RSVP, Bookmark, User, Notification,
 * CheckIn, Analytics, Calendar, Route, Score).
 */

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// CACHE  (stale-while-revalidate, prefix invalidation)
// ─────────────────────────────────────────────────────────────────────────────
const CACHE     = {};
const CACHE_TTL = 90_000; // 90 s fresh window

const cache = {
  set(key, value, ttl = CACHE_TTL) {
    CACHE[key] = { value, ts: Date.now(), ttl };
  },
  get(key) {
    const entry = CACHE[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > entry.ttl) { delete CACHE[key]; return null; }
    return entry.value;
  },
  // Returns stale value (if any) AND triggers background revalidation
  getStale(key) {
    return CACHE[key]?.value ?? null;
  },
  invalidate(prefix) {
    Object.keys(CACHE).forEach(k => { if (k.startsWith(prefix)) delete CACHE[k]; });
  },
  clear() { Object.keys(CACHE).forEach(k => delete CACHE[k]); },
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORE ENGINE  (Vibe Score — used for feed ranking & profile display)
// ─────────────────────────────────────────────────────────────────────────────
export const ScoreEngine = {
  // Weighted relevance score for a single event (higher = more relevant)
  eventScore(event, { userInterests = [], followedIds = [], userLat, userLon } = {}) {
    let score = 0;

    // Social signals
    score += (event.vibe_count  || 0) * 1.5;
    score += (event.going       || 0) * 1.2;
    score += (event.echo_count  || 0) * 0.8;

    // Personalisation boosts
    if (followedIds.includes(event.author_id)) score += 25;
    if (userInterests.includes(event.category)) score += 15;

    // Recency — events created in the last 6 h get a spike
    const ageH = (Date.now() - new Date(event.created_at).getTime()) / 3_600_000;
    score += Math.max(0, 20 - ageH * 0.5);

    // Upcoming proximity — events in the next 48 h get boosted
    if (event.event_date) {
      const daysUntil = (new Date(event.event_date) - Date.now()) / 86_400_000;
      if (daysUntil >= 0 && daysUntil <= 2) score += 18;
    }

    // Free events get a small nudge
    if (!event.price || event.price === 0) score += 5;

    // Distance penalty if coords are available (rough haversine)
    if (userLat && userLon && event.lat && event.lon) {
      const distKm = _haversine(userLat, userLon, event.lat, event.lon);
      score -= Math.min(15, distKm * 0.3);
    }

    return score;
  },

  // Compute and persist a user's Vibe Score
  async computeVibeScore(userId) {
    try {
      const [posts, vibes, rsvps, checkins] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('event_rsvps').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);
      const score =
        (posts.count    || 0) * 10 +
        (vibes.count    || 0) * 3  +
        (rsvps.count    || 0) * 5  +
        (checkins.count || 0) * 8;
      await supabase.from('profiles').update({ vibe_score: score }).eq('id', userId);
      cache.invalidate(`profile_stats:${userId}`);
      return score;
    } catch { return 0; }
  },
};

function _haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// FEED MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const FeedManager = {
  PAGE_SIZE: 15,

  async fetchPage({
    page = 0, category = 'all', query = '', mode = 'drop',
    userInterests = [], followedIds = [], userLat, userLon,
  } = {}) {
    const cacheKey = `feed:${mode}:${category}:${query}:${page}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    try {
      let q = supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, is_online, vibe_score)', { count: 'estimated' })
        .range(page * this.PAGE_SIZE, (page + 1) * this.PAGE_SIZE - 1);

      if (category !== 'all') q = q.eq('category', category);

      if (query.trim()) {
        const s = query.trim();
        q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%,venue_name.ilike.%${s}%,city.ilike.%${s}%`);
        q = q.order('vibe_count', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      const { data, error, count } = await q;
      if (error) throw error;

      // Apply ScoreEngine ranking (client-side re-sort for personalisation)
      let events = data || [];
      if ((userInterests.length > 0 || followedIds.length > 0) && !query.trim()) {
        events = [...events].sort((a, b) =>
          ScoreEngine.eventScore(b, { userInterests, followedIds, userLat, userLon }) -
          ScoreEngine.eventScore(a, { userInterests, followedIds, userLat, userLon })
        );
      }

      const result = { events, total: count || 0, page, hasMore: events.length === this.PAGE_SIZE };
      cache.set(cacheKey, result);
      return result;
    } catch { return { events: [], total: 0, page, hasMore: false }; }
  },

  // Featured Gruv — pinned or highest scoring upcoming event
  async fetchFeatured({ userInterests = [], followedIds = [] } = {}) {
    const cacheKey = 'feed:featured';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, vibe_score)')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('vibe_count', { ascending: false })
        .limit(20);

      if (!data?.length) return null;

      // Pick the one with the highest personalised score
      const best = [...data].sort((a, b) =>
        ScoreEngine.eventScore(b, { userInterests, followedIds }) -
        ScoreEngine.eventScore(a, { userInterests, followedIds })
      )[0];

      cache.set('feed:featured', best, 120_000); // 2-min TTL for hero card
      return best;
    } catch { return null; }
  },

  async searchAll(query) {
    if (!query.trim()) return { events: [], users: [] };
    const s = query.trim();
    try {
      const [evRes, userRes, ftsRes] = await Promise.allSettled([
        supabase
          .from('events')
          .select('*, profiles(id, username, avatar_url)')
          .or(`title.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%,venue_name.ilike.%${s}%,city.ilike.%${s}%`)
          .order('vibe_count', { ascending: false })
          .limit(20),
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio, location, vibe_score')
          .or(`username.ilike.%${s}%,display_name.ilike.%${s}%,bio.ilike.%${s}%`)
          .limit(10),
        supabase.rpc('search_events_fts', { search_query: s, limit_count: 20 }),
      ]);

      const ilikeEvents = evRes.status   === 'fulfilled' ? (evRes.value.data   || []) : [];
      const users       = userRes.status === 'fulfilled' ? (userRes.value.data || []) : [];
      const ftsEvents   = ftsRes.status  === 'fulfilled' && ftsRes.value.data?.length > 0
        ? ftsRes.value.data : null;

      const eventMap = new Map();
      (ftsEvents || ilikeEvents).forEach(e => eventMap.set(e.id, e));
      if (ftsEvents) ilikeEvents.forEach(e => { if (!eventMap.has(e.id)) eventMap.set(e.id, e); });

      return { events: [...eventMap.values()].slice(0, 20), users };
    } catch { return { events: [], users: [] }; }
  },

  async fetchSingle(eventId) {
    const cacheKey = `event:${eventId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, is_online, vibe_score)')
        .eq('id', eventId)
        .single();
      if (data) cache.set(cacheKey, data);
      return data;
    } catch { return null; }
  },

  invalidate(eventId) {
    if (eventId) cache.invalidate(`event:${eventId}`);
    cache.invalidate('feed:');
    cache.invalidate('happening_now');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const TrendingManager = {
  async fetch(limit = 8) {
    const cacheKey = `trending:${limit}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.rpc('find_popular_spots', { limit_count: limit });
      if (data?.length > 0) { cache.set(cacheKey, data); return data; }
    } catch {}
    return [];
  },

  async fetchHappeningNow() {
    const cacheKey = 'happening_now';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const today    = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('*, profiles(username, avatar_url)')
        .gte('event_date', today)
        .lte('event_date', tomorrow)
        .order('vibe_count', { ascending: false })
        .limit(8);
      const result = data || [];
      cache.set(cacheKey, result, 60_000); // 1-min TTL — high volatility
      return result;
    } catch { return []; }
  },

  async fetchThisWeek() {
    const cacheKey = 'this_week';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const today   = new Date().toISOString().split('T')[0];
      const week    = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('*, profiles(username, avatar_url)')
        .gte('event_date', today)
        .lte('event_date', week)
        .order('vibe_count', { ascending: false })
        .limit(20);
      const result = data || [];
      cache.set(cacheKey, result, 300_000); // 5-min TTL
      return result;
    } catch { return []; }
  },

  // Returns { category: count } with a hard ceiling to avoid full scans
  async fetchCategoryCounts() {
    const cacheKey = 'category_counts';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('events')
        .select('category')
        .not('category', 'is', null)
        .limit(500); // cap — avoids full-table scans
      if (!data) return {};
      const counts = {};
      data.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
      cache.set(cacheKey, counts, 300_000);
      return counts;
    } catch { return {}; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VIBE MANAGER  (reactions on events)
// ─────────────────────────────────────────────────────────────────────────────
export const VibeManager = {
  // Returns updated vibe count, or null on failure
  async sendVibe(eventId, userId) {
    try {
      const { error } = await supabase
        .from('event_vibes')
        .upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true });
      if (error) return null;
      await supabase.rpc('increment_vibe_count', { eid: eventId });
      FeedManager.invalidate(eventId);
      // Fire notification to event author (best-effort)
      _notifyEventAuthor(eventId, userId, 'vibe').catch(() => {});
      return true;
    } catch { return null; }
  },

  async removeVibe(eventId, userId) {
    try {
      const { error } = await supabase
        .from('event_vibes')
        .delete().eq('event_id', eventId).eq('user_id', userId);
      if (error) return null;
      await supabase.rpc('decrement_vibe_count', { eid: eventId });
      FeedManager.invalidate(eventId);
      return true;
    } catch { return null; }
  },

  async getUserVibes(eventIds, userId) {
    if (!userId || !eventIds.length) return new Set();
    const cacheKey = `user_vibes:${userId}:${eventIds.slice(0, 3).join(',')}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_vibes')
        .select('event_id')
        .eq('user_id', userId)
        .in('event_id', eventIds);
      const result = new Set((data || []).map(v => v.event_id));
      cache.set(cacheKey, result, 30_000);
      return result;
    } catch { return new Set(); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RSVP MANAGER  (Vibing / Maybe / Not Vibing)
// ─────────────────────────────────────────────────────────────────────────────
export const RSVPManager = {
  async upsert(eventId, userId, status) {
    try {
      const { error } = await supabase
        .from('event_rsvps')
        .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' });
      if (error) throw error;
      cache.invalidate(`rsvp:${userId}`);
      FeedManager.invalidate(eventId);
      if (status === 'going') {
        _notifyEventAuthor(eventId, userId, 'rsvp').catch(() => {});
      }
      return true;
    } catch { return false; }
  },

  async remove(eventId, userId) {
    try {
      await supabase.from('event_rsvps')
        .delete().eq('event_id', eventId).eq('user_id', userId);
      cache.invalidate(`rsvp:${userId}`);
      return true;
    } catch { return false; }
  },

  async getUserStatus(eventId, userId) {
    if (!userId) return null;
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      return data?.status ?? null;
    } catch { return null; }
  },

  async getGoingCount(eventId) {
    try {
      const { count } = await supabase
        .from('event_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'going');
      return count || 0;
    } catch { return 0; }
  },

  // Fetch all RSVPs for a user's events in one shot (for organiser dashboards)
  async getEventRSVPs(eventId) {
    const cacheKey = `rsvps:${eventId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status, user_id, profiles(username, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(200);
      const result = data || [];
      cache.set(cacheKey, result, 60_000);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKMARK MANAGER  (Saved Gruvs)
// ─────────────────────────────────────────────────────────────────────────────
export const BookmarkManager = {
  async toggle(eventId, userId, isSaved) {
    try {
      if (isSaved) {
        await supabase.from('saved_events').delete().eq('event_id', eventId).eq('user_id', userId);
      } else {
        await supabase.from('saved_events').upsert({ event_id: eventId, user_id: userId });
      }
      cache.invalidate(`saved:${userId}`);
      return !isSaved;
    } catch { return isSaved; }
  },

  async getUserSaved(userId) {
    const cacheKey = `saved:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('saved_events')
        .select('event_id, events(id, title, event_date, category, media, vibe_count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const result = new Set((data || []).map(r => r.event_id));
      cache.set(cacheKey, result);
      return result;
    } catch { return new Set(); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGER  (follow/unfollow, social graph, profile)
// ─────────────────────────────────────────────────────────────────────────────
export const UserManager = {
  async follow(followerId, followingId) {
    try {
      await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
      cache.invalidate(`follows:${followerId}`);
      cache.invalidate(`followers:${followingId}`);
      _notify(followingId, followerId, 'follow', 'Someone locked in to your Gruvs', '').catch(() => {});
      return true;
    } catch { return false; }
  },

  async unfollow(followerId, followingId) {
    try {
      await supabase.from('follows')
        .delete().eq('follower_id', followerId).eq('following_id', followingId);
      cache.invalidate(`follows:${followerId}`);
      cache.invalidate(`followers:${followingId}`);
      return true;
    } catch { return false; }
  },

  async isFollowing(followerId, followingId) {
    if (!followerId || !followingId) return false;
    try {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getFollowedIds(userId) {
    const cacheKey = `follows:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
      const result = (data || []).map(r => r.following_id);
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },

  async getFollowerCount(userId) {
    try {
      const { count } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId);
      return count || 0;
    } catch { return 0; }
  },

  async getProfile(userId) {
    const cacheKey = `profile:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) cache.set(cacheKey, data);
      return data;
    } catch { return null; }
  },

  async updateProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      cache.invalidate(`profile:${userId}`);
      cache.invalidate(`profile_stats:${userId}`);
      return data;
    } catch { return null; }
  },

  // Upsert profile row — safe to call on every sign-in for new users
  async ensureProfile(userId, email) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (!data) {
        await supabase.from('profiles').insert({
          id: userId,
          username: `viber_${userId.slice(0, 8)}`,
          email,
          vibe_score: 0,
        });
      }
    } catch {}
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationManager = {
  async fetch(userId, limit = 100) {
    if (!userId) return [];
    const cacheKey = `notifs:${userId}`;
    const stale    = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      const result = data || [];
      cache.set(cacheKey, result, 30_000);
      return result;
    } catch { return stale || []; }
  },

  async markRead(notifId) {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', notifId);
      return true;
    } catch { return false; }
  },

  async markAllRead(userId) {
    try {
      await supabase.from('notifications')
        .update({ read: true }).eq('recipient_id', userId).eq('read', false);
      cache.invalidate(`notifs:${userId}`);
      return true;
    } catch { return false; }
  },

  async getUnreadCount(userId) {
    if (!userId) return 0;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false);
      return count || 0;
    } catch { return 0; }
  },

  // Subscribe to new notifications in real-time
  subscribe(userId, onNew) {
    const channel = supabase
      .channel(`notifs_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, payload => {
        cache.invalidate(`notifs:${userId}`);
        onNew?.(payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN MANAGER  (Touch Down)
// ─────────────────────────────────────────────────────────────────────────────
export const CheckInManager = {
  async touchDown(eventId, userId, coords = {}) {
    try {
      const { error } = await supabase
        .from('live_checkins')
        .upsert(
          {
            user_id: userId,
            event_id: eventId,
            lat: coords.lat ?? null,
            lon: coords.lon ?? null,
            checked_in_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,event_id' }
        );
      if (error) throw error;

      // Atomic vibe score increment — no race condition
      await supabase.rpc('increment_profile_score', { uid: userId, amount: 8 }).catch(() =>
        // Fallback: read-then-write if RPC not available
        supabase.from('profiles').select('vibe_score').eq('id', userId).single()
          .then(({ data }) =>
            supabase.from('profiles').update({ vibe_score: (data?.vibe_score || 0) + 8 }).eq('id', userId)
          )
      );

      cache.invalidate(`profile:${userId}`);
      cache.invalidate(`profile_stats:${userId}`);
      _notifyEventAuthor(eventId, userId, 'checkin').catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  },

  async hasCheckedIn(eventId, userId) {
    if (!userId) return false;
    try {
      const { data } = await supabase
        .from('live_checkins')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getLiveAttendees(eventId) {
    const cacheKey = `attendees:${eventId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('live_checkins')
        .select('user_id, checked_in_at, profiles(username, avatar_url, vibe_score)')
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false })
        .limit(50);
      const result = data || [];
      cache.set(cacheKey, result, 30_000);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY MANAGER  (Nearby events & Vibers)
// ─────────────────────────────────────────────────────────────────────────────
export const DiscoveryManager = {
  async findNearbyEvents(lat, lon, radiusKm = 25) {
    const cacheKey = `nearby_events:${Math.round(lat * 10)}:${Math.round(lon * 10)}:${radiusKm}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.rpc('find_nearby_events', {
        lat, lon, radius_km: radiusKm, limit_count: 20,
      });
      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch { return []; }
  },

  async findNearbyVibers(userId, radius = 10) {
    const cacheKey = `nearby_vibers:${userId}:${radius}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.rpc('find_nearby_vibers', {
        uid: userId, max_dist_km: radius, limit_count: 20,
      });
      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const AnalyticsManager = {
  async getProfileStats(userId) {
    const cacheKey = `profile_stats:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const [posts, saves, vibes, checkins, followers] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('saved_events').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      ]);
      const result = {
        gruvCount:     posts.count     || 0,
        savedCount:    saves.count     || 0,
        vibeCount:     vibes.count     || 0,
        touchDownCount: checkins.count || 0,
        followerCount: followers.count || 0,
      };
      cache.set(cacheKey, result);
      return result;
    } catch { return { gruvCount: 0, savedCount: 0, vibeCount: 0, touchDownCount: 0, followerCount: 0 }; }
  },

  // Per-event stats for organisers
  async getEventStats(eventId) {
    const cacheKey = `event_stats:${eventId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const [vibes, rsvps, checkins, echoes] = await Promise.all([
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_rsvps').select('status').eq('event_id', eventId),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('echoes').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      ]);
      const rsvpData = rsvps.data || [];
      const result = {
        vibes:      vibes.count     || 0,
        going:      rsvpData.filter(r => r.status === 'going').length,
        maybe:      rsvpData.filter(r => r.status === 'maybe').length,
        notGoing:   rsvpData.filter(r => r.status === 'not_going').length,
        touchDowns: checkins.count  || 0,
        echoes:     echoes.count    || 0,
        conversionRate: rsvpData.length > 0
          ? Math.round((checkins.count || 0) / rsvpData.length * 100)
          : 0,
      };
      cache.set(cacheKey, result, 120_000);
      return result;
    } catch { return null; }
  },

  // [M,T,W,T,F,S,S] Gruv posting activity for profile chart
  async getWeeklyActivity(userId) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data } = await supabase
        .from('events')
        .select('created_at')
        .eq('author_id', userId)   // fixed: was user_id
        .gte('created_at', weekAgo);
      const days = [0, 0, 0, 0, 0, 0, 0];
      (data || []).forEach(e => {
        const dow = new Date(e.created_at).getDay();
        days[dow === 0 ? 6 : dow - 1]++;
      });
      return days;
    } catch { return [0, 0, 0, 0, 0, 0, 0]; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const CalendarManager = {
  async fetchMonthEvents(year, month) {
    const cacheKey = `cal:${year}:${month}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const from    = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to      = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    try {
      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, event_time, category, category_color, venue_name, going, vibe_count, media')
        .gte('event_date', from)
        .lte('event_date', to)
        .order('event_date', { ascending: true })
        .limit(60);
      const result = data || [];
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },

  async fetchUpcoming(limit = 10) {
    const cacheKey = `upcoming:${limit}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, event_time, category, category_color, venue_name, going, vibe_count, media')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(limit);
      const result = data || [];
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME MANAGER  (subscriptions with reconnect)
// ─────────────────────────────────────────────────────────────────────────────
export const RealtimeManager = {
  _subs: {},

  subscribeToFeed(onInsert, onUpdate) {
    this._add('feed_realtime', 'events_feed',
      supabase.channel('events_feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, p => {
          cache.invalidate('feed:');
          cache.invalidate('happening_now');
          onInsert?.(p.new);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, p => {
          cache.invalidate(`event:${p.new.id}`);
          cache.invalidate('feed:');
          onUpdate?.(p.new);
        })
    );
    return () => this._remove('feed_realtime');
  },

  subscribeToEvent(eventId, onChange) {
    const key = `event_${eventId}`;
    this._add(key, key,
      supabase.channel(key)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, p => {
          cache.invalidate(`event:${eventId}`);
          onChange?.(p.new);
        })
    );
    return () => this._remove(key);
  },

  // Live vibe count changes for an event (useful on EventDetail screen)
  subscribeToVibeCount(eventId, onChange) {
    const key = `vibes_${eventId}`;
    this._add(key, key,
      supabase.channel(key)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'event_vibes',
          filter: `event_id=eq.${eventId}`,
        }, async () => {
          // Fetch fresh count instead of trusting incremental payload
          const { count } = await supabase
            .from('event_vibes')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', eventId);
          onChange?.(count || 0);
        })
    );
    return () => this._remove(key);
  },

  // Live Touch Down attendee count
  subscribeToAttendees(eventId, onChange) {
    const key = `checkins_${eventId}`;
    this._add(key, key,
      supabase.channel(key)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'live_checkins',
          filter: `event_id=eq.${eventId}`,
        }, p => {
          cache.invalidate(`attendees:${eventId}`);
          onChange?.(p.new);
        })
    );
    return () => this._remove(key);
  },

  _add(key, channelName, channel) {
    this._remove(key);
    channel.subscribe((status) => {
      // Auto-reconnect on unexpected close
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setTimeout(() => channel.subscribe(), 3000);
      }
    });
    this._subs[key] = channel;
  },

  _remove(key) {
    if (this._subs[key]) {
      supabase.removeChannel(this._subs[key]);
      delete this._subs[key];
    }
  },

  removeAll() {
    Object.keys(this._subs).forEach(k => this._remove(k));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE MANAGER  (Gruv Journeys / Itineraries)
// ─────────────────────────────────────────────────────────────────────────────
export const RouteManager = {
  async createRoute(userId, title, description, color = '#00f2ff') {
    try {
      const { data, error } = await supabase
        .from('routes')
        .insert({ creator_id: userId, title, description, route_color: color })
        .select()
        .single();
      if (error) throw error;
      cache.invalidate(`routes:${userId}`);
      return data;
    } catch { return null; }
  },

  async addStep(routeId, eventId, order, arrivalTime = null) {
    try {
      const { error } = await supabase
        .from('route_steps')
        .insert({ route_id: routeId, event_id: eventId, step_order: order, arrival_time: arrivalTime });
      if (error) throw error;
      cache.invalidate(`journey:${routeId}`);
      return true;
    } catch { return false; }
  },

  async getJourney(routeId) {
    const cacheKey = `journey:${routeId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('route_steps')
        .select('*, event:events(*)')
        .eq('route_id', routeId)
        .order('step_order', { ascending: true });
      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch { return []; }
  },

  async getUserRoutes(userId) {
    const cacheKey = `routes:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('routes')
        .select('*')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false });
      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Send a notification to the author of an event (best-effort, never throws)
async function _notifyEventAuthor(eventId, actorId, type) {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('author_id, title')
      .eq('id', eventId)
      .maybeSingle();
    if (!event?.author_id || event.author_id === actorId) return;
    const messages = {
      vibe:    { title: 'New Vibe on your Gruv 🔥', body: `Someone Vibed "${event.title}"` },
      rsvp:    { title: 'New Vibe-In on your Gruv', body: `Someone is Vibing to "${event.title}"` },
      checkin: { title: 'Someone Touched Down 📍',  body: `A Vibe just Touched Down at "${event.title}"` },
    };
    const msg = messages[type];
    if (!msg) return;
    await _notify(event.author_id, actorId, type, msg.title, msg.body);
  } catch {}
}

async function _notify(recipientId, actorId, type, title, body) {
  try {
    await supabase.from('notifications').insert({
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      title,
      body,
      read: false,
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE MANAGER  (DM inbox, conversations, unread count)
// ─────────────────────────────────────────────────────────────────────────────
export const MessageManager = {
  // Fetch all conversations for user — one row per partner, sorted by latest message
  async getConversations(userId) {
    if (!userId) return [];
    const cacheKey = `convos:${userId}`;
    const stale    = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('messages')
        .select(`
          id, sender_id, recipient_id, body, created_at, read_at,
          is_request, request_accepted, deleted_at,
          sender:profiles!messages_sender_id_fkey(id, username, avatar_url, is_online),
          recipient:profiles!messages_recipient_id_fkey(id, username, avatar_url, is_online)
        `)
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500);

      const rows = data || [];
      // Deduplicate — keep only latest message per conversation partner
      const seen  = {};
      const convos = [];
      for (const msg of rows) {
        const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        if (!seen[partnerId]) {
          seen[partnerId] = true;
          const partner = msg.sender_id === userId ? msg.recipient : msg.sender;
          convos.push({ ...msg, partner, partnerId });
        }
      }
      cache.set(cacheKey, convos, 30_000);
      return convos;
    } catch { return stale || []; }
  },

  // Count unread DMs for the nav badge
  async getUnreadCount(userId) {
    if (!userId) return 0;
    const cacheKey = `dm_unread:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached !== null) return cached;
    try {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null)
        .is('deleted_at', null);
      const n = count || 0;
      cache.set(cacheKey, n, 15_000);
      return n;
    } catch { return 0; }
  },

  // Send a message — first message auto-marks as request
  async send(senderId, recipientId, body) {
    try {
      // Check if conversation already accepted
      const { data: prior } = await supabase
        .from('messages')
        .select('id, request_accepted')
        .or(`and(sender_id.eq.${recipientId},recipient_id.eq.${senderId}),and(sender_id.eq.${senderId},recipient_id.eq.${recipientId})`)
        .limit(1)
        .maybeSingle();
      const accepted = !!prior?.request_accepted;

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: senderId, recipient_id: recipientId,
          body: body.trim(),
          is_request: !accepted,
          request_accepted: accepted,
        })
        .select()
        .single();
      if (error) throw error;

      cache.invalidate(`convos:${senderId}`);
      cache.invalidate(`convos:${recipientId}`);
      cache.invalidate(`dm_unread:${recipientId}`);

      // Notify recipient
      _notify(recipientId, senderId, 'message', 'New Message Request', body.trim().slice(0, 80)).catch(() => {});

      return data;
    } catch { return null; }
  },

  // Accept a conversation request
  async acceptRequest(conversationSenderId, recipientId) {
    try {
      await supabase
        .from('messages')
        .update({ request_accepted: true, is_request: false })
        .eq('sender_id', conversationSenderId)
        .eq('recipient_id', recipientId);
      cache.invalidate(`convos:${recipientId}`);
      cache.invalidate(`convos:${conversationSenderId}`);
      return true;
    } catch { return false; }
  },

  // Mark all messages from a sender as read
  async markRead(senderId, recipientId) {
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', senderId)
        .eq('recipient_id', recipientId)
        .is('read_at', null);
      cache.invalidate(`dm_unread:${recipientId}`);
      cache.invalidate(`convos:${recipientId}`);
      return true;
    } catch { return false; }
  },

  // Fetch messages between two users
  async fetchThread(userA, userB, limit = 100) {
    const cacheKey = `thread:${[userA, userB].sort().join('_')}`;
    const stale    = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userA},recipient_id.eq.${userB}),and(sender_id.eq.${userB},recipient_id.eq.${userA})`)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(limit);
      const result = data || [];
      cache.set(cacheKey, result, 20_000);
      return result;
    } catch { return stale || []; }
  },

  // Soft-delete a message
  async deleteMessage(messageId, userId) {
    try {
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', userId);
      cache.invalidate('thread:');
      cache.invalidate('convos:');
      return true;
    } catch { return false; }
  },

  // React to a message with an emoji
  async reactToMessage(messageId, emoji) {
    try {
      await supabase.from('messages').update({ reaction: emoji }).eq('id', messageId);
      return true;
    } catch { return false; }
  },

  // Real-time subscription for DM unread badge
  subscribeUnreadCount(userId, onChange) {
    const channelName = `dm_unread_${userId}_${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        cache.invalidate(`dm_unread:${userId}`);
        cache.invalidate(`convos:${userId}`);
        this.getUnreadCount(userId).then(onChange);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const BlockManager = {
  async block(blockerId, blockedId) {
    try {
      await supabase.from('blocked_users').upsert(
        { blocker_id: blockerId, blocked_id: blockedId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
      );
      cache.invalidate(`blocks:${blockerId}`);
      return true;
    } catch { return false; }
  },

  async unblock(blockerId, blockedId) {
    try {
      await supabase.from('blocked_users')
        .delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
      cache.invalidate(`blocks:${blockerId}`);
      return true;
    } catch { return false; }
  },

  async isBlocked(blockerId, blockedId) {
    try {
      const { data } = await supabase
        .from('blocked_users').select('id')
        .eq('blocker_id', blockerId).eq('blocked_id', blockedId).maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getBlockedIds(userId) {
    const cacheKey = `blocks:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('blocked_users').select('blocked_id').eq('blocker_id', userId);
      const result = (data || []).map(r => r.blocked_id);
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MUTE MANAGER  (hide user's events from feed)
// ─────────────────────────────────────────────────────────────────────────────
export const MuteManager = {
  async mute(muterId, mutedId) {
    try {
      await supabase.from('muted_users').upsert(
        { muter_id: muterId, muted_id: mutedId },
        { onConflict: 'muter_id,muted_id', ignoreDuplicates: true }
      );
      cache.invalidate(`mutes:${muterId}`);
      return true;
    } catch { return false; }
  },

  async unmute(muterId, mutedId) {
    try {
      await supabase.from('muted_users').delete().eq('muter_id', muterId).eq('muted_id', mutedId);
      cache.invalidate(`mutes:${muterId}`);
      return true;
    } catch { return false; }
  },

  async getMutedIds(userId) {
    const cacheKey = `mutes:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.from('muted_users').select('muted_id').eq('muter_id', userId);
      const result = (data || []).map(r => r.muted_id);
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REMINDER MANAGER  (event reminders — stored in DB, fired as local notifs)
// ─────────────────────────────────────────────────────────────────────────────
export const ReminderManager = {
  async set(userId, eventId, eventDate, eventTime, minutesBefore = 60) {
    try {
      const eventDateTime = new Date(`${eventDate}T${eventTime || '20:00'}:00`);
      const remindAt = new Date(eventDateTime.getTime() - minutesBefore * 60 * 1000);
      if (remindAt <= new Date()) return false; // already past

      const { error } = await supabase.from('event_reminders').upsert(
        { user_id: userId, event_id: eventId, remind_at: remindAt.toISOString(), minutes_before: minutesBefore },
        { onConflict: 'user_id,event_id' }
      );
      if (error) throw error;
      cache.invalidate(`reminders:${userId}`);
      return true;
    } catch { return false; }
  },

  async cancel(userId, eventId) {
    try {
      await supabase.from('event_reminders').delete().eq('user_id', userId).eq('event_id', eventId);
      cache.invalidate(`reminders:${userId}`);
      return true;
    } catch { return false; }
  },

  async hasReminder(userId, eventId) {
    try {
      const { data } = await supabase
        .from('event_reminders').select('id').eq('user_id', userId).eq('event_id', eventId).maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getUserReminders(userId) {
    const cacheKey = `reminders:${userId}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_reminders')
        .select('*, event:events(id, title, event_date, event_time, venue_name)')
        .eq('user_id', userId).eq('sent', false)
        .order('remind_at', { ascending: true });
      const result = data || [];
      cache.set(cacheKey, result, 60_000);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PRESENCE MANAGER  (online/offline status)
// ─────────────────────────────────────────────────────────────────────────────
export const PresenceManager = {
  _channel: null,

  async goOnline(userId) {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', userId);
      cache.invalidate(`profile:${userId}`);
      // Also log session for retention logic
      RetentionManager.logSession(userId).catch(() => {});
    } catch {}
  },

  async goOffline(userId) {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', userId);
      cache.invalidate(`profile:${userId}`);
    } catch {}
  },

  // Subscribe to a specific user's online status changes
  subscribeToUser(userId, onChange) {
    const channel = supabase
      .channel(`presence_${userId}_${Math.random().toString(36).substr(2, 5)}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${userId}`,
      }, payload => {
        onChange?.({ is_online: payload.new.is_online, last_seen: payload.new.last_seen });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CAPACITY MANAGER  (event max_attendees / sold-out)
// ─────────────────────────────────────────────────────────────────────────────
export const CapacityManager = {
  async getStatus(eventId) {
    try {
      const { data: event } = await supabase
        .from('events').select('max_attendees, is_sold_out').eq('id', eventId).single();
      if (!event) return { hasLimit: false, isSoldOut: false, spotsLeft: null };

      if (!event.max_attendees) return { hasLimit: false, isSoldOut: false, spotsLeft: null };
      const { count } = await supabase
        .from('check_ins').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId);
      const spotsLeft = Math.max(0, event.max_attendees - (count || 0));
      return { hasLimit: true, isSoldOut: event.is_sold_out || spotsLeft === 0, spotsLeft, capacity: event.max_attendees };
    } catch { return { hasLimit: false, isSoldOut: false, spotsLeft: null }; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN MANAGER  (Missions)
// ─────────────────────────────────────────────────────────────────────────────
export const CampaignManager = {
  async fetchForBusiness(bizId) {
    if (!bizId) return [];
    const cacheKey = `campaigns:${bizId}`;
    const stale    = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('ad_campaigns')
        .select('*')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false });
      const result = data || [];
      cache.set(cacheKey, result, 60_000);
      return result;
    } catch { return stale || []; }
  },

  async updateStatus(campaignId, status) {
    try {
      const { error } = await supabase.from('ad_campaigns').update({ status }).eq('id', campaignId);
      if (error) throw error;
      cache.invalidate('campaigns:');
      return true;
    } catch { return false; }
  },

  async getPerformance(campaignId) {
    try {
      const { data } = await supabase
        .from('campaign_analytics')
        .select('event_type, created_at')
        .eq('campaign_id', campaignId);
      return data || [];
    } catch { return []; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ECOSYSTEM MANAGER  (Business Partnerships)
// ─────────────────────────────────────────────────────────────────────────────
export const EcosystemManager = {
  async fetchPartners(bizId) {
    if (!bizId) return [];
    try {
      const { data } = await supabase
        .from('business_partnerships')
        .select('*, partner:partner_id(id, business_name, tagline, logo_url)')
        .eq('business_id', bizId);
      return data || [];
    } catch { return []; }
  },

  async requestPartnership(bizId, targetBizId, type = 'collaboration') {
    try {
      const { error } = await supabase.from('business_partnerships').insert({
        business_id: bizId,
        partner_id: targetBizId,
        status: 'pending',
        partnership_type: type
      });
      return !error;
    } catch { return false; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOWING FEED  (events from users you follow)
// ─────────────────────────────────────────────────────────────────────────────
export const FollowingFeedManager = {
  async fetch(userId, page = 0, pageSize = 15) {
    if (!userId) return { events: [], hasMore: false };
    const cacheKey = `following_feed:${userId}:${page}`;
    const cached   = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const followedIds = await UserManager.getFollowedIds(userId);
      if (!followedIds.length) return { events: [], hasMore: false };

      const { data } = await supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, vibe_score)')
        .in('author_id', followedIds)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      const result = { events: data || [], hasMore: (data || []).length === pageSize };
      cache.set(cacheKey, result, 60_000);
      return result;
    } catch { return { events: [], hasMore: false }; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CACHE CLEAR  (call on sign-out)
// ─────────────────────────────────────────────────────────────────────────────
export const clearAllCache = () => {
  cache.clear();
};

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCE UTIL  (reuse across components without a separate import)
// ─────────────────────────────────────────────────────────────────────────────
export function debounce(fn, ms = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// HOTSPOT MANAGER (PostGIS Heatmap Logic)
// ─────────────────────────────────────────────────────────────────────────────
export const HotspotManager = {
  async findHotspots(lat, lon, radiusKm = 10) {
    try {
      // RPC to find clusters of events or check-ins
      const { data } = await supabase.rpc('find_gruv_hotspots', {
        user_lat: lat, user_lon: lon, radius_m: radiusKm * 1000
      });
      return data || [];
    } catch { return []; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL & AURA ENGINE (Gamification)
// ─────────────────────────────────────────────────────────────────────────────
export const LevelManager = {
  XP_MAP: {
    EVENT_POST: 100,
    RSVP: 20,
    CHECK_IN: 50,
    VIBE_GIVEN: 10,
    BOOKING_COMPLETE: 200,
  },

  calculateLevel(xp) {
    // Level = floor(sqrt(xp / 100)) + 1
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  },

  async addXP(userId, action) {
    const amount = this.XP_MAP[action] || 10;
    try {
      const { data: prof } = await supabase.from('profiles').select('xp').eq('id', userId).single();
      const newXP = (prof?.xp || 0) + amount;
      await supabase.from('profiles').update({ xp: newXP }).eq('id', userId);
      
      const oldLevel = this.calculateLevel(prof?.xp || 0);
      const newLevel = this.calculateLevel(newXP);
      
      if (newLevel > oldLevel) {
        // Trigger Level Up Notification
        _notify(userId, userId, 'level_up', `Reached Level ${newLevel}!`, `You've unlocked new aura colors.`).catch(() => {});
      }
      return { xp: newXP, level: newLevel, leveledUp: newLevel > oldLevel };
    } catch { return null; }
  }
};

export const AuraService = {
  AURA_MAP: {
    'Music': '#00f2ff', // Cyan
    'Art': '#8b5cf6',   // Purple
    'Tech': '#06b6d4',  // Teal
    'Fashion': '#ec4899', // Pink
    'Nightlife': '#ef4444', // Red
    'Business': '#10b981', // Green
  },

  getAura(interests = []) {
    const primary = interests[0] || 'Social';
    return this.AURA_MAP[primary] || '#00f2ff';
  },

  getAuraGradients(interests = []) {
    const c1 = this.getAura(interests);
    const c2 = this.getAura(interests.slice(1)) || `${c1}50`;
    return [c1, c2];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RETENTION & STREAKS (Advanced User Logic)
// ─────────────────────────────────────────────────────────────────────────────
export const RetentionManager = {
  async logSession(userId) {
    if (!userId) return;
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const { data: prof } = await supabase.from('profiles').select('last_seen, streak_count').eq('id', userId).single();
      if (prof) {
        const last = prof.last_seen ? new Date(prof.last_seen).toISOString().split('T')[0] : null;
        let newStreak = prof.streak_count || 0;
        
        if (last !== today) {
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const yestStr = yesterday.toISOString().split('T')[0];
          
          if (last === yestStr) newStreak += 1;
          else newStreak = 1;

          await supabase.from('profiles').update({ 
            last_seen: now.toISOString(),
            streak_count: newStreak
          }).eq('id', userId);

          // Check badges on login
          RewardEngine.checkMilestones(userId).catch(() => {});
        }
      }
    } catch {}
  },

  async getGlobalStats() {
    const cacheKey = 'global_stats';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const [u, e, v] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }),
      ]);
      const res = { users: u.count, events: e.count, vibes: v.count };
      cache.set(cacheKey, res, 300_000);
      return res;
    } catch { return { users: 0, events: 0, vibes: 0 }; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REWARDS & BADGE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export const RewardEngine = {
  BADGES: [
    { id: 'vibe_starter',  name: 'Vibe Starter', icon: '🔥', desc: 'First 5 vibes given' },
    { id: 'gruv_master',   name: 'Gruv Master',  icon: '👑', desc: 'Hosted 10+ events' },
    { id: 'loyal_viber',   name: 'Loyal Viber',  icon: '💎', desc: '7-day login streak' },
    { id: 'social_elite',  name: 'Social Elite', icon: '✨', desc: 'SIS score of 100' },
  ],

  async checkMilestones(userId) {
    try {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!prof) return [];
      
      const earned = prof.badges || [];
      const newBadges = [];

      if (!earned.includes('loyal_viber') && (prof.streak_count || 0) >= 7) newBadges.push('loyal_viber');
      if (!earned.includes('social_elite') && (prof.social_integrity_score || 0) >= 100) newBadges.push('social_elite');
      
      if (newBadges.length > 0) {
        const updated = [...earned, ...newBadges];
        await supabase.from('profiles').update({ badges: updated }).eq('id', userId);
        return newBadges;
      }
      return [];
    } catch { return []; }
  }
};
