import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { SEED_STORIES, SEED_NOTIFICATIONS } from '../social';
import { MOCK_EVENTS } from '../mockEvents';
import { supabase } from '../supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL =
  Platform.OS === 'web'
    ? (BASE_URL ? `${BASE_URL}/api/events` : '/api/events')
    : (BASE_URL ? `${BASE_URL}/api/events` : '');
const CAN_FETCH_REMOTE_EVENTS = !!API_URL;

export const useStore = create(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      profile: null,
      setProfile: (p) => set({ profile: p }),

      // Real Auth Logic (A to Z fix)
      signUp: async (email, password, metadata) => {
        if (!supabase) {
          set({ error: 'Backend not configured. Using demo mode.' });
          return { success: false, error: 'No backend configured.' };
        }
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: { data: metadata }
          });
          if (error) throw error;
          
          const { error: pErr } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email: email,
            username: metadata.username,
            name: metadata.username,
            gender: metadata.gender,
            interests: metadata.interests || []
          });
          if (pErr) console.warn('[AUTH] Profile sync error:', pErr);
          
          set({ user: data.user });
          return { success: true };
        } catch (err) {
          set({ error: err.message });
          return { success: false, error: err.message };
        } finally {
          set({ loading: false });
        }
      },

      signIn: async (email, password) => {
        if (!supabase) {
          set({ error: 'Backend not configured. Using demo mode.' });
          return { success: false, error: 'No backend configured.' };
        }
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          
          const { data: pData } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          set({ user: data.user, profile: pData });
          return { success: true };
        } catch (err) {
          set({ error: err.message });
          return { success: false, error: err.message };
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        set({ user: null, profile: null });
      },

      syncProfile: async () => {
        const u = get().user;
        if (!u || !supabase) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single();
        if (data) set({ profile: data });
      },

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
  subscribeToRealtime: (chatId) => {
    if (!supabase || !chatId) return () => {};
    const channel = supabase.channel(`chat:${chatId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `conversation_id=eq.${chatId}` 
        }, (payload) => {
            // Update local messages state if needed (or refetch)
            // For simplicity here, we'll let the component handle the refetch or update its own state
            // but we could also merge into a global object.
            console.log('Realtime Msg:', payload.new);
        })
        .subscribe();
    return () => supabase.removeChannel(channel);
  },
  subscribeToEvents: () => {
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
  
  // Pulse Events (User Created)
  pulseEvents: [],
  addPulseEvent: (event) => {
    const newEvent = {
      id: `pulse-${Date.now()}`,
      time: event.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: event.title,
      status: event.status || 'Happening now',
      description: event.description,
      location: event.location,
      media: event.media || [],
      color: event.color || ACCENT,
      createdBy: get().user?.id || 'user',
      createdAt: new Date().toISOString(),
    };
    set({ pulseEvents: [newEvent, ...get().pulseEvents] });
    return newEvent;
  },
  updatePulseEvent: (eventId, updates) => {
    set({ 
      pulseEvents: get().pulseEvents.map(e => e.id === eventId ? { ...e, ...updates } : e) 
    });
  },
  deletePulseEvent: (eventId) => {
    set({ pulseEvents: get().pulseEvents.filter(e => e.id !== eventId) });
  },

  // Actions
  fetchPosts: async (coords) => {
    set({ loading: true, error: null });
    try {
      const { searchQuery, activeCategory } = get();
      
      // Attempt API fetch only when an explicit backend URL is configured.
      let res = null;
      if (CAN_FETCH_REMOTE_EVENTS) {
        let url = `${API_URL}?q=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(activeCategory)}`;
        if (coords) url += `&lat=${coords.latitude}&lng=${coords.longitude}&radius=50000`;

        res = await fetch(url).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          set({ posts: data, error: null });
          return;
        }
      }

      // ─── FALLBACK: RELIABLE DISCOVERY ENGINE (A to Z) ──────────────────
      console.log(
        CAN_FETCH_REMOTE_EVENTS
          ? '[STORE] API unreachable. Switching to Intelligent Fallback Engine.'
          : '[STORE] No API configured. Using Intelligent Fallback Engine.'
      );
      
      let filtered = [...MOCK_EVENTS];

      // 1. Client-side Category Filter
      if (activeCategory !== 'All') {
        filtered = filtered.filter(p => p.category === activeCategory || p.content?.category === activeCategory);
      }

      // 2. Client-side Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
          (p.title || p.content?.title || '').toLowerCase().includes(q) || 
          (p.description || p.content?.text || '').toLowerCase().includes(q)
        );
      }

      // 3. Proximity Scoring (Logic that makes sense)
      if (coords) {
        filtered = filtered.map(p => {
          const lat = p.coords?.lat || 0;
          const lng = p.coords?.lng || 0;
          const dist = Math.sqrt(Math.pow(lat - coords.latitude, 2) + Math.pow(lng - coords.longitude, 2));
          return { ...p, _distance: dist };
        }).sort((a, b) => (a._distance || 0) - (b._distance || 0));
      }

      set({ 
        posts: filtered, 
        error: res ? 'Limited connectivity. Showing saved events.' : 'Offline mode active. Frequency remains stable.' 
      });

    } catch (err) {
      console.error('[FETCH ERROR]', err);
      set({ posts: MOCK_EVENTS.slice(0, 5), error: 'System localized. The Gruvs is resilient.' });
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
