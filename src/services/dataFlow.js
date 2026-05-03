/**
 * The Gruvs — Royal Data Flow Engine
 * Smart caching, real-time subscriptions, optimistic updates, pagination.
 */

import { supabase } from './supabase';

// ── In-memory cache ──────────────────────────────────────────────────────────
const CACHE = {};
const CACHE_TTL = 90_000; // 90 seconds

const cache = {
  set(key, value) { CACHE[key] = { value, ts: Date.now() }; },
  get(key) {
    const entry = CACHE[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { delete CACHE[key]; return null; }
    return entry.value;
  },
  invalidate(prefix) {
    Object.keys(CACHE).forEach(k => { if (k.startsWith(prefix)) delete CACHE[k]; });
  },
};

// ── Event Feed with pagination ────────────────────────────────────────────────
export const FeedManager = {
  PAGE_SIZE: 15,

  async fetchPage({ page = 0, category = 'all', query = '', mode = 'drop' } = {}) {
    const cacheKey = `feed:${mode}:${category}:${query}:${page}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      let q = supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, is_online, vibe_score)', { count: 'estimated' })
        .order(mode === 'explore' ? 'vibe_count' : 'created_at', { ascending: false })
        .range(page * FeedManager.PAGE_SIZE, (page + 1) * FeedManager.PAGE_SIZE - 1);

      if (category !== 'all') q = q.eq('category', category);
      if (query.trim()) q = q.ilike('title', `%${query.trim()}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      const result = { events: data || [], total: count || 0, page, hasMore: (data?.length || 0) === FeedManager.PAGE_SIZE };
      cache.set(cacheKey, result);
      return result;
    } catch {
      return { events: [], total: 0, page, hasMore: false };
    }
  },

  async fetchSingle(eventId) {
    const cacheKey = `event:${eventId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, is_online, vibe_score)')
        .eq('id', eventId)
        .single();
      if (data) cache.set(cacheKey, data);
      return data;
    } catch {
      return null;
    }
  },
};

// ── Trending / Hotspots ───────────────────────────────────────────────────────
export const TrendingManager = {
  async fetch(limit = 8) {
    const cacheKey = `trending:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await supabase.rpc('find_popular_spots', { limit_count: limit });
      if (data && data.length > 0) {
        cache.set(cacheKey, data);
        return data;
      }
    } catch {}
    return [];
  },

  // Events happening today or in the next 24h
  async fetchHappeningNow() {
    const cacheKey = 'happening_now';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date().toISOString();
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      const { data } = await supabase
        .from('events')
        .select('*, profiles(username, avatar_url)')
        .gte('event_date', now.split('T')[0])
        .lte('event_date', tomorrow.split('T')[0])
        .order('event_date', { ascending: true })
        .limit(6);
      const result = data || [];
      cache.set(cacheKey, result);
      return result;
    } catch {
      return [];
    }
  },

  // Events by category with counts
  async fetchCategoryCounts() {
    const cacheKey = 'category_counts';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await supabase
        .from('events')
        .select('category')
        .not('category', 'is', null);

      if (!data) return {};
      const counts = {};
      data.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
      cache.set(cacheKey, counts);
      return counts;
    } catch {
      return {};
    }
  },
};

// ── Vibe / Reaction Engine ────────────────────────────────────────────────────
export const VibeManager = {
  async sendVibe(eventId, userId) {
    try {
      const { data } = await supabase.rpc('increment_vibe', { ev_id: eventId, uid: userId });
      cache.invalidate(`event:${eventId}`);
      cache.invalidate('feed:');
      return data;
    } catch {
      return null;
    }
  },

  async removeVibe(eventId, userId) {
    try {
      const { data } = await supabase.rpc('decrement_vibe', { ev_id: eventId, uid: userId });
      cache.invalidate(`event:${eventId}`);
      return data;
    } catch {
      return null;
    }
  },

  async sendReaction(eventId, userId, reactionKey) {
    try {
      await supabase.from('event_reactions').upsert(
        { event_id: eventId, user_id: userId, reaction_key: reactionKey },
        { onConflict: 'event_id,user_id' }
      );
      cache.invalidate(`event:${eventId}`);
      return true;
    } catch {
      return false;
    }
  },

  async getUserReactions(eventIds, userId) {
    if (!userId || !eventIds.length) return {};
    try {
      const { data } = await supabase
        .from('event_reactions')
        .select('event_id, reaction_key')
        .eq('user_id', userId)
        .in('event_id', eventIds);
      const map = {};
      (data || []).forEach(r => { map[r.event_id] = r.reaction_key; });
      return map;
    } catch {
      return {};
    }
  },

  async getUserVibes(eventIds, userId) {
    if (!userId || !eventIds.length) return new Set();
    try {
      const { data } = await supabase
        .from('vibes')
        .select('event_id')
        .eq('user_id', userId)
        .in('event_id', eventIds);
      return new Set((data || []).map(v => v.event_id));
    } catch {
      return new Set();
    }
  },
};

// ── Bookmark / Save Engine ────────────────────────────────────────────────────
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
    } catch {
      return isSaved;
    }
  },

  async getUserSaved(userId) {
    const cacheKey = `saved:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('saved_events')
        .select('event_id')
        .eq('user_id', userId);
      const result = new Set((data || []).map(r => r.event_id));
      cache.set(cacheKey, result);
      return result;
    } catch {
      return new Set();
    }
  },
};

// ── Discovery Engine ──────────────────────────────────────────────────────────
export const DiscoveryManager = {
  async findNobility(userId, radius = 10) {
    const cacheKey = `nearby:${userId}:${radius}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.rpc('find_nearby_vibers', {
        uid: userId, max_dist_km: radius, limit_count: 20,
      });
      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch {
      return [];
    }
  },

  async findNearbyEvents(lat, lon, radiusKm = 25) {
    const cacheKey = `nearby_events:${Math.round(lat * 10)}:${Math.round(lon * 10)}:${radiusKm}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.rpc('find_nearby_events', {
        lat, lon, radius_km: radiusKm, limit_count: 20,
      });
      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch {
      return [];
    }
  },
};

// ── Check-in Engine ───────────────────────────────────────────────────────────
export const CheckInManager = {
  async checkIn(eventId, userId) {
    try {
      await supabase.from('check_ins').insert({ event_id: eventId, user_id: userId });
      const { data: profile } = await supabase.from('profiles').select('vibe_score').eq('id', userId).single();
      await supabase.from('profiles').update({ vibe_score: (profile?.vibe_score || 0) + 10 }).eq('id', userId);
      cache.invalidate(`event:${eventId}`);
      return true;
    } catch {
      return false;
    }
  },
};

// ── Real-time subscriptions ───────────────────────────────────────────────────
export const RealtimeManager = {
  subscriptions: {},

  subscribeToFeed(onInsert, onUpdate) {
    const key = 'feed_realtime';
    if (this.subscriptions[key]) this.unsubscribe(key);

    const channel = supabase
      .channel('events_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, payload => {
        cache.invalidate('feed:');
        onInsert && onInsert(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, payload => {
        cache.invalidate(`event:${payload.new.id}`);
        cache.invalidate('feed:');
        onUpdate && onUpdate(payload.new);
      })
      .subscribe();

    this.subscriptions[key] = channel;
    return () => this.unsubscribe(key);
  },

  subscribeToEvent(eventId, onChange) {
    const key = `event_${eventId}`;
    if (this.subscriptions[key]) this.unsubscribe(key);

    const channel = supabase
      .channel(`event_${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, payload => {
        cache.invalidate(`event:${eventId}`);
        onChange && onChange(payload.new);
      })
      .subscribe();

    this.subscriptions[key] = channel;
    return () => this.unsubscribe(key);
  },

  unsubscribe(key) {
    if (this.subscriptions[key]) {
      supabase.removeChannel(this.subscriptions[key]);
      delete this.subscriptions[key];
    }
  },

  unsubscribeAll() {
    Object.keys(this.subscriptions).forEach(k => this.unsubscribe(k));
  },
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const AnalyticsManager = {
  async getProfileStats(userId) {
    const cacheKey = `profile_stats:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const [events, saves, vibes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('saved_events').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);
      const result = {
        eventCount: events.count || 0,
        savedCount: saves.count || 0,
        vibeCount: vibes.count || 0,
      };
      cache.set(cacheKey, result);
      return result;
    } catch {
      return { eventCount: 0, savedCount: 0, vibeCount: 0 };
    }
  },

  // Weekly activity array [M,T,W,T,F,S,S] of event counts
  async getWeeklyActivity(userId) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data } = await supabase
        .from('events')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', weekAgo);
      const days = [0, 0, 0, 0, 0, 0, 0];
      (data || []).forEach(e => {
        const dow = new Date(e.created_at).getDay();
        days[dow === 0 ? 6 : dow - 1]++;
      });
      return days;
    } catch {
      return [0, 0, 0, 0, 0, 0, 0];
    }
  },
};

// ── Calendar data ─────────────────────────────────────────────────────────────
export const CalendarManager = {
  async fetchMonthEvents(year, month) {
    const cacheKey = `cal:${year}:${month}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

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
    } catch {
      return [];
    }
  },

  async fetchUpcoming(limit = 10) {
    const cacheKey = `upcoming:${limit}`;
    const cached = cache.get(cacheKey);
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
    } catch {
      return [];
    }
  },
};
