import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { SEED_STORIES, SEED_NOTIFICATIONS } from '../social';
import { MOCK_EVENTS } from '../mockEvents';
import { supabase } from '../supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export const useStore = create(
  persist(
    (set, get) => ({
      // Auth state
      user: null,
      setUser: (user) => set({ user }),

  // Feed/Post State
  posts: [],
  loading: false,
  error: null,
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  activeCategory: 'All',
  setActiveCategory: (c) => set({ activeCategory: c }),
  customCategories: [],
  addCustomCategory: (c) => set((state) => ({ customCategories: [...state.customCategories, c] })),

  // Telemetry Log / Interaction Inventory
  interactionMetrics: [],
  logInteraction: (type, eventId, duration) => {
    console.log(`[TELEMETRY] Logged ${type} on ${eventId} for ${duration}ms`);
    set({ interactionMetrics: [...get().interactionMetrics, { type, eventId, duration, timestamp: Date.now() }] });
  },

  // Supabase Real-Time Engine
  realtimeSubscribed: false,
  subscribeToRealtime: () => {
    if (get().realtimeSubscribed) return;
    if (!supabase) {
      console.warn('[REALTIME] Supabase client not initialized. Realtime disabled.');
      return;
    }
    supabase.channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
        console.log('[REALTIME] Database change detected!', payload);
        get().fetchPosts(); // Trigger zero-latency feed update
      })
      .subscribe();
    set({ realtimeSubscribed: true });
  },

  // Social State
  stories: SEED_STORIES,
  notifications: SEED_NOTIFICATIONS,
  notifVisible: false,
  setNotifVisible: (v) => set({ notifVisible: v }),
  addEventModalVisible: false,
  setAddEventModalVisible: (v) => set({ addEventModalVisible: v }),
  followedUsers: [],
  postReactions: {},
  userReaction: {},
  rsvpState: {},
  savedPosts: [],
  regruvePosts: [],

  // Actions
  fetchPosts: async (coords) => {
    set({ loading: true, error: null });
    try {
      const { searchQuery, activeCategory } = get();
      let url = `${API_URL}?q=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(activeCategory)}`;
      if (coords) url += `&lat=${coords.latitude}&lng=${coords.longitude}&radius=10000`;
      const res = await fetch(url);
      if (res.ok) {
          set({ posts: await res.json() });
      } else {
          set({ posts: [], error: 'Failed to fetch events. Syncing offline mode.' });
      }
    } catch {
      // Fallback for demo
      set({ posts: [], error: 'Network error. The Gruvs is offline.' });
    } finally {
      set({ loading: false });
    }
  },

  handleFollow: (userId) => {
    const prev = get().followedUsers;
    const next = prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId];
    set({ followedUsers: next });
  },

  handleReact: (postId, reactionId) => {
    const { userReaction, postReactions } = get();
    const current = userReaction[postId];
    const next = current === reactionId ? null : reactionId;

    const newPostReactions = { ...postReactions };
    const map = { ...(newPostReactions[postId] || {}) };
    if (current) map[current] = Math.max(0, (map[current] || 1) - 1);
    if (next) map[next] = (map[next] || 0) + 1;
    newPostReactions[postId] = map;

    set({ userReaction: { ...userReaction, [postId]: next }, postReactions: newPostReactions });
  },

  handleRSVP: (postId, status) => {
    const { rsvpState, posts, user } = get();
    const newStatus = rsvpState[postId] === status ? null : status;
    set({ rsvpState: { ...rsvpState, [postId]: newStatus } });

    // Optimistic post update
    const uid = user?.id || 'anon';
    const newPosts = posts.map(p => {
      if (p.id !== postId) return p;
      const rsvps = { ...p.engagement_metrics.rsvps };
      if (newStatus === null) delete rsvps[uid]; else rsvps[uid] = newStatus;
      return { ...p, engagement_metrics: { ...p.engagement_metrics, rsvps } };
    });
    set({ posts: newPosts });
  },

  handleRegruve: (postId) => {
    const { regruvePosts, posts, user } = get();
    if (regruvePosts.includes(postId)) {
      set({ regruvePosts: regruvePosts.filter(id => id !== postId) });
    } else {
      const original = posts.find(p => p.id === postId);
      if (original) {
        set({
          regruvePosts: [...regruvePosts, postId],
          posts: [{ ...original, id: `rg-${Date.now()}`, regruvedBy: user?.name, is_regruve: true }, ...posts]
        });
      }
    }
  },

  handleSave: (postId) => {
    const prev = get().savedPosts;
    const next = prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId];
    set({ savedPosts: next });
  },

  markNotifsRead: () => {
    set({ notifications: get().notifications.map(n => ({ ...n, read: true })) });
  },

  updateStoryViewed: (storyId) => {
    set({ stories: get().stories.map(s => s.id === storyId ? { ...s, viewed: true } : s) });
  },

  handleCommentLike: (postId, commentId) => {
    const { posts, user } = get();
    const newPosts = posts.map(p => {
      if (p.id !== postId) return p;
      const comments = (p.engagement_metrics.comments || []).map(c => {
        if (c.id !== commentId) return c;
        const userId = user?.id || 'anon';
        const likedBy = c.liked_by || [];
        const isLiked = likedBy.includes(userId);
        const newLikedBy = isLiked ? likedBy.filter(id => id !== userId) : [...likedBy, userId];
        return { ...c, liked_by: newLikedBy, likes: newLikedBy.length };
      });
      return { ...p, engagement_metrics: { ...p.engagement_metrics, comments } };
    });
    set({ posts: newPosts });
  },

  handleCommentSubmit: (postId, text, replyToAuthor, replyToCommentId) => {
    const { posts, user } = get();
    const newPosts = posts.map(p => {
      if (p.id !== postId) return p;
      const newComment = { id: Date.now().toString(), author: user?.name || 'You', text, likes: 0, replyCount: 0, replyTo: replyToAuthor, parentId: replyToCommentId, liked_by: [] };
      return {
        ...p,
        engagement_metrics: {
          ...p.engagement_metrics,
          comments: [...(p.engagement_metrics.comments || []), newComment]
        }
      };
    });
    set({ posts: newPosts });
  },

  setPosts: (updater) => {
    set({ posts: typeof updater === 'function' ? updater(get().posts) : updater });
  }

    }),
    {
      name: 'the-gruvs-storage', // name of the item in the storage
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user, interactionMetrics: state.interactionMetrics }), // Persist only key state
    }
  )
);
