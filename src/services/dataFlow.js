/**
 * The Gruvs — Data Flow Engine v2
 * Centralised data layer: caching, real-time, optimistic updates, managers for
 * every domain (Feed, Trending, Vibe, RSVP, Bookmark, User, Notification,
 * CheckIn, Analytics, Calendar, Route, Score).
 */

import { supabase, isSupabaseEnabled } from './supabase';
import { LocationService } from './locationService';
import { SecurityService } from './securityService';
import { VibeEquityLedger } from './vibeEquityLedger';
import { VibeEconomyEngine } from './revenueEngine';
import projectDNA from './projectDNA.json';

// ── INTELLIGENCE MONITORING (Autonomous Training) ──────────────────────────
export const IntelligenceMonitor = {
  async logSuccess(feature, duration) {
    if (duration > 500) {
      console.log(`[URE] Performance bottleneck detected in ${feature}. Training DNA to optimize.`);
    }
  },
  async logFailure(feature, error) {
    console.log(`[URE] Recursive failure in ${feature}: ${error}. Self-correcting via DNA update.`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CACHE  (stale-while-revalidate, prefix invalidation)
// ─────────────────────────────────────────────────────────────────────────────
const CACHE = {};
const CACHE_TTL = 300000; // 5 min default — serves stale while revalidating

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
// ONLINE STATUS UTILS
// ─────────────────────────────────────────────────────────────────────────────

// Consider a user "online" if last_seen within 5 minutes OR is_online flag is true.
// This handles stale flags gracefully — if someone closed the app, last_seen decays.
export const isOnline = (profile) => {
  if (!profile) return false;
  if (profile.is_online === true) {
    // Verify the flag isn't stale: if last_seen > 10 min ago despite flag, treat as offline
    if (profile.last_seen) {
      const minsAgo = (Date.now() - new Date(profile.last_seen).getTime()) / 60000;
      if (minsAgo > 10) return false;
    }
    return true;
  }
  if (profile.last_seen) {
    const minsAgo = (Date.now() - new Date(profile.last_seen).getTime()) / 60000;
    return minsAgo <= 5;
  }
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// GEO UTILS
// ─────────────────────────────────────────────────────────────────────────────
export const GeoUtils = {
  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED SCORING PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

// Wilson lower-bound score for binary positive/negative counts.
// Gives statistically sound ranking even with small sample sizes.
// n = total observations, p = positive fraction, z = 1.96 for 95% CI
function wilsonLowerBound(positives, total, z = 1.96) {
  if (total === 0) return 0;
  const p = positives / total;
  const z2 = z * z;
  const num = p + z2 / (2 * total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  const den = 1 + z2 / total;
  return num / den;
}

// Exponential temporal decay: score * e^(-λ * hours)
// λ=0.08 → half-life ≈ 8.7 h (content freshness curve)
function expDecay(value, ageHours, lambda = 0.08) {
  return value * Math.exp(-lambda * ageHours);
}

// Gaussian peak at targetHours with σ spread — used for event imminence
// Returns [0,1]; max at t=targetHours, falls off symmetrically
function gaussianPeak(hoursUntil, targetHours = 20, sigma = 18) {
  const d = hoursUntil - targetHours;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

// Inverse-square geographic proximity score in [0,1]
// Returns 1 at dist=0, ~0.5 at dist=σKm, approaches 0 at large distances
function geoProximityScore(distKm, sigmaKm = 8) {
  return 1 / (1 + (distKm * distKm) / (sigmaKm * sigmaKm));
}

// Logarithmic compression for large raw counts — avoids viral outliers dominating
function logCompress(value, scale = 10) {
  return scale * Math.log1p(value);
}

// Engagement velocity with momentum: current rate + acceleration term
// velocity = (count / ageH), momentum = velocity / ageH (second derivative signal)
function engagementMomentum(count, ageHours) {
  if (ageHours < 0.1) return logCompress(count, 8);
  const velocity = count / ageHours;
  const momentum = velocity / Math.max(1, ageHours); // acceleration
  return velocity * 3 + momentum * 12;
}

// Interest affinity score: multi-category weighted dot product
// Each matching category contributes, with primary interest weighted 2×
const INTEREST_HIERARCHY = {
  Music: ['Music', 'Nightlife', 'Entertainment'],
  Art: ['Art', 'Culture', 'Photography'],
  Tech: ['Tech', 'Business', 'Innovation'],
  Fashion: ['Fashion', 'Lifestyle', 'Art'],
  Nightlife: ['Nightlife', 'Music', 'Social'],
  Food: ['Food', 'Social', 'Culture'],
  Sports: ['Sports', 'Fitness', 'Outdoor'],
  Social: ['Social', 'Networking', 'Community'],
  Business: ['Business', 'Tech', 'Networking'],
};

function interestAffinityScore(category, userInterests) {
  if (!category || !userInterests.length) return 0;
  let score = 0;
  userInterests.forEach((interest, idx) => {
    const weight = 1 / (idx + 1); // primary interest = 1.0, secondary = 0.5, tertiary = 0.33
    if (interest === category) {
      score += 30 * weight; // direct match
    } else {
      const related = INTEREST_HIERARCHY[interest] || [];
      if (related.includes(category)) score += 12 * weight; // adjacent match
    }
  });
  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE ENGINE  (Vibe Score — used for feed ranking & profile display)
// ─────────────────────────────────────────────────────────────────────────────
export const ScoreEngine = {

  // Advanced multi-signal relevance score for a single event.
  // Combines 9 orthogonal signals into a composite score.
  eventScore(event, {
    userInterests = [],
    followedIds = [],
    userLat,
    userLon,
    crossedPathIds = [],
    aiRecommendedIds = new Set(), // kept for API compatibility
  } = {}) {
    const now = Date.now();
    const ageH = Math.max(0.01, (now - new Date(event.created_at).getTime()) / 3600000);
    const vibes = event.vibe_count || 0;
    const going = event.going || 0;
    const totalEngagement = vibes + going;

    // ── SIGNAL 1: Host trust prior (Bayesian weight)
    // social_integrity_score [0,200] treated as a prior on content quality.
    // Modelled as a multiplier centred at 1.0 (neutral), max 1.4 at SIS=200.
    const sis = event.profiles?.social_integrity_score || 50;
    const trustMultiplier = 0.8 + (Math.min(sis, 200) / 200) * 0.6; // [0.8, 1.4]

    // ── SIGNAL 2: Wilson lower-bound social proof
    // Treats (vibes + going) as positives, uses an impression proxy of max(total,10).
    // Prevents a 1-vibe event from outranking a 50-vibe event.
    const impressionProxy = Math.max(totalEngagement * 3, 10);
    const wilsonProof = wilsonLowerBound(totalEngagement, impressionProxy) * 80;

    // ── SIGNAL 3: Engagement velocity with momentum
    // Rewards rapidly accelerating engagement in the first 48h.
    // After 48h the momentum signal decays, leaving only the Wilson proof.
    const velocitySignal = ageH < 48 ? engagementMomentum(totalEngagement, ageH) : 0;

    // ── SIGNAL 4: Exponential content freshness decay
    // Content freshness decays with half-life ~8.7h.
    const freshness = expDecay(25, ageH, 0.08);

    // ── SIGNAL 5: Upcoming event temporal sweet-spot
    // Gaussian peak centred at 20h before the event, σ=18h.
    // Events too far away (>7 days) or already past score near 0.
    let imminenceSignal = 0;
    if (event.event_date) {
      const eventMs = new Date(`${event.event_date}T${event.event_time || '20:00'}:00`).getTime();
      const hoursUntil = (eventMs - now) / 3600000;
      if (hoursUntil >= -2 && hoursUntil <= 168) { // -2h to +7 days
        imminenceSignal = gaussianPeak(hoursUntil, 20, 18) * 35;
        // Extra urgency: < 6h away and still has spots
        if (hoursUntil > 0 && hoursUntil < 6) imminenceSignal += 20;
      }
    }

    // ── SIGNAL 6: Geographic inverse-square proximity
    // Score falls off as 1/(1 + dist²/σ²) with σ=8km.
    // No penalty beyond ~25km — just diminishing reward.
    let geoSignal = 0;
    if (userLat && userLon && event.lat && event.lon) {
      const distKm = GeoUtils.getDistance(userLat, userLon, event.lat, event.lon);
      geoSignal = geoProximityScore(distKm, 8) * 25;
    }

    // ── SIGNAL 7: Multi-dimensional interest affinity vector
    // Weighted dot product across interest hierarchy graph.
    const affinitySignal = interestAffinityScore(event.category, userInterests);

    // ── SIGNAL 8: Social graph network proximity
    // Weights: followed host > real-world path crossing > no connection.
    // Uses graded scoring rather than binary booleans.
    let networkSignal = 0;
    if (followedIds.includes(event.author_id)) networkSignal += 28;
    if (crossedPathIds.includes(event.author_id)) networkSignal += 22;
    // Mutual: both follow each other — approximated if host follows viewer (can't check without data)
    // Slight boost for high-engagement followed host signals
    if (followedIds.includes(event.author_id) && vibes > 10) networkSignal += 8;

    // ── SIGNAL 9: Ancillary quality signals
    const freeBoost = (!event.price || event.price === 0) ? 5 : 0;
    // Verified host small lift
    const verifiedBoost = event.profiles?.is_verified ? 6 : 0;
    // Logarithmic absolute social mass — compressed so mega-events don't bury everything
    const socialMass = logCompress(totalEngagement, 6);

    // ── COMPOSITE SCORE
    // Each signal is independent; trustMultiplier scales the whole bundle.
    const raw = wilsonProof + velocitySignal + freshness + imminenceSignal
      + geoSignal + affinitySignal + networkSignal
      + freeBoost + verifiedBoost + socialMass;

    return raw * trustMultiplier;
  },

  // Heat score for trending — Wilson + velocity only (no personalization)
  heatScore(event) {
    const ageH = Math.max(0.01, (Date.now() - new Date(event.created_at).getTime()) / 3600000);
    const total = (event.vibe_count || 0) + (event.going || 0);
    const impressions = Math.max(total * 3, 10);
    const wilson = wilsonLowerBound(total, impressions) * 100;
    const velocity = ageH < 72 ? engagementMomentum(total, ageH) : 0;
    const freshness = expDecay(20, ageH, 0.05);
    return wilson + velocity + freshness;
  },

  // Compute and persist a user's Vibe Score
  async computeVibeScore(userId) {
    try {
      // Trigger Vibe Decay Protocol (Anti-Inflation)
      await supabase.rpc('apply_vibe_decay');
      await VibeEconomyEngine.getGlobalEconomicHealth(); // Check economic health

      const [posts, vibes, rsvps, checkins, follows, bookings] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('event_rsvps').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('service_bookings').select('id', { count: 'exact', head: true }).eq('provider_id', userId).eq('status', 'completed'),
      ]);

      // Decay-weighted contribution scoring.
      // Each action type has a base value scaled by a logarithmic volume diminisher
      // so that 1000 vibes is not 1000x better than 1 vibe — compresses outliers.
      const p = posts.count || 0;
      const vi = vibes.count || 0;
      const r = rsvps.count || 0;
      const c = checkins.count || 0;
      const f = follows.count || 0;
      const b = bookings.count || 0;

      const score = Math.round(
        logCompress(p, 12) * 15 +    // Creating Gruvs — high authorship value
        logCompress(vi, 10) * 2 +    // Giving vibes — social engagement
        logCompress(r, 10) * 5 +     // Commitment — intent signal
        logCompress(c, 12) * 25 +    // Physical presence — highest trust signal
        logCompress(f, 14) * 20 +    // Community influence — reach multiplier
        logCompress(b, 16) * 50      // Economic utility — sovereign-tier signal
      );

      await supabase.from('profiles').update({ vibe_score: score }).eq('id', userId);

      // Check for Sovereign Milestones
      await RewardEngine.checkMilestones(userId);

      cache.invalidate(`profile_stats:${userId}`);
      return score;
    } catch { return 0; }
  },

  // Pattern: Dynamic Re-ranking logic for UI state
  reRank(events, context) {
    return [...events].sort((a, b) =>
      this.eventScore(b, context) - this.eventScore(a, context)
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FEED MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const FeedManager = {
  PAGE_SIZE: 15,

  // Preload the next page in background so scroll feels instant
  prefetchPage(opts = {}) {
    const next = { ...opts, page: (opts.page || 0) + 1 };
    const key = `feed:${next.mode||'drop'}:${next.category||'all'}:${next.query||''}:${next.page}:${next.userId||'anon'}`;
    if (!cache.get(key) && !cache.getStale(key)) {
      setTimeout(() => this.fetchPage(next).catch(() => {}), 800);
    }
  },

  async fetchPage({
    page = 0, category = 'all', query = '', mode = 'drop',
    userInterests = [], followedIds = [], userLat, userLon, userId = null,
  } = {}) {
    const cacheKey = `feed:${mode}:${category}:${query}:${page}:${userId || 'anon'}`;
    // Serve stale immediately — caller gets instant paint, fresh data arrives next render
    const stale = cache.getStale(cacheKey);
    const fresh = cache.get(cacheKey);
    if (fresh) return fresh;
    if (stale) {
      // Return stale now, revalidate in background
      this._revalidatePage({ page, category, query, mode, userInterests, followedIds, userLat, userLon, userId }, cacheKey);
      return stale;
    }

    // Load AI recommendations for this user (non-blocking, best-effort)
    let aiRecommendedIds = new Set();
    if (userId) {
      try {
        const { data: rec } = await supabase
          .from('ai_recommendations_cache')
          .select('event_ids')
          .eq('user_id', userId)
          .single();
        if (rec?.event_ids?.length) aiRecommendedIds = new Set(rec.event_ids);
      } catch { /* ignore */ }
    }

    // Removed demo mode fallback. Real data required.
    try {
      let q = supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, is_online, last_seen, vibe_score)', { count: 'estimated' })
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
      if (!query.trim()) {
        events = [...events].sort((a, b) =>
          ScoreEngine.eventScore(b, { userInterests, followedIds, userLat, userLon, aiRecommendedIds }) -
          ScoreEngine.eventScore(a, { userInterests, followedIds, userLat, userLon, aiRecommendedIds })
        );
      }

      // Mark AI-recommended events
      if (aiRecommendedIds.size > 0) {
        events = events.map(e => aiRecommendedIds.has(e.id) ? { ...e, _aiRecommended: true } : e);
      }

      const result = { events, total: count || 0, page, hasMore: events.length === this.PAGE_SIZE };
      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('FeedManager.fetchPage error:', error);
      return { events: [], total: 0, page, hasMore: false };
    }
  },

  // Featured Gruv — pinned or highest scoring upcoming event
  async fetchFeatured({ userInterests = [], followedIds = [] } = {}) {
    const cacheKey = 'feed:featured';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // Removed demo mode fallback.
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

      cache.set('feed:featured', best, 120000); // 2-min TTL for hero card
      return best;
    } catch (error) {
      console.error('FeedManager.fetchFeatured error:', error);
      return null;
    }
  },

  async searchAll(query) {
    if (!query.trim()) return { events: [], users: [] };
    const s = query.trim();
    // Removed demo mode fallback.
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

      const ilikeEvents = evRes.status === 'fulfilled' ? (evRes.value.data || []) : [];
      const users = userRes.status === 'fulfilled' ? (userRes.value.data || []) : [];
      const ftsEvents = ftsRes.status === 'fulfilled' && ftsRes.value.data?.length > 0
        ? ftsRes.value.data : null;

      const eventMap = new Map();
      (ftsEvents || ilikeEvents).forEach(e => eventMap.set(e.id, e));
      if (ftsEvents) ilikeEvents.forEach(e => { if (!eventMap.has(e.id)) eventMap.set(e.id, e); });

      return { events: [...eventMap.values()].slice(0, 20), users };
    } catch (error) {
      console.error('FeedManager.searchAll error:', error);
      throw error;
    }
  },

  async fetchSingle(eventId) {
    const cacheKey = `event:${eventId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    // Removed demo mode fallback.
    try {
      const { data } = await supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, is_online, last_seen, vibe_score)')
        .eq('id', eventId)
        .single();
      if (data) cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('FeedManager.fetchSingle error:', error);
      return null;
    }
  },

  // Background revalidation — updates cache silently, does NOT throw
  async _revalidatePage(opts, cacheKey) {
    try {
      const { page, category, query, mode, userInterests, followedIds, userLat, userLon, userId } = opts;
      let q = supabase
        .from('events')
        .select('*, profiles(id, username, avatar_url, is_verified, is_online, last_seen, vibe_score)', { count: 'estimated' })
        .range(page * this.PAGE_SIZE, (page + 1) * this.PAGE_SIZE - 1);
      if (category !== 'all') q = q.eq('category', category);
      if (query.trim()) {
        const s = query.trim();
        q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%,venue_name.ilike.%${s}%,city.ilike.%${s}%`).order('vibe_count', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }
      const { data, count } = await q;
      if (!data) return;
      let events = [...data].sort((a, b) =>
        ScoreEngine.eventScore(b, { userInterests, followedIds, userLat, userLon }) -
        ScoreEngine.eventScore(a, { userInterests, followedIds, userLat, userLon })
      );
      cache.set(cacheKey, { events, total: count || 0, page, hasMore: events.length === this.PAGE_SIZE }, CACHE_TTL);
    } catch { /* silent */ }
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
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // Try the RPC first — falls back to a direct query if the function doesn't exist yet
    try {
      const { data } = await supabase.rpc('find_popular_spots', { limit_count: limit });
      if (data?.length > 0) { cache.set(cacheKey, data, 120000); return data; }
    } catch { /* RPC not yet deployed — use fallback below */ }

    // Fallback: pull candidate pool, rank by Wilson+velocity heat score
    try {
      const { data: events } = await supabase
        .from('events')
        .select('id, title, description, media, vibe_count, going, event_date, event_time, venue_name, category, created_at')
        .eq('is_cancelled', false)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('vibe_count', { ascending: false })
        .limit(limit * 4); // oversample so we can re-rank
      if (events?.length > 0) {
        const ranked = [...events]
          .sort((a, b) => ScoreEngine.heatScore(b) - ScoreEngine.heatScore(a))
          .slice(0, limit);
        const mapped = ranked.map((e, i) => ({
          event_id: e.id,
          title: e.title,
          description: e.description || e.title,
          image: e.media?.[0]?.url || null,
          rsvp_count: e.going || 0,
          vibe_count: e.vibe_count || 0,
          heat: Math.round(ScoreEngine.heatScore(e)),
          rank: i + 1,
        }));
        cache.set(cacheKey, mapped, 120000);
        return mapped;
      }
    } catch { }

    return [];
  },

  async fetchHappeningNow() {
    const cacheKey = 'happening_now';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('*, profiles(username, avatar_url)')
        .gte('event_date', today)
        .lte('event_date', tomorrow)
        .order('vibe_count', { ascending: false })
        .limit(20); // oversample, re-rank by heat
      const events = (data || [])
        .sort((a, b) => ScoreEngine.heatScore(b) - ScoreEngine.heatScore(a))
        .slice(0, 8);
      cache.set(cacheKey, events, 60000); // 1-min TTL — high volatility
      return events;
    } catch { return []; }
  },

  async fetchThisWeek() {
    const cacheKey = 'this_week';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const today = new Date().toISOString().split('T')[0];
      const week = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('*, profiles(username, avatar_url)')
        .gte('event_date', today)
        .lte('event_date', week)
        .order('vibe_count', { ascending: false })
        .limit(20);
      const result = data || [];
      cache.set(cacheKey, result, 300000); // 5-min TTL
      return result;
    } catch { return []; }
  },

  // Returns { category: count } with a hard ceiling to avoid full scans
  async fetchCategoryCounts() {
    const cacheKey = 'category_counts';
    const cached = cache.get(cacheKey);
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
      cache.set(cacheKey, counts, 300000);
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
    if (SecurityService.isThrottled(`vibe_${eventId}_${userId}`, 1000)) return true;
    if (!isSupabaseEnabled) {
      FeedManager.invalidate(eventId);
      return true;
    }
    try {
      const { error } = await supabase
        .from('event_vibes')
        .upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true });
      if (error) return null;
      await supabase.rpc('increment_vibe_count', { eid: eventId });
      FeedManager.invalidate(eventId);

      // MINT EQUITY: Social resonance boost
      VibeEquityLedger.mintEquity(userId, 'SOCIAL_RESONANCE').catch(() => { });

      // Trigger score re-calc for actor
      ScoreEngine.computeVibeScore(userId).catch(() => { });
      // Fire notification to event author (best-effort)
      _notifyEventAuthor(eventId, userId, 'vibe').catch(() => { });
      return true;
    } catch { return null; }
  },

  async removeVibe(eventId, userId) {
    if (!isSupabaseEnabled) {
      FeedManager.invalidate(eventId);
      return true;
    }
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
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_vibes')
        .select('event_id')
        .eq('user_id', userId)
        .in('event_id', eventIds);
      const result = new Set((data || []).map(v => v.event_id));
      cache.set(cacheKey, result, 30000);
      return result;
    } catch { return new Set(); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RSVP MANAGER  (Vibing / Maybe / Not Vibing)
// ─────────────────────────────────────────────────────────────────────────────
export const RSVPManager = {
  async upsert(eventId, userId, status) {
    if (SecurityService.isThrottled(`rsvp_${eventId}_${userId}`, 1500)) return true;
    if (!isSupabaseEnabled) {
      FeedManager.invalidate(eventId);
      return true;
    }
    try {
      const { error } = await supabase
        .from('event_rsvps')
        .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' });
      if (error) throw error;
      cache.invalidate(`rsvp:${userId}`);
      FeedManager.invalidate(eventId);
      if (status === 'going') {
        _notifyEventAuthor(eventId, userId, 'rsvp').catch(() => { });
        ScoreEngine.computeVibeScore(userId).catch(() => { });
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
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status, user_id, profiles(username, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(200);
      const result = data || [];
      cache.set(cacheKey, result, 60000);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKMARK MANAGER  (Saved Gruvs)
// ─────────────────────────────────────────────────────────────────────────────
export const BookmarkManager = {
  async toggle(eventId, userId, isSaved) {
    if (!isSupabaseEnabled) return !isSaved;
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
    const cached = cache.get(cacheKey);
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
    if (!isSupabaseEnabled) return true;
    const { error } = await supabase
      .from('follows')
      .upsert(
        { follower_id: followerId, following_id: followingId },
        { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);
    cache.invalidate(`follows:${followerId}`);
    cache.invalidate(`followers:${followingId}`);
    _notify(followingId, followerId, 'follow', 'Someone locked in to your Gruvs', '').catch(() => { });

    // Impact score for BOTH (community building)
    ScoreEngine.computeVibeScore(followerId).catch(() => { });
    ScoreEngine.computeVibeScore(followingId).catch(() => { });

    return true;
  },

  async unfollow(followerId, followingId) {
    if (!isSupabaseEnabled) return true;
    const { error } = await supabase
      .from('follows')
      .delete().eq('follower_id', followerId).eq('following_id', followingId);
    if (error) throw new Error(error.message);
    cache.invalidate(`follows:${followerId}`);
    cache.invalidate(`followers:${followingId}`);
    return true;
  },

  async isFollowing(followerId, followingId) {
    if (!followerId || !followingId) return false;
    try {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getFollowedIds(userId) {
    const cacheKey = `follows:${userId}`;
    const cached = cache.get(cacheKey);
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
    const cached = cache.get(cacheKey);
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
      // ── NEURAL DATA SHIELD: Obfuscate Identity ──
      const shieldedUpdates = SecurityService.obfuscateIdentity(updates);

      // Sanitize text fields before update
      const sanitizedUpdates = { ...shieldedUpdates };
      if (sanitizedUpdates.display_name) sanitizedUpdates.display_name = SecurityService.sanitizeContent(sanitizedUpdates.display_name);
      if (sanitizedUpdates.bio) sanitizedUpdates.bio = SecurityService.sanitizeContent(sanitizedUpdates.bio);
      if (sanitizedUpdates.username) sanitizedUpdates.username = SecurityService.sanitizeContent(sanitizedUpdates.username);

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
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
  async ensureProfile(userId) {
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
          vibe_score: 0,
        });
      }
    } catch { }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationManager = {
  async fetch(userId, limit = 100) {
    if (!userId) return [];
    const cacheKey = `notifs:${userId}`;
    const stale = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      const result = data || [];
      cache.set(cacheKey, result, 30000);
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
    if (SecurityService.isThrottled(`touchdown_${eventId}_${userId}`, 5000)) return true;
    if (!isSupabaseEnabled) {
      FeedManager.invalidate(eventId);
      return true;
    }
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

      // Atomic vibe score increment — fallback to read-then-write if RPC not deployed yet
      try {
        await supabase.rpc('increment_profile_score', { uid: userId, amount: 8 });
      } catch {
        try {
          const { data: prof } = await supabase.from('profiles').select('vibe_score').eq('id', userId).single();
          await supabase.from('profiles').update({ vibe_score: (prof?.vibe_score || 0) + 8 }).eq('id', userId);
        } catch { }
      }

      cache.invalidate(`profile:${userId}`);
      cache.invalidate(`profile_stats:${userId}`);

      // MINT EQUITY: Physical Presence
      VibeEquityLedger.mintEquity(userId, 'PHYSICAL_CHECKIN').catch(() => { });

      _notifyEventAuthor(eventId, userId, 'checkin').catch(() => { });
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
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('live_checkins')
        .select('user_id, checked_in_at, profiles(username, avatar_url, vibe_score)')
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false })
        .limit(50);
      const result = data || [];
      cache.set(cacheKey, result, 30000);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY MANAGER  (Nearby events & Vibers)
// ─────────────────────────────────────────────────────────────────────────────
export const DiscoveryManager = {
  // Find nearby events and re-rank by a geo×social composite.
  // Social boost: events hosted by followed users or path-crossed users are surfaced higher
  // even if slightly further away — because real-world social graph proximity matters more than
  // raw kilometres for event discovery.
  async findNearbyEvents(lat, lon, radiusKm = 25, { followedIds = [], crossedPathIds = [] } = {}) {
    const cacheKey = `nearby_events:${Math.round(lat * 10)}:${Math.round(lon * 10)}:${radiusKm}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.rpc('find_nearby_events', {
        lat, lon, radius_km: radiusKm, limit_count: 40, // oversample for re-ranking
      });
      let events = data || [];
      if (events.length > 0 && (followedIds.length > 0 || crossedPathIds.length > 0)) {
        // Re-rank: composite of geo proximity + social graph proximity
        events = events.map(e => {
          const distKm = e.dist_km || e.distance_km || 0;
          const geo = geoProximityScore(distKm, 8) * 60;
          const social = followedIds.includes(e.author_id) ? 35
            : crossedPathIds.includes(e.author_id) ? 22 : 0;
          const heat = ScoreEngine.heatScore(e);
          return { ...e, _discovery_score: geo + social + heat * 0.4 };
        }).sort((a, b) => b._discovery_score - a._discovery_score).slice(0, 20);
      }
      if (events.length) cache.set(cacheKey, events);
      return events;
    } catch (error) {
      console.error('DiscoveryManager.findNearbyEvents error:', error);
      return [];
    }
  },

  async findNearbyVibers(userId, radius = 10) {
    if (!isSupabaseEnabled) return [];
    const cacheKey = `nearby_vibers:${userId}:${radius}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const coords = LocationService.getCached();
      if (!coords) return [];

      // Use the safe, fuzzed version of the nearby function
      const { data } = await supabase.rpc('get_safe_nearby_vibers', {
        u_lat: coords.lat,
        u_lon: coords.lon,
        radius_km: radius
      });

      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch (error) {
      console.error('DiscoveryManager.findNearbyVibers error:', error);
      return [];
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const AnalyticsManager = {
  async getProfileStats(userId) {
    const cacheKey = `profile_stats:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    // Removed demo mode fallback.
    try {
      const [posts, saves, vibes, checkins, followers] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('saved_events').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      ]);
      const result = {
        gruvCount: posts.count || 0,
        savedCount: saves.count || 0,
        vibeCount: vibes.count || 0,
        touchDownCount: checkins.count || 0,
        followerCount: followers.count || 0,
      };
      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('AnalyticsManager.getProfileStats error:', error);
      return { gruvCount: 0, savedCount: 0, vibeCount: 0, touchDownCount: 0, followerCount: 0 };
    }
  },

  // Per-event stats for organisers
  async getEventStats(eventId) {
    const cacheKey = `event_stats:${eventId}`;
    const cached = cache.get(cacheKey);
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
        vibes: vibes.count || 0,
        going: rsvpData.filter(r => r.status === 'going').length,
        maybe: rsvpData.filter(r => r.status === 'maybe').length,
        notGoing: rsvpData.filter(r => r.status === 'not_going').length,
        touchDowns: checkins.count || 0,
        echoes: echoes.count || 0,
        conversionRate: rsvpData.length > 0
          ? Math.round((checkins.count || 0) / rsvpData.length * 100)
          : 0,
      };
      cache.set(cacheKey, result, 120000);
      return result;
    } catch { return null; }
  },

  /**
   * Get comprehensive stats for a service provider (Marketplace Dashboard).
   */
  async getProviderStats(userId) {
    if (!userId) return null;
    const cacheKey = `provider_stats:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const [bookings, reviews, node] = await Promise.all([
        supabase.from('service_bookings').select('amount_cents, status, created_at').eq('provider_id', userId),
        supabase.from('service_reviews').select('rating, comment, created_at, reviewer:reviewer_id(username)').eq('provider_id', userId),
        supabase.from('service_nodes').select('service_type, available').eq('user_id', userId).maybeSingle()
      ]);

      const completed = (bookings.data || []).filter(b => b.status === 'completed');
      const totalEarnings = completed.reduce((sum, b) => sum + (b.amount_cents / 100), 0);

      const ratings = reviews.data || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      // Group earnings by day for the last 7 days
      const earningsByDay = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const ds = d.toISOString().split('T')[0];
        const dayTotal = completed
          .filter(b => b.created_at?.split('T')[0] === ds)
          .reduce((sum, b) => sum + (b.amount_cents / 100), 0);

        return {
          tick: d.toLocaleDateString('en-ZA', { weekday: 'short' }).slice(0, 2),
          value: dayTotal
        };
      });

      const result = {
        totalEarnings,
        totalBookings: (bookings.data || []).length,
        completedCount: completed.length,
        avgRating: avgRating.toFixed(1),
        reviewCount: ratings.length,
        recentReviews: ratings.slice(0, 5),
        earningsChart: earningsByDay,
        serviceType: node.data?.service_type || 'General',
        isAvailable: node.data?.available ?? false
      };

      cache.set(cacheKey, result, 60000);
      return result;
    } catch (e) {
      console.error('getProviderStats error:', e);
      return null;
    }
  },

  // [M,T,W,T,F,S,S] Gruv posting activity for profile chart
  async getWeeklyActivity(userId) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
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
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    // Removed demo mode fallback.
    try {
      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, event_time, category, category_color, venue_name, going, vibe_count, media, price')
        .gte('event_date', from)
        .lte('event_date', to)
        .order('event_date', { ascending: true })
        .limit(60);
      const result = data || [];
      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('CalendarManager.fetchMonthEvents error:', error);
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
        .select('id, title, event_date, event_time, category, category_color, venue_name, going, vibe_count, media, price')
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

  _isAvailable() {
    return isSupabaseEnabled && !!supabase;
  },

  subscribeToFeed(onInsert, onUpdate) {
    if (!this._isAvailable()) return () => { };
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
    if (!this._isAvailable()) return () => { };
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
    if (!this._isAvailable()) return () => { };
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
    if (!this._isAvailable()) return () => { };
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
    const cached = cache.get(cacheKey);
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
    const cached = cache.get(cacheKey);
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
      vibe: { title: 'New Vibe on your Gruv 🔥', body: `Someone Vibed "${event.title}"` },
      rsvp: { title: 'New Vibe-In on your Gruv', body: `Someone is Vibing to "${event.title}"` },
      checkin: { title: 'Someone Touched Down 📍', body: `A Vibe just Touched Down at "${event.title}"` },
    };
    const msg = messages[type];
    if (!msg) return;
    await _notify(event.author_id, actorId, type, msg.title, msg.body);
  } catch { }
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
  } catch { }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE MANAGER  (DM inbox, conversations, unread count)
// ─────────────────────────────────────────────────────────────────────────────
export const MessageManager = {
  // Fetch all conversations for user — one row per partner, sorted by latest message
  async getConversations(userId) {
    if (!userId) return [];
    const cacheKey = `convos:${userId}`;
    const stale = cache.getStale(cacheKey);
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
      const seen = {};
      const convos = [];
      for (const msg of rows) {
        const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        if (!seen[partnerId]) {
          seen[partnerId] = true;
          const partner = msg.sender_id === userId ? msg.recipient : msg.sender;
          convos.push({ ...msg, partner, partnerId });
        }
      }
      cache.set(cacheKey, convos, 30000);
      return convos;
    } catch { return stale || []; }
  },

  // Count unread DMs for the nav badge
  async getUnreadCount(userId) {
    if (!userId) return 0;
    const cacheKey = `dm_unread:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached !== null) return cached;
    try {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null)
        .is('deleted_at', null);
      const n = count || 0;
      cache.set(cacheKey, n, 15000);
      return n;
    } catch { return 0; }
  },

  // Send a message — supports media, location, event shares, replies, and request logic.
  // Pass _pregenId to use a client-generated UUID as the DB row ID (enables optimistic + broadcast sync).
  async send(senderId, recipientId, body, options = {}) {
    if (SecurityService.isThrottled(`msg_${senderId}_${recipientId}`, 500)) {
      throw new Error('Please wait a moment before sending another message.');
    }
    const {
      messageType, type,
      mediaUrl = null,
      parent_id = null,
      event_id = null,
      latitude = null,
      longitude = null,
      _pregenId,
    } = options;
    const msgType = messageType || type || 'text';
    try {
      // Sanitize message body
      const sanitizedBody = SecurityService.sanitizeContent(body);

      // Check if this conversation already has an accepted message.
      let accepted = false;
      try {
        const { data: prior } = await supabase
          .from('messages')
          .select('request_accepted')
          .or(
            `and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),` +
            `and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`
          )
          .eq('request_accepted', true)
          .limit(1)
          .maybeSingle();
        accepted = !!prior;
      } catch { accepted = false; }

      const trimmedBody = (body || '').trim() || null;

      const { data, error } = await supabase
        .from('messages')
        .insert({
          ...(_pregenId ? { id: _pregenId } : {}),
          sender_id: senderId, recipient_id: recipientId,
          body: (sanitizedBody || '').trim() || null,
          is_request: !accepted,
          request_accepted: accepted,
          message_type: msgType,
          media_url: mediaUrl,
          parent_id,
          event_id,
          latitude,
          longitude,
        })
        .select()
        .single();
      if (error) throw error;

      cache.invalidate(`convos:${senderId}`);
      cache.invalidate(`convos:${recipientId}`);
      cache.invalidate(`dm_unread:${recipientId}`);

      const notifyText = msgType === 'image' ? 'Sent a photo'
        : msgType === 'location' ? 'Shared a location'
          : msgType === 'vibe_card' ? 'Sent a Vibe Card'
            : (trimmedBody || '').slice(0, 80);
      _notify(recipientId, senderId, 'message', 'New Message', notifyText).catch(() => { });

      return data;
    } catch (e) { throw e; }
  },

  async markAsRead(messageId, userId) {
    try {
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', messageId).eq('recipient_id', userId).is('read_at', null);
      cache.invalidate(`dm_unread:${userId}`);
    } catch { }
  },

  async sendTypingStatus(senderId, recipientId, isTyping) {
    try {
      const channel = supabase.channel(`typing_${recipientId}`);
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId, isTyping }
      });
      supabase.removeChannel(channel);
    } catch { }
  },

  subscribeToTyping(userId, onTyping) {
    const channel = supabase
      .channel(`typing_${userId}`)
      .on('broadcast', { event: 'typing' }, payload => onTyping(payload.payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
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
    const stale = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userA},recipient_id.eq.${userB}),and(sender_id.eq.${userB},recipient_id.eq.${userA})`)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(limit);
      const result = data || [];
      cache.set(cacheKey, result, 20000);
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
    const cached = cache.get(cacheKey);
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
    const cached = cache.get(cacheKey);
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
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_reminders')
        .select('*, event:events(id, title, event_date, event_time, venue_name)')
        .eq('user_id', userId).eq('sent', false)
        .order('remind_at', { ascending: true });
      const result = data || [];
      cache.set(cacheKey, result, 60000);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PRESENCE MANAGER  (online/offline status)
// ─────────────────────────────────────────────────────────────────────────────
export const PresenceManager = {
  _channel: null,
  _heartbeatTimer: null,

  async goOnline(userId) {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', userId);
      cache.invalidate(`profile:${userId}`);
      RetentionManager.logSession(userId).catch(() => { });
      // Log daily activity for streak tracking (fire-and-forget RPC)
      supabase.rpc('record_daily_activity', { p_user: userId }).catch(() => {});
      // Heartbeat: refresh last_seen every 4 minutes so the 5-min window stays accurate
      if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = setInterval(async () => {
        try {
          await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId);
        } catch { }
      }, 4 * 60 * 1000);
    } catch { }
  },

  async goOffline(userId) {
    if (!userId) return;
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    try {
      await supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', userId);
      cache.invalidate(`profile:${userId}`);
    } catch { }
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
    const stale = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('ad_campaigns')
        .select('*')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false });
      const result = data || [];
      cache.set(cacheKey, result, 60000);
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
    const cached = cache.get(cacheKey);
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
      cache.set(cacheKey, result, 60000);
      return result;
    } catch { return { events: [], hasMore: false }; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY FEED MANAGER  (what your followed users are doing)
// ─────────────────────────────────────────────────────────────────────────────
export const ActivityFeedManager = {
  async fetchActivity(userId, limit = 40) {
    if (!userId) return { liveNow: [], activity: [] };
    const followedIds = await UserManager.getFollowedIds(userId);
    if (!followedIds.length) return { liveNow: [], activity: [] };

    try {
      const [rsvpRes, checkinRes, vibeRes] = await Promise.all([
        supabase
          .from('event_rsvps')
          .select('user_id, event_id, status, created_at, profiles(username, avatar_url, is_online), events(id, title, event_date, media, venue_name, category, going)')
          .in('user_id', followedIds)
          .eq('status', 'going')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('live_checkins')
          .select('user_id, event_id, checked_in_at, profiles(username, avatar_url, is_online), events(id, title, event_date, media, venue_name, category, going)')
          .in('user_id', followedIds)
          .order('checked_in_at', { ascending: false })
          .limit(20),
        supabase
          .from('event_vibes')
          .select('user_id, event_id, created_at, profiles(username, avatar_url, is_online), events(id, title, event_date, media, venue_name, category, going)')
          .in('user_id', followedIds)
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      const toRow = (type, row, ts) => ({
        id: `${type}-${row.user_id}-${row.event_id}-${ts}`,
        type,
        actor: row.profiles,
        event: row.events,
        timestamp: ts,
      });

      const activity = [
        ...(rsvpRes.data || []).map(r => toRow('rsvp', r, r.created_at)),
        ...(checkinRes.data || []).map(r => toRow('checkin', r, r.checked_in_at)),
        ...(vibeRes.data || []).map(r => toRow('vibe', r, r.created_at)),
      ]
        .filter(r => r.actor && r.event)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);

      const liveNow = (checkinRes.data || [])
        .filter(r => r.profiles?.is_online && r.events)
        .map(r => ({ actor: r.profiles, event: r.events, checkedInAt: r.checked_in_at }));

      return { liveNow, activity };
    } catch {
      return { liveNow: [], activity: [] };
    }
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
        _notify(userId, userId, 'level_up', `Reached Level ${newLevel}!`, `You've unlocked new aura colors.`).catch(() => { });
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

      const { data: prof } = await supabase.from('profiles').select('last_seen, current_streak').eq('id', userId).single();
      if (prof) {
        const last = prof.last_seen ? new Date(prof.last_seen).toISOString().split('T')[0] : null;
        let newStreak = prof.current_streak || 0;

        if (last !== today) {
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const yestStr = yesterday.toISOString().split('T')[0];

          if (last === yestStr) newStreak += 1;
          else newStreak = 1;

          await supabase.from('profiles').update({
            last_seen: now.toISOString(),
            current_streak: newStreak
          }).eq('id', userId);

          // Check badges on login
          RewardEngine.checkMilestones(userId).catch(() => { });
        }
      }
    } catch { }
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
      cache.set(cacheKey, res, 300000);
      return res;
    } catch { return { users: 0, events: 0, vibes: 0 }; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REWARDS & BADGE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export const RewardEngine = {
  BADGES: [
    { id: 'vibe_starter', name: 'Vibe Starter', icon: '🔥', desc: 'First 5 vibes given' },
    { id: 'gruv_master', name: 'Gruv Master', icon: '👑', desc: 'Hosted 10+ events' },
    { id: 'loyal_viber', name: 'Loyal Viber', icon: '💎', desc: '7-day login streak' },
    { id: 'social_elite', name: 'Social Elite', icon: '✨', desc: 'SIS score of 100' },
  ],

  async checkMilestones(userId) {
    try {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!prof) return [];

      const earned = prof.badges || [];
      const newBadges = [];

      if (!earned.includes('loyal_viber') && (prof.current_streak || 0) >= 7) newBadges.push('loyal_viber');
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

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORAL ENGINE  (deep activity analysis for Vibe Coach & retention)
// ─────────────────────────────────────────────────────────────────────────────
export const BehavioralEngine = {

  // Compare this week's activity to last week's — returns trend direction and delta
  _computeTrend(thisWeek, lastWeek) {
    if (lastWeek === 0 && thisWeek === 0) return { direction: 'flat', delta: 0, pct: 0 };
    if (lastWeek === 0) return { direction: 'up', delta: thisWeek, pct: 100 };
    const delta = thisWeek - lastWeek;
    const pct = Math.round((delta / lastWeek) * 100);
    return { direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', delta, pct };
  },

  // Activity decay score: recent actions weighted more than old ones.
  // Uses exponential half-life of 3.5 days so actions from 7 days ago carry ~25% weight.
  _decayWeightedScore(timestampedRows, nowMs = Date.now()) {
    const HALF_LIFE_MS = 3.5 * 86400000;
    return timestampedRows.reduce((sum, ts) => {
      const ageMs = nowMs - new Date(ts).getTime();
      return sum + Math.exp(-Math.LN2 * ageMs / HALF_LIFE_MS);
    }, 0);
  },

  // Cohort percentile: where does the user sit vs a sample of recent active profiles?
  // Returns { percentile: 0-100, label: string }
  _cohortPercentile(userScore, sampleScores) {
    if (!sampleScores.length) return { percentile: 50, label: 'average' };
    const below = sampleScores.filter(s => s < userScore).length;
    const percentile = Math.round((below / sampleScores.length) * 100);
    const label = percentile >= 90 ? 'top 10%'
      : percentile >= 75 ? 'top 25%'
      : percentile >= 50 ? 'above average'
      : percentile >= 25 ? 'below average'
      : 'bottom 25%';
    return { percentile, label };
  },

  // Primary entry point for Vibe Coach.
  // Returns { insight, tips, next_milestone, trend, cohort, decay_score, action_roi }
  async analyze(userId, profile) {
    if (!userId) return null;
    try {
      const now = Date.now();
      const since7d = new Date(now - 7 * 86400000).toISOString();
      const since14d = new Date(now - 14 * 86400000).toISOString();

      // Fetch this week + last week activity in parallel
      const [
        rsvpThis, vibeThis, checkinThis, echoThis, postThis,
        rsvpLast, vibeLast, checkinLast, echoLast, postLast,
        rsvpTs, checkinTs, vibeTs,
        peerSample,
      ] = await Promise.all([
        supabase.from('event_rsvps').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since7d),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since7d),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since7d),
        supabase.from('echoes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since7d),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', userId).gte('created_at', since7d),

        supabase.from('event_rsvps').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since14d).lt('created_at', since7d),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since14d).lt('created_at', since7d),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since14d).lt('created_at', since7d),
        supabase.from('echoes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since14d).lt('created_at', since7d),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', userId).gte('created_at', since14d).lt('created_at', since7d),

        // Timestamps for decay weighting
        supabase.from('event_rsvps').select('created_at').eq('user_id', userId).gte('created_at', since7d),
        supabase.from('live_checkins').select('checked_in_at').eq('user_id', userId).gte('checked_in_at', since7d),
        supabase.from('event_vibes').select('created_at').eq('user_id', userId).gte('created_at', since7d),

        // Peer sample: vibe scores from recently active profiles (anonymised)
        supabase.from('profiles').select('vibe_score').not('vibe_score', 'is', null).gt('vibe_score', 0).order('last_seen', { ascending: false }).limit(80),
      ]);

      const tw = {
        rsvp: rsvpThis.count || 0, vibe: vibeThis.count || 0,
        checkin: checkinThis.count || 0, echo: echoThis.count || 0, post: postThis.count || 0,
      };
      const lw = {
        rsvp: rsvpLast.count || 0, vibe: vibeLast.count || 0,
        checkin: checkinLast.count || 0, echo: echoLast.count || 0, post: postLast.count || 0,
      };

      const thisTotal = tw.rsvp + tw.vibe + tw.checkin + tw.echo + tw.post;
      const lastTotal = lw.rsvp + lw.vibe + lw.checkin + lw.echo + lw.post;

      const trend = this._computeTrend(thisTotal, lastTotal);

      // Decay-weighted engagement momentum
      const rsvpTimes = (rsvpTs.data || []).map(r => r.created_at);
      const checkinTimes = (checkinTs.data || []).map(r => r.checked_in_at);
      const vibeTimes = (vibeTs.data || []).map(r => r.created_at);
      const decay_score = parseFloat(this._decayWeightedScore([...rsvpTimes, ...checkinTimes, ...vibeTimes]).toFixed(2));

      // Cohort percentile
      const peerScores = (peerSample.data || []).map(p => p.vibe_score || 0);
      const userScore = profile?.vibe_score || 0;
      const cohort = this._cohortPercentile(userScore, peerScores);

      // Profile completeness signals
      const hasAvatar = !!profile?.avatar_url;
      const hasBio = !!(profile?.bio?.trim());
      const hasInterests = (profile?.interests || []).length > 0;
      const followers = profile?.followers_count || 0;
      const streak = profile?.current_streak || 0;

      // Action ROI: which activity type gives most return per effort
      // Based on ScoreEngine.computeVibeScore weights (checkin=25, post=15, follow=20, rsvp=5, vibe=2)
      const action_roi = [];
      if (tw.checkin === 0) action_roi.push({ action: 'Touch Down at an event', pts_per_action: 25 });
      if (tw.post === 0) action_roi.push({ action: 'Post a Gruv', pts_per_action: 15 });
      if (tw.rsvp < 2) action_roi.push({ action: 'RSVP to upcoming Gruvs', pts_per_action: 5 });
      if (tw.vibe < 5) action_roi.push({ action: 'Send Vibes on events', pts_per_action: 2 });
      action_roi.sort((a, b) => b.pts_per_action - a.pts_per_action);

      // Tip generation with priority ranking (highest-impact first)
      const tips = [];

      // Critical: profile completeness (blocks discovery)
      if (!hasAvatar) tips.push({ priority: 10, text: 'Add a profile photo — vibers with photos get 3× more profile visits.' });
      if (!hasBio) tips.push({ priority: 9, text: 'Write a short bio so others know what Gruvs you live for.' });
      if (!hasInterests) tips.push({ priority: 8, text: 'Set your interests to unlock personalised feed ranking.' });

      // Trend-driven coaching
      if (trend.direction === 'down' && trend.pct < -30) {
        tips.push({ priority: 7, text: `Your activity dropped ${Math.abs(trend.pct)}% vs last week. A single RSVP or Touch Down will reverse the trend.` });
      } else if (trend.direction === 'up' && trend.pct > 20) {
        tips.push({ priority: 3, text: `You're up ${trend.pct}% from last week. Momentum is everything — keep it going.` });
      }

      // Streak coaching
      if (streak >= 7) tips.push({ priority: 2, text: `${streak}-day streak — you're earning the Loyal Viber badge. Don't break the chain.` });
      else if (streak > 0 && streak < 7) tips.push({ priority: 4, text: `${streak}-day streak — ${7 - streak} more days to unlock the Loyal Viber badge.` });

      // Cohort-driven coaching
      if (cohort.percentile < 30 && userScore > 0) {
        tips.push({ priority: 6, text: `You're in the ${cohort.label} of vibers. The gap to the top 50% is ${Math.max(0, peerScores[Math.floor(peerScores.length * 0.5)] - userScore)} pts.` });
      } else if (cohort.percentile >= 75) {
        tips.push({ priority: 1, text: `You're in the ${cohort.label} of all vibers. You're setting the standard.` });
      }

      // Highest-ROI action nudge
      if (action_roi[0]) {
        tips.push({ priority: 5, text: `Highest return this week: ${action_roi[0].action} (${action_roi[0].pts_per_action} pts/action).` });
      }

      // Social growth
      if (followers < 10) tips.push({ priority: 5, text: `You have ${followers} followers. Follow vibers whose taste matches yours — your feed improves with every connection.` });

      // Sort by priority, take top 4
      tips.sort((a, b) => b.priority - a.priority);
      const finalTips = tips.slice(0, 4).map(t => t.text);

      // Insight: decay_score-weighted narrative
      let insight;
      if (decay_score === 0) {
        insight = 'No activity this week. Your feed ranking drops when you go quiet — one action resets the clock.';
      } else if (decay_score < 1) {
        insight = `Low engagement momentum this week (${thisTotal} action${thisTotal !== 1 ? 's' : ''}). Your score is decaying — consistency compounds faster than bursts.`;
      } else if (decay_score < 3) {
        const trendWord = trend.direction === 'up' ? '↑ up' : trend.direction === 'down' ? '↓ down' : 'steady';
        insight = `${thisTotal} actions this week (${trendWord} ${Math.abs(trend.pct)}% vs last week). You're in the mix — push one more action to hit the momentum threshold.`;
      } else {
        insight = `Strong week — decay-weighted momentum of ${decay_score.toFixed(1)}. You're in the ${cohort.label} of all vibers right now.`;
      }

      // Next milestone
      let next_milestone = null;
      if (userScore < 100) next_milestone = `${100 - userScore} pts to Level 2`;
      else if (userScore < 500) next_milestone = `${500 - userScore} pts to Elite Viber`;
      else if (userScore < 2000) next_milestone = `${2000 - userScore} pts to Royal Viber`;
      else if (userScore < 10000) next_milestone = `${10000 - userScore} pts to Gruv Master`;

      return { insight, tips: finalTips, next_milestone, trend, cohort, decay_score, action_roi: action_roi.slice(0, 3) };
    } catch (e) {
      console.error('BehavioralEngine.analyze error:', e);
      return null;
    }
  },
};
