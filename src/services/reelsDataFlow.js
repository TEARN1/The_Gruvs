/**
 * reelsDataFlow.js
 * Comprehensive advanced Reels dataflow engine implementing the following design patterns:
 * 1. Singleton Pattern: Single point of truth for global reels cache and preferences.
 * 2. Repository Pattern (ReelsRepository): Unified database interfacing with automated retries and resilience.
 * 3. Observer Pattern (ReelsObserverRegistry): Pub-Sub mechanism for syncing likes, comments, edits, and follows.
 * 4. State Machine Pattern (ReelPlayerStateMachine): Context-driven state engine managing playback modes and viewer settings.
 * 5. Batch Queue Buffer Pattern (ViewBatchQueue): Buffers view count updates to flush in chunks, optimizing database performance.
 * 6. Resilient fetch: real data only — on failure it re-throws so the screen shows
 *    its error/retry state. Reels are NEVER fabricated (no mock/sample content).
 */

import { supabase } from './supabase';
import { resilient } from '../utils/resilience';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── 1. OBSERVER REGISTRY PATTERN ─────────────────────────────────────────────
class ObserverRegistry {
  constructor() {
    this.observers = new Map();
  }

  subscribe(eventType, callback) {
    if (!this.observers.has(eventType)) {
      this.observers.set(eventType, new Set());
    }
    this.observers.get(eventType).add(callback);
    return () => this.unsubscribe(eventType, callback);
  }

  unsubscribe(eventType, callback) {
    if (this.observers.has(eventType)) {
      this.observers.get(eventType).delete(callback);
    }
  }

  notify(eventType, payload) {
    if (this.observers.has(eventType)) {
      this.observers.get(eventType).forEach(callback => {
        try { callback(payload); } catch (e) { console.error('Observer error:', e); }
      });
    }
  }
}

export const ReelsObservers = new ObserverRegistry();

// ── 3. STATE MACHINE PATTERN (VIEWER PREFERENCES) ────────────────────────────
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0];
export const ASPECT_RATIOS = ['cover', 'contain', 'stretch', 'zoom'];
export const VISUAL_FILTERS = [
  { id: 'none', label: 'Original', style: {} },
  { id: 'greyscale', label: 'Greyscale', style: { filter: 'grayscale(100%)' } },
  { id: 'sepia', label: 'Vintage', style: { filter: 'sepia(80%)' } },
  { id: 'cyberpunk', label: 'Cyber Neon', style: { filter: 'hue-rotate(60deg) saturate(160%) contrast(110%)' } },
  { id: 'vhs', label: 'VHS Grain', style: { filter: 'contrast(125%) saturate(80%)' } },
  { id: 'cool', label: 'Cool Blue', style: { filter: 'hue-rotate(240deg) saturate(120%)' } },
  { id: 'warm', label: 'Sunset Glow', style: { filter: 'hue-rotate(15deg) saturate(140%)' } },
];

class PlayerStateMachine {
  constructor() {
    this.state = {
      speed: 1.0,
      aspectRatio: 'cover',
      zoomLevel: 1.0,
      visualFilter: 'none',
      autoAdvance: false,
      captionScale: 'medium', // 'small' | 'medium' | 'large'
      cleanView: false,
      masterVolume: 1.0,
      audioPreset: 'balanced', // 'balanced' | 'vocals' | 'bass'
      backgroundPlay: false, // keep audio playing when app is minimized / screen locked (YouTube-style)
    };
    this.loadState();
  }

  async loadState() {
    try {
      const saved = await AsyncStorage.getItem('@gruvs_reels_player_state');
      if (saved) {
        this.state = { ...this.state, ...JSON.parse(saved) };
        ReelsObservers.notify('preferences_loaded', this.state);
      }
    } catch {}
  }

  async updatePreference(key, value) {
    this.state[key] = value;
    ReelsObservers.notify('preference_changed', { key, value, state: this.state });
    try {
      await AsyncStorage.setItem('@gruvs_reels_player_state', JSON.stringify(this.state));
    } catch {}
  }

  getPreferences() {
    return { ...this.state };
  }
}

export const ReelsPreferences = new PlayerStateMachine();

// ── 4. REELS REPOSITORY PATTERN ──────────────────────────────────────────────
export const ReelsRepository = {
  /**
   * Fetch reels list with resilient retries, fallback queries, and offline mock fail-safes
   */
  async getReelsFeed({ tab = 'foryou', hashtag = null, userId = null }) {
    // 1. Check offline scenario or network bypass
    const applyOrder = (qb) => {
      if (tab === 'trending') return qb.order('like_count', { ascending: false });
      return qb.order('created_at', { ascending: false });
    };

    let followedIds = [];
    let likedReelIds = [];
    let savedReelIds = [];
    if (userId) {
      try {
        const [followRes, likesRes, savesRes] = await Promise.allSettled([
          supabase.from('follows').select('following_id').eq('follower_id', userId).limit(1000),
          supabase.from('reel_likes').select('reel_id').eq('user_id', userId).limit(1000),
          supabase.from('saved_reels').select('reel_id').eq('user_id', userId).limit(1000),
        ]);
        if (followRes.status === 'fulfilled' && followRes.value.data) {
          followedIds = followRes.value.data.map(r => r.following_id);
        }
        if (likesRes.status === 'fulfilled' && likesRes.value.data) {
          likedReelIds = likesRes.value.data.map(r => r.reel_id);
        }
        if (savesRes.status === 'fulfilled' && savesRes.value.data) {
          savedReelIds = savesRes.value.data.map(r => r.reel_id);
        }
      } catch (err) {
        console.warn('Interactions fetch failed:', err);
      }
    }

    try {
      const rawData = await resilient(
        [
          // Tier 1: Detailed Join
          async () => {
            let qb = supabase.from('reels')
              .select('id, caption, media_url, media_type, like_count, comment_count, view_count, event_id, event_title, user_id, created_at, sound_name, metadata, visibility, profiles:user_id(id, username, avatar_url, vibe_score, is_verified)')
              .eq('is_deleted', false).limit(30);
            if (tab === 'following' && followedIds.length) qb = qb.in('user_id', followedIds);
            if (hashtag) qb = qb.ilike('caption', `%${hashtag}%`);
            qb = applyOrder(qb);
            const { data, error } = await qb;
            if (error) throw error;
            return data || [];
          },
          // Tier 2: keep the author join, drop the newer columns (metadata/
          // visibility). This is the path taken before those columns are
          // migrated — the feed still shows usernames + avatars instead of
          // collapsing to the bare, author-less tier 3.
          async () => {
            let qb = supabase.from('reels')
              .select('id, caption, media_url, media_type, like_count, comment_count, view_count, event_id, event_title, user_id, created_at, sound_name, profiles:user_id(id, username, avatar_url, vibe_score, is_verified)')
              .eq('is_deleted', false).limit(30);
            if (tab === 'following' && followedIds.length) qb = qb.in('user_id', followedIds);
            if (hashtag) qb = qb.ilike('caption', `%${hashtag}%`);
            qb = applyOrder(qb);
            const { data, error } = await qb;
            if (error) throw error;
            return data || [];
          },
          // Tier 3: Basic query
          async () => {
            const { data, error } = await supabase.from('reels')
              .select('id, caption, media_url, media_type, like_count, user_id, created_at')
              .eq('is_deleted', false).order('created_at', { ascending: false }).limit(15);
            if (error) throw error;
            return data || [];
          }
        ],
        { attemptsPerTier: 2, baseMs: 300, label: 'ReelsRepository.getReelsFeed', fallbackValue: null }
      );

      // null === every tier failed (not an empty table). Surface it so the
      // screen shows its retry state instead of a misleading "no reels" empty.
      if (rawData === null) throw new Error('Could not reach the reels service. Pull to retry.');

      // Parse metadata if returned as string
      let parsedData = (rawData || []).map(item => {
        let meta = item.metadata;
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch { meta = {}; }
        }
        return {
          ...item,
          _liked: likedReelIds.includes(item.id),
          _following: followedIds.includes(item.user_id),
          _saved: savedReelIds.includes(item.id),
          metadata: {
            filter: 'none',
            stickers: [],
            trim: { start: 0, end: 60 },
            vibeColor: '#00f2ff',
            vibeIntensity: 70,
            ...meta
          }
        };
      });

      // Filter access visibility on client side as an extra safety measure.
      // A missing visibility (tier 2, before the column is migrated) is treated
      // as public so reels don't vanish for signed-out viewers.
      if (userId) {
        parsedData = parsedData.filter(item => {
          if (item.visibility === 'private' && item.user_id !== userId) return false;
          return true;
        });
      } else {
        parsedData = parsedData.filter(item => item.visibility == null || item.visibility === 'public');
      }

      // Real data only — never fabricate reels. An empty feed shows the
      // "Be the first to post" empty state instead of fake sample content.
      return parsedData;
    } catch (e) {
      console.warn('Reels fetch failed:', e);
      // Re-throw so the screen can show its error/retry state rather than mocks.
      throw e;
    }
  },

  /**
   * Cast a like with optimistic callbacks and server synchronization
   */
  async toggleLike({ reelId, userId, isLiked }) {
    ReelsObservers.notify('reel_liked_changed', { reelId, isLiked });
    
    return resilient(
      isLiked ? [
        () => supabase.from('reel_likes').upsert({ reel_id: reelId, user_id: userId }, { onConflict: 'reel_id,user_id' }),
        () => supabase.from('reel_likes').insert({ reel_id: reelId, user_id: userId }),
        () => supabase.rpc('increment_reel_like', { p_reel_id: reelId, p_user_id: userId }),
      ] : [
        () => supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', userId),
        () => supabase.rpc('decrement_reel_like', { p_reel_id: reelId, p_user_id: userId }),
      ],
      { attemptsPerTier: 2, baseMs: 200, label: 'ReelsRepository.toggleLike', fallbackValue: false }
    );
  },

  /**
   * Save a reel to private bookmarks
   */
  async toggleSave({ reelId, userId, isSaved }) {
    ReelsObservers.notify('reel_saved_changed', { reelId, isSaved });

    return resilient(
      isSaved ? [
        () => supabase.from('saved_reels').upsert({ reel_id: reelId, user_id: userId }, { onConflict: 'reel_id,user_id' }),
        () => supabase.rpc('save_reel', { p_reel_id: reelId, p_user_id: userId }),
      ] : [
        () => supabase.from('saved_reels').delete().eq('reel_id', reelId).eq('user_id', userId),
        () => supabase.rpc('unsave_reel', { p_reel_id: reelId, p_user_id: userId }),
      ],
      { attemptsPerTier: 2, baseMs: 200, label: 'ReelsRepository.toggleSave', fallbackValue: false }
    );
  }
};

// ── 5. BATCH QUEUE ANALYTICS BUFFER PATTERN ──────────────────────────────────
class ViewsBatchQueue {
  constructor() {
    this.queue = new Set();
    this.timer = null;
    this.isFlushing = false;
  }

  queueView(reelId, viewerId) {
    if (!viewerId || String(reelId).startsWith('mock-')) return;
    this.queue.add(JSON.stringify({ reel_id: reelId, viewer_id: viewerId }));
    
    // Start flush timeout if not active
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 10000); // flush every 10 seconds
    }
  }

  async flush() {
    if (this.isFlushing || this.queue.size === 0) return;
    this.isFlushing = true;
    this.timer = null;

    try {
      // Parse inside the guard — a single corrupt entry must never wedge
      // isFlushing=true forever and silently kill all future flushes.
      const items = Array.from(this.queue).map(item => JSON.parse(item));
      this.queue.clear();

      // Direct upsert views
      await resilient([
        async () => {
          const { error } = await supabase.from('reel_views').upsert(items, { onConflict: 'reel_id,viewer_id', ignoreDuplicates: true });
          if (error) throw error;
          return true;
        },
        async () => {
          // Fallback single inserts in case batch fails
          for (const item of items) {
            await supabase.from('reel_views').insert(item);
          }
          return true;
        }
      ], { attemptsPerTier: 2, baseMs: 400, label: 'ViewsBatchQueue.flush', fallbackValue: false });
    } catch (e) {
      console.warn('Batch views upload failed:', e);
    } finally {
      this.isFlushing = false;
    }
  }
}

export const ReelsAnalytics = new ViewsBatchQueue();
