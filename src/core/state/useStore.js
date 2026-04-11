import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SEED_STORIES, SEED_NOTIFICATIONS } from '../social';
import { MOCK_EVENTS } from '../mockEvents';
import { BILLIONAIRE_EVENTS } from '../../services/billionaireSeedData';
import { supabase } from '../../services/supabase';
import { ACCENT } from '../theme';
import Fuse from 'fuse.js';

const ALL_SEED_EVENTS = [...MOCK_EVENTS, ...BILLIONAIRE_EVENTS];

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

      // Theme State
      themeMode: 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),

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

      // Gamification State
      vibePoints: 0,
      vibeLevel: 1,
      addVibePoints: (pts) => {
        const { vibePoints, vibeLevel } = get();
        const newPoints = vibePoints + pts;
        const newLevel = Math.floor(newPoints / 100) + 1;
        if (newLevel > vibeLevel && Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        set({ vibePoints: newPoints, vibeLevel: newLevel });
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
  
  // Pulse Events (Synced with posts array - single source of truth)
  addPulseEvent: async (event) => {
    const { posts, user, addVibePoints } = get();

    // Ensure we map UI fields to DB fields correctly
    const newEventData = {
      author_id: user?.id || null,
      title: event.title,
      description: event.description,
      category: event.category || 'All',
      location: event.location,
      date_time: event.date_time || event.startDate || new Date().toISOString(),
      media: event.media || [],
      pulse_meta: {
        color: event.color || ACCENT,
        status: event.status || 'Happening now',
        createdBy: user?.id || 'user',
        createdAt: new Date().toISOString(),
      }
    };

    // Optimistic Update: Add to local state immediately for perceived speed
    const tempId = `temp-${Date.now()}`;
    const optimisticEvent = {
      ...newEventData,
      id: tempId,
      author_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You',
      engagement_metrics: { likes: 0, comments: [], rsvps: {} }
    };

    set({ posts: [optimisticEvent, ...(posts || [])] });
    addVibePoints(50); // Reward for creating content

    // 1. Persist to Supabase if available
    if (supabase && user && !user.isVisitor) {
      try {
        const { data, error } = await supabase
          .from('events')
          .insert([{
            author_id: user.id,
            title: newEventData.title,
            description: newEventData.description,
            category: newEventData.category,
            location: newEventData.location,
            date_time: newEventData.date_time,
            media: newEventData.media,
          }])
          .select()
          .single();

        if (error) throw error;

        // Replace temp ID with real DB ID
        set((state) => ({
          posts: state.posts.map(p => p.id === tempId ? { ...p, id: data.id } : p)
        }));

        return data;
      } catch (err) {
        console.error('[STORE] DB Insert failed:', err);
        // We keep the optimistic one but mark it as local/failed if needed
      }
    }

    return optimisticEvent;
  },

  // Actions
  fetchPosts: async (coords) => {
    set({ loading: true, error: null });
    try {
      const { searchQuery, activeCategory } = get();

      // ─── STAGE 1: NEXT.JS API (A to Z Priority) ─────────────────────
      // We prioritize the API because it handles sorting, FTS, and Proximity.
      if (CAN_FETCH_REMOTE_EVENTS) {
        console.log(`[STORE] Fetching via API: ${API_URL}`);
        try {
          let url = `${API_URL}?q=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(activeCategory)}`;
          if (coords) url += `&lat=${coords.latitude}&lng=${coords.longitude}&radius=50000`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              set({ posts: data, error: null, loading: false });
              return;
            }
          } else {
            console.warn(`[STORE] API returned status ${res.status}`);
          }
        } catch (apiErr) {
          console.warn('[STORE] API request failed or timed out. Falling back to Supabase Direct.', apiErr.message);
        }
      }

      // ─── STAGE 2: SUPABASE DIRECT ─────────────────────
      // If the API is down/unconfigured, try reaching Supabase directly from the client.
      if (supabase) {
        console.log('[STORE] Attempting direct Supabase fetch...');
        let query = supabase.from('events').select('*, profiles(name, avatar, level, reputation)');

        if (activeCategory !== 'All') {
          query = query.eq('category', activeCategory);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          // Format Supabase data to match app's internal PostCard expectations
          const formattedPosts = data.map(item => ({
            ...item,
            id: item.id,
            author_name: item.profiles?.name || 'Anonymous',
            author_level: item.profiles?.level || 1,
            author_id: item.author_id,
            content: {
              title: item.title,
              text: item.description,
              location: item.location,
              dateTime: item.date_time,
              category: item.category,
              image: item.media?.[0]?.url || null
            },
            engagement_metrics: {
              likes: item.like_count || 0,
              comments: [],
              rsvps: {}
            }
          }));

          set({ posts: formattedPosts, error: null, loading: false });
          return;
        }
      }

      // ─── STAGE 3: FALLBACK ENGINE ─────────────────────
      console.log(
        CAN_FETCH_REMOTE_EVENTS
          ? '[STORE] API unreachable. Switching to Intelligent Fallback Engine.'
          : '[STORE] No API configured. Using Intelligent Fallback Engine.'
      );
      
      let filtered = [...ALL_SEED_EVENTS];

      // 1. Client-side Category Filter
      if (activeCategory !== 'All') {
        filtered = filtered.filter(p => p.category === activeCategory || p.content?.category === activeCategory);
      }

      // 2. Client-side Search filter with Fuzzy Matching (A to Z enhancement)
      if (searchQuery) {
        const fuse = new Fuse(filtered, {
          keys: [
            'title',
            'description',
            'category',
            'location',
            'content.title',
            'content.text',
            'content.category',
            'content.location'
          ],
          threshold: 0.4, // Lower is more strict, 0.4 is a good balance for fuzzy matching
          includeScore: true
        });

        const results = fuse.search(searchQuery);
        filtered = results.map(r => r.item);
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
    const { userReaction, postReactions, addVibePoints } = get();
    const current = userReaction[postId];
    const next = current === reactionId ? null : reactionId;

    const newPostReactions = { ...postReactions };
    const map = { ...(newPostReactions[postId] || {}) };
    if (current) map[current] = Math.max(0, (map[current] || 1) - 1);
    if (next) {
        map[next] = (map[next] || 0) + 1;
        addVibePoints(5); // Reward for reacting
    }

    set({ userReaction: { ...userReaction, [postId]: next }, postReactions: newPostReactions });
  },

  handleRSVP: (postId, status) => {
    const { rsvpState, posts, user, addVibePoints } = get();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isInvited = post.content?.is_invitation_only ? post.content?.invited_users?.includes(user?.id) : true;
    const currentGoing = Object.values(post.engagement_metrics.rsvps || {}).filter(s => s === 'going').length;
    const capacity = post.content?.capacity || Infinity;

    if (status === 'going' && !isInvited) {
      if (Platform.OS !== 'web') Alert.alert('Access Denied', 'This frequency is restricted to invitees only.');
      return;
    }

    let finalStatus = status;
    if (status === 'going' && currentGoing >= capacity) {
      finalStatus = 'waitlist';
      if (Platform.OS !== 'web') Alert.alert('Frequency Full', 'You have been added to the waitlist.');
    }

    const newStatus = rsvpState[postId] === finalStatus ? null : finalStatus;
    if (newStatus) addVibePoints(10); // Reward for RSVPing

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
