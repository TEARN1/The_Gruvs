import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Animated, Linking, RefreshControl, ScrollView, TextInput,
  Share, Modal, Platform, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { GlassView } from '../components/GlassView';
import { PostEventModal } from '../components/PostEventModal';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { ActivityCenterModal } from '../components/ActivityCenterModal';
import { AuraEffect } from '../components/AuraEffect';
import { MediaViewer } from '../components/MediaViewer';
import { FadeInView } from '../components/FadeInView';
import { BrandLogo } from '../components/BrandLogo';
import { ReactPicker } from '../components/ReactPicker';
import { EchoSection } from '../components/EchoSection';
import { RatingSection } from '../components/RatingSection';
import { EventGallery } from '../components/EventGallery';
import { CrewJourneyPanel } from '../components/CrewJourneyPanel';
import { EventAdminPanel } from '../components/EventAdminPanel';
import { EditEventModal } from '../components/EditEventModal';
import { RSVPConfirmModal } from '../components/RSVPConfirmModal';
import { ReportModal } from '../components/ReportModal';
import { OfflineBanner } from '../components/OfflineBanner';
import { CommunityStatsBar } from '../components/CommunityStatsBar';
import { SearchHistoryBar, saveSearch } from '../components/SearchHistoryBar';
import { DateFilterStrip, dateFilterToRange } from '../components/DateFilterStrip';
import { TonightAlert } from '../components/TonightAlert';
import { HashtagStrip } from '../components/HashtagStrip';
import { useIdentity } from '../context/IdentityContext';
import { PresenceBar } from '../components/PresenceBar';
import { AdFlywheel } from '../components/AdFlywheel';
import { ReturnPathCard } from '../components/ReturnPathCard';
import { PathMapScreen } from './PathMapScreen';
import { EventDetailScreen } from './EventDetailScreen';
import { supabase } from '../services/supabase';
import { VibeManager, BookmarkManager, FollowingFeedManager } from '../services/dataFlow';
import { CATEGORY_CONFIG, CATEGORY_KEYS, getCategoryColor, REACTION_LIST } from '../constants/CategoryConfig';

// ── Skeleton card shown while loading ─────────────────────────────────────────
const AVATAR_COLORS = ['#0891b2','#7c3aed','#dc2626','#059669','#d97706','#db2777'];
const AvatarStack = ({ count, size = 20 }) => {
  if (!count || count === 0) return null;
  const displayCount = Math.min(3, count);
  return (
    <View style={styles.avatarStack}>
      {[...Array(displayCount)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.stackAvatar,
            { width: size, height: size, borderRadius: size / 2, marginLeft: i === 0 ? 0 : -size / 2, borderColor: '#000', backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], alignItems: 'center', justifyContent: 'center' }
          ]}
        >
          <Text style={{ fontSize: size * 0.45, fontWeight: '900', color: '#fff' }}>V</Text>
        </View>
      ))}
      {count > displayCount && (
        <View style={[styles.stackMore, { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, backgroundColor: '#222', borderColor: '#000' }]}>
          <Text style={styles.stackMoreText}>+{count - displayCount}</Text>
        </View>
      )}
    </View>
  );
};

const SkeletonCard = ({ primary }) => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[skStyles.card, { opacity: pulse, borderColor: `${primary}30` }]}>
      <View style={[skStyles.media, { backgroundColor: `${primary}12` }]} />
      <View style={skStyles.body}>
        <View style={[skStyles.avatar, { backgroundColor: `${primary}20` }]} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={[skStyles.line, { width: '70%', backgroundColor: `${primary}25`, height: 14 }]} />
          <View style={[skStyles.line, { width: '45%', backgroundColor: `${primary}15`, height: 10 }]} />
        </View>
      </View>
      <View style={[skStyles.line, { width: '90%', backgroundColor: `${primary}18`, marginHorizontal: 16, marginBottom: 12, height: 12 }]} />
      <View style={[skStyles.line, { width: '75%', backgroundColor: `${primary}10`, marginHorizontal: 16, marginBottom: 20, height: 10 }]} />
    </Animated.View>
  );
};

const skStyles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 20, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  media: { height: 200 },
  body: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  line: { height: 10, borderRadius: 6 },
});

// ── Visitor banner ─────────────────────────────────────────────────────────────
const VisitorBanner = ({ onSignIn, primary, muted }) => (
  <TouchableOpacity
    style={[vb.wrap, { backgroundColor: `${primary}10`, borderColor: `${primary}30` }]}
    onPress={onSignIn}
    activeOpacity={0.8}
  >
    <Feather name="user" size={15} color={primary} />
    <Text style={[vb.text, { color: muted }]}>
      Browsing as guest — <Text style={{ color: primary, fontWeight: '800' }}>sign in</Text> to RSVP, react & post
    </Text>
    <Feather name="chevron-right" size={14} color={`${primary}80`} />
  </TouchableOpacity>
);

const vb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  text: { flex: 1, fontSize: 12, lineHeight: 17 },
});

// ── Trending "See All" full-screen modal ───────────────────────────────────────
const TrendingModal = ({ visible, onClose, trending, primary, bg, textColor, muted, onSelectEvent }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={[tm.overlay, { backgroundColor: `${bg}ee` }]}>
      <View style={[tm.header, { borderBottomColor: `${primary}20` }]}>
        <Text style={[tm.title, { color: textColor }]}>Trending Gruvs</Text>
        <TouchableOpacity onPress={onClose} style={tm.closeBtn}>
          <Feather name="x" size={22} color={textColor} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 10 }}>
        {trending.map((spot, i) => (
          <TouchableOpacity
            key={spot.event_id || i}
            style={[tm.row, { borderColor: `${primary}18` }]}
            onPress={() => { onClose(); onSelectEvent && onSelectEvent(spot); }}
            activeOpacity={0.75}
          >
            <Image
              source={{ uri: spot.image || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300' }}
              style={tm.thumb}
            />
            <View style={{ flex: 1 }}>
              <View style={tm.rankRow}>
                <View style={[tm.rankBadge, { backgroundColor: i < 3 ? `${primary}25` : 'rgba(255,255,255,0.06)' }]}>
                  <Text style={[tm.rankNum, { color: i < 3 ? primary : muted }]}>#{i + 1}</Text>
                </View>
                <Text style={[tm.spotName, { color: textColor }]} numberOfLines={1}>
                  {spot.description || spot.title || 'Trending Gruv'}
                </Text>
              </View>
              <View style={tm.metaRow}>
                <Feather name="zap" size={11} color={primary} />
                <Text style={[tm.metaText, { color: muted }]}>{spot.rsvp_count || spot.going || 0} vibing</Text>
                {spot.address ? (
                  <>
                    <Feather name="map-pin" size={11} color={muted} style={{ marginLeft: 8 }} />
                    <Text style={[tm.metaText, { color: muted }]} numberOfLines={1}>{spot.address}</Text>
                  </>
                ) : null}
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={`${primary}60`} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </Modal>
);

const tm = StyleSheet.create({
  overlay: { flex: 1, marginTop: 80, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: { padding: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10 },
  thumb: { width: 70, height: 70, borderRadius: 12 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rankBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  rankNum: { fontSize: 11, fontWeight: '900' },
  spotName: { fontSize: 14, fontWeight: '800', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
});

// ── Main LandingPage ──────────────────────────────────────────────────────────
export const LandingPage = ({ mode = 'drop', onAuthRequired, targetEvent, onTargetHandled, refreshKey }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const { identityMode, modeConfig } = useIdentity();
  const flatListRef = useRef(null);

  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchTimer = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 10;

  // Modals
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [trendingModalVisible, setTrendingModalVisible] = useState(false);
  const [selectedViber, setSelectedViber] = useState(null);
  const [viberModalVisible, setViberModalVisible] = useState(false);
  const [activityVisible, setActivityVisible] = useState(false);
  const [adminEvent, setAdminEvent] = useState(null);

  // Per-card interaction state
  const [myVibes, setMyVibes] = useState(new Set());
  const [vibeCounts, setVibeCounts] = useState({});
  const [reactions, setReactions] = useState({});
  const [savedEvents, setSavedEvents] = useState(new Set());
  const [isVibing, setIsVibing] = useState({});
  const [openReact, setOpenReact] = useState({});
  const [openEcho, setOpenEcho] = useState({});
  const [openGallery, setOpenGallery] = useState({});
  const [openRate, setOpenRate] = useState({});
  const [reactionFlash, setReactionFlash] = useState({});

  // New feature modals
  const [editEvent, setEditEvent] = useState(null);
  const [rsvpEvent, setRsvpEvent] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [crewRsvpMap, setCrewRsvpMap] = useState({}); // eventId → count of followed users going
  const [dateFilter, setDateFilter] = useState('any');
  const [dateRange, setDateRange] = useState(null);
  const [activeHashtag, setActiveHashtag] = useState(null);
  const [pathMapVisible, setPathMapVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [feedMode, setFeedMode] = useState('all'); // 'all' | 'following'
  const [eventCheckins, setEventCheckins] = useState({}); // eventId → checkins array

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#131a1c';

  // Debounce search — avoids a network hit on every keystroke
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  useEffect(() => {
    loadData(true);
  }, [selectedCat, debouncedQuery, mode, refreshKey, feedMode]);

  useEffect(() => { loadTrending(); }, []);

  // Scroll-to + highlight when arriving from Explore
  useEffect(() => {
    if (!targetEvent || loading || events.length === 0) return;

    const targetId = String(targetEvent.id || targetEvent.event_id || '');
    const idx = events.findIndex(e => String(e.id) === targetId);

    if (idx >= 0) {
      setHighlightedId(events[idx].id);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
      }, 350);
      setTimeout(() => setHighlightedId(null), 3500);
    } else if (targetEvent.category && targetEvent.category !== 'all') {
      setSelectedCat(targetEvent.category);
      toast.show(`Browsing ${targetEvent.category} events`, 'info');
    }

    onTargetHandled?.();
  }, [targetEvent, loading, events.length]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase.channel('public:events')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, payload => {
        const updatedEvent = payload.new;
        setEvents(prev => prev.map(ev => ev.id === updatedEvent.id ? { ...ev, ...updatedEvent } : ev));
        setVibeCounts(prev => ({ ...prev, [updatedEvent.id]: updatedEvent.vibe_count }));
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = useCallback(async (isRefreshing = false) => {
    if (loadingMore || (!hasMore && !isRefreshing)) return;

    if (isRefreshing) {
      setPage(0);
      setHasMore(true);
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const currentPage = isRefreshing ? 0 : page;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    try {
      // Auto-expire: only show events from today onwards (or without a date)
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      let newEvents = [];

      if (feedMode === 'following' && user) {
        newEvents = await FollowingFeedManager.fetch(user.id, currentPage, PAGE_SIZE);
        if (selectedCat && selectedCat !== 'all') newEvents = newEvents.filter(e => e.category === selectedCat);
        if (debouncedQuery.trim()) {
          const q = debouncedQuery.toLowerCase();
          newEvents = newEvents.filter(e =>
            (e.title || '').toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q) ||
            (e.venue_name || '').toLowerCase().includes(q)
          );
        }
      } else {
        let q = supabase
          .from('events')
          .select('*, profiles(username, avatar_url, is_verified, is_online, vibe_score)')
          .order(mode === 'explore' ? 'vibe_count' : 'created_at', { ascending: false })
          .or(`event_date.is.null,event_date.gte.${yesterday}`);

        if (selectedCat && selectedCat !== 'all') q = q.eq('category', selectedCat);
        if (debouncedQuery.trim()) {
          const s = `%${debouncedQuery.trim()}%`;
          q = q.or(`title.ilike.${s},description.ilike.${s},category.ilike.${s},venue_name.ilike.${s},city.ilike.${s}`);
        }

        const { data, error } = await q.range(start, end);
        if (error) throw error;
        newEvents = data || [];
      }

      if (isRefreshing) {
        setEvents(newEvents);
        setHasMore(newEvents.length === PAGE_SIZE);
      } else {
        setEvents(prev => [...prev, ...newEvents]);
        setHasMore(newEvents.length === PAGE_SIZE);
      }

      const counts = {};
      [...(isRefreshing ? [] : events), ...newEvents].forEach(e => {
        counts[e.id] = e.vibe_count || 0;
      });
      setVibeCounts(prev => ({ ...prev, ...counts }));

      if (!isRefreshing) setPage(prev => prev + 1);

    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [selectedCat, debouncedQuery, mode, page, hasMore, loadingMore, events, feedMode, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      loadData(false);
    }
  };

  const loadTrending = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('find_popular_spots', { limit_count: 8 });
      setTrending(data || []);
      // Also add trending events to the main feed if not already present
      if (data && data.length > 0) {
        setEvents(prev => {
          const newTrending = data.filter(t => !prev.some(e => e.id === t.event_id));
          if (newTrending.length > 0) {
            return [...newTrending, ...prev];
          }
          return prev;
        });
      }
    } catch {
      setTrending([]);
    }
  }, []);

  // Crew signal — who among followed users has RSVP'd to events in the feed
  useEffect(() => {
    if (!user || events.length === 0) return;
    const loadCrewSignal = async () => {
      try {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .limit(100);
        if (!follows?.length) return;
        const followedIds = follows.map(f => f.following_id);
        const eventIds = events.map(e => e.id);
        const { data: crewRsvps } = await supabase
          .from('event_rsvps')
          .select('event_id, user_id')
          .in('event_id', eventIds)
          .in('user_id', followedIds)
          .eq('status', 'going');
        const map = {};
        (crewRsvps || []).forEach(r => {
          map[r.event_id] = (map[r.event_id] || 0) + 1;
        });
        setCrewRsvpMap(map);
      } catch {}
    };
    loadCrewSignal();
  }, [user, events]);

  // Fetch checkins for event (for ReturnPathCard)
  const fetchEventCheckins = useCallback(async (eventId) => {
    if (!eventId || eventCheckins[eventId]) return; // cached
    try {
      const { data } = await supabase
        .from('checkins')
        .select('*, profiles(username, avatar_url, city, address, home_base)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      setEventCheckins(prev => ({ ...prev, [eventId]: data || [] }));
    } catch (e) {
      console.log('Checkins fetch error:', e.message);
      setEventCheckins(prev => ({ ...prev, [eventId]: [] }));
    }
  }, [eventCheckins]);



  // When a trending spot is tapped — scroll to the matching event in the feed
  const handleTrendingPress = (spot) => {
    const matchTitle = spot.description || spot.title || '';
    const match = events.find(e =>
      e.title?.toLowerCase().includes(matchTitle.toLowerCase().slice(0, 10)) ||
      e.id === spot.event_id
    );
    if (match) {
      const idx = events.indexOf(match);
      setHighlightedId(match.id);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.15 });
      }, 200);
      setTimeout(() => setHighlightedId(null), 3000);
    } else {
      // No match in current feed — filter by category to surface related events
      if (spot.category) setSelectedCat(spot.category);
      toast.show('Showing related events', 'info');
    }
  };

  // ── REMOVED: loadNearby and renderNearby are only used by ExplorePage now ─────

  const handleVibe = async (eventId) => {
    if (!user) { onAuthRequired(); return; }
    if (isVibing[eventId]) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const isCurrentVibed = myVibes.has(eventId);
    
    // Optimistic Update
    setMyVibes(prev => {
      const next = new Set(prev);
      if (isCurrentVibed) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

    // Optimistically update the event count in local state if possible
    setEvents(prev => prev.map(ev => {
      if (ev.id === eventId) {
        return {
          ...ev,
          vibe_count: (ev.vibe_count || 0) + (isCurrentVibed ? -1 : 1)
        };
      }
      return ev;
    }));

    setIsVibing(prev => ({ ...prev, [eventId]: true }));

    try {
      const res = isCurrentVibed
        ? await VibeManager.removeVibe(eventId, user.id)
        : await VibeManager.sendVibe(eventId, user.id);

      if (res === null) {
        // Rollback if failed
        setMyVibes(prev => {
          const next = new Set(prev);
          if (isCurrentVibed) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
        setEvents(prev => prev.map(ev => {
          if (ev.id === eventId) {
            return {
              ...ev,
              vibe_count: (ev.vibe_count || 0) + (isCurrentVibed ? 1 : -1)
            };
          }
          return ev;
        }));
        toast.show(isCurrentVibed ? 'Failed to remove vibe' : 'Failed to send vibe', 'error');
      }
    } catch {
      // Handle error
    } finally {
      setIsVibing(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const REACTION_COLORS = {
    fire: '#f97316', heart: '#ef4444', hype: '#f59e0b', wow: '#8b5cf6',
    laugh: '#facc15', crown: '#fbbf24', gem: '#06b6d4', rocket: '#3b82f6',
    '100': '#10b981', wave: '#0ea5e9', star: '#eab308', magic: '#a78bfa',
    electric: '#00f2ff', goat: '#84cc16', clap: '#fb923c',
  };

  const handleReact = (eventId, key) => {
    if (!user) { onAuthRequired(); return; }
    setReactions(prev => ({ ...prev, [eventId]: prev[eventId] === key ? null : key }));
    setOpenReact(prev => ({ ...prev, [eventId]: false }));
    const r = REACTION_LIST.find(r => r.key === key);
    if (r) {
      toast.show(`Reacted ${r.emoji}`, 'info');
      const flashColor = REACTION_COLORS[key] || primary;
      setReactionFlash(prev => ({ ...prev, [eventId]: flashColor }));
      setTimeout(() => setReactionFlash(prev => { const n = { ...prev }; delete n[eventId]; return n; }), 600);
    }
  };

  const handleBookmark = async (eventId) => {
    if (!user) { onAuthRequired(); return; }

    Haptics.selectionAsync().catch(() => {});

    const isSaved = savedEvents.has(eventId);
    
    // Optimistic Update
    setSavedEvents(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

    try {
      const success = await BookmarkManager.toggle(eventId, user.id, isSaved);
      if (success === isSaved) {
        // If it returns the same state, it failed (BookmarkManager.toggle returns the NEW state)
        // Rollback
        setSavedEvents(prev => {
          const next = new Set(prev);
          if (isSaved) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
        toast.show('Failed to update bookmark', 'error');
      } else {
        toast.show(isSaved ? 'Removed from bookmarks' : 'Added to bookmarks', 'success');
      }
    } catch {
      // Rollback on catch
      setSavedEvents(prev => {
        const next = new Set(prev);
        if (isSaved) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
    }
  };

  const handleShare = (event) => {
    Share.share({ message: `Check out "${event.title}" on The Gruvs — I got you!` }).catch(() => {});
  };

  const openViberProfile = (profile) => {
    if (!profile) return;
    setSelectedViber(profile);
    setViberModalVisible(true);
  };

  // ── HEADER ──────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={[styles.headerWrap, { borderBottomColor: `${primary}20` }]}>
      {/* Main Row: Logo + Search + Actions */}
      <View style={styles.mainRow}>
        <View style={styles.brandGroup}>
          <BrandLogo size={36} showGlow />
          <View style={styles.wordmarkMini}>
            <Text style={[styles.brandText, { color: primary }]}>GRUVS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.brandSub, { color: muted }]}>{mode === 'drop' ? 'DROP' : 'EXPLORE'}</Text>
              {identityMode !== 'public' && (
                <View style={{ backgroundColor: `${modeConfig.color}22`, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                  <Text style={{ color: modeConfig.color, fontSize: 7, fontWeight: '900' }}>{modeConfig.label.toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <GlassView style={styles.compactSearch}>
          <Feather name="search" size={14} color={muted} style={{ marginLeft: 10 }} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search..."
            placeholderTextColor={muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => { if (searchQuery.trim()) saveSearch(searchQuery.trim()); }}
            returnKeyType="search"
          />
        </GlassView>

        <View style={styles.headerActions}>
          {user && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setPathMapVisible(true)}>
              <Feather name="map" size={18} color={primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setActivityVisible(true)}>
            <Feather name="bell" size={18} color={primary} />
            {user && <View style={[styles.bellDot, { backgroundColor: '#ef4444' }]} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.postIconBtn, { backgroundColor: `${primary}15`, borderColor: primary }]}
            onPress={() => user ? setPostModalVisible(true) : onAuthRequired()}
          >
            <Feather name="plus" size={18} color={primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Community stats — live platform numbers for everyone */}
      <CommunityStatsBar />

      {/* Visitor banner — only if no user */}
      {!user && <VisitorBanner onSignIn={onAuthRequired} primary={primary} muted={muted} />}

      {/* Search history chips */}
      <SearchHistoryBar
        currentQuery={searchQuery}
        onSelect={q => { setSearchQuery(q); setDebouncedQuery(q); }}
        primary={primary}
        muted={muted}
      />

      {/* Date filter strip */}
      <DateFilterStrip
        value={dateFilter}
        onChange={(val, range) => { setDateFilter(val); setDateRange(range); }}
        primary={primary}
        muted={muted}
      />

      {/* Trending hashtags */}
      <HashtagStrip
        activeTag={activeHashtag}
        onTagSelect={tag => { setActiveHashtag(tag); if (tag) setSearchQuery(`#${tag}`); else setSearchQuery(''); }}
        primary={primary}
        muted={muted}
      />

      {/* Tonight alert */}
      <TonightAlert
        events={events}
        onPress={ev => {
          const idx = events.findIndex(e => e.id === ev.id);
          if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
        }}
        primary={primary}
      />

      {/* Feed mode toggle — All / Following */}
      {user && (
        <View style={{ flexDirection: 'row', marginHorizontal: 14, marginBottom: 8, gap: 8 }}>
          {[{ key: 'all', label: 'For You', icon: 'home' }, { key: 'following', label: 'Following', icon: 'users' }].map(tab => {
            const active = feedMode === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFeedMode(tab.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: active ? primary : 'rgba(255,255,255,0.06)',
                  borderWidth: 1, borderColor: active ? primary : 'rgba(255,255,255,0.10)',
                }}
              >
                <Feather name={tab.icon} size={12} color={active ? '#000' : textColor} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#000' : textColor }}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catBar}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingBottom: 8 }}
      >
        {CATEGORY_KEYS.map(key => {
          const cfg = CATEGORY_CONFIG[key];
          const isActive = selectedCat === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => startTransition(() => setSelectedCat(isActive ? 'all' : key))}
              style={[styles.pill, {
                backgroundColor: isActive ? cfg.color : 'rgba(255,255,255,0.06)',
                borderColor: isActive ? cfg.color : 'rgba(255,255,255,0.10)',
                borderWidth: 1,
              }]}
            >
              <Text style={{ fontSize: 12 }}>{cfg.icon}</Text>
              <Text style={[styles.pillText, { color: isActive ? '#000' : textColor }]}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── TRENDING ROW ──────────────────────────────────────────────────────────────
  const renderTrending = () => {
    if (!trending.length) return null;
    return (
      <View style={styles.trendingSection}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Trending Now</Text>
          <TouchableOpacity onPress={() => setTrendingModalVisible(true)} activeOpacity={0.7}>
            <Text style={[styles.seeAll, { color: primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
        >
          {trending.slice(0, 6).map((spot, i) => (
            <FadeInView key={spot.event_id || i} delay={i * 60} direction="right">
              <TouchableOpacity
                style={styles.trendCard}
                onPress={() => handleTrendingPress(spot)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: spot.image || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400' }}
                  style={styles.trendImg}
                />
                <View style={[styles.trendOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                {/* Rank badge */}
                <View style={[styles.trendRank, { backgroundColor: i < 3 ? `${primary}cc` : 'rgba(0,0,0,0.55)' }]}>
                  <Text style={[styles.trendRankText, { color: i < 3 ? '#000' : '#fff' }]}>#{i + 1}</Text>
                </View>
                <View style={styles.trendBody}>
                  <Text style={styles.trendName} numberOfLines={2}>
                    {spot.description || spot.title || 'Trending Gruv'}
                  </Text>
                  <View style={styles.trendMetaRow}>
                    <Feather name="zap" size={10} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.trendMeta}>
                      {spot.rsvp_count || spot.going || 0} Vibing
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </FadeInView>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ── FEED HEADER ───────────────────────────────────────────────────────────────
  const renderFeedHeader = () => (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        {mode === 'drop' ? 'Recent Gruvs' : 'All Gruvs'}
      </Text>
      <TouchableOpacity onPress={() => user ? setPostModalVisible(true) : onAuthRequired()}>
        <Text style={[styles.seeAll, { color: primary }]}>Drop a Gruv</Text>
      </TouchableOpacity>
    </View>
  );

  // ── EVENT CARD ────────────────────────────────────────────────────────────────
  const renderCard = ({ item: event, index }) => {
    const id = event.id;
    // Insert AdFlywheel every 5 cards (index 4, 9, 14…)
    const showAd = index > 0 && index % 5 === 4;
    const isVibed   = myVibes.has(id);
    const isSaved   = savedEvents.has(id);
    const isSample  = event.is_sample === true;
    const isOwner   = user && event.user_id === user.id;
    const userReaction = reactions[id] || null;
    const crewCount = crewRsvpMap[id] || 0;
    const isHighlighted = highlightedId === id;
    const catColor  = event.category_color || getCategoryColor(event.category) || primary;
    const title     = event.title || event.description?.split('.')[0] || 'Upcoming Gruv';
    const goingPct  = event.capacity ? Math.min(100, Math.round(((event.going || 0) / event.capacity) * 100)) : 0;

    const getCountdown = (dateStr) => {
      if (!dateStr) return null;
      const diff = new Date(dateStr).getTime() - Date.now();
      if (diff <= 0) return null;
      const days = Math.floor(diff / 86400000);
      const hrs  = Math.floor((diff % 86400000) / 3600000);
      return days > 0 ? `${days}d ${hrs}h` : `${hrs}h away`;
    };
    const countdown = getCountdown(event.event_date);

    const isWeb = Platform.OS === 'web';

    const flashColor = reactionFlash[id];

    return (
      <React.Fragment>
      <FadeInView delay={index * 60} direction="up">
        <View style={[
          styles.eventCard,
          {
            backgroundColor: flashColor ? `${flashColor}12` : surface,
            borderColor: flashColor ? flashColor : isHighlighted ? primary : `${primary}25`,
            borderTopColor: flashColor ? flashColor : isHighlighted ? primary : `${primary}40`,
            borderTopWidth: flashColor ? 2 : 1,
          },
          (isHighlighted || flashColor) && {
            borderWidth: 2,
            ...(isWeb ? { boxShadow: `0 0 25px ${(flashColor || primary)}80` } : { shadowColor: flashColor || primary, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 })
          },
          isWeb && !flashColor && { boxShadow: '0 12px 40px rgba(0,0,0,0.6)' },
          isWeb && flashColor && { transition: 'border-color 0.5s ease, background-color 0.5s ease, box-shadow 0.5s ease' },
        ]}>

          {/* Media */}
          <View style={[styles.imgSection, { backgroundColor: `${catColor}18` }]}>
            <MediaViewer media={event.media && event.media.length > 0 ? event.media : [{ url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800', type: 'image' }]} />
            {/* Scrim for readability */}
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' }} />
            {/* Category badge */}
            {event.category && (
              <View style={[styles.catBadge, { backgroundColor: `${catColor}22`, borderColor: `${catColor}55` }]}>
                <Text style={[styles.catBadgeText, { color: catColor }]}>
                  {(CATEGORY_CONFIG[event.category]?.label || event.category).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Bookmark */}
            <TouchableOpacity
              style={[styles.bookmarkBtn, { backgroundColor: isSaved ? `${primary}40` : 'rgba(0,0,0,0.5)' }]}
              onPress={() => handleBookmark(id)}
            >
              <Feather name="bookmark" size={15} color={isSaved ? primary : '#fff'} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            {/* User row */}
            <View style={styles.userRow}>
              <TouchableOpacity onPress={() => openViberProfile(event.profiles)}>
                <View style={styles.avatarWrap}>
                  {event.profiles?.avatar_url
                    ? <Image source={{ uri: event.profiles.avatar_url }} style={[styles.avatar, { borderColor: primary }]} />
                    : <View style={[styles.avatar, { borderColor: primary, backgroundColor: AVATAR_COLORS[(event.profiles?.username?.charCodeAt(0) || 0) % AVATAR_COLORS.length], alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{(event.profiles?.username || 'V')[0].toUpperCase()}</Text>
                      </View>
                  }
                  {event.profiles?.is_online && <View style={[styles.onlineDot, { backgroundColor: '#10b981' }]} />}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={[styles.username, { color: textColor }]}>
                    {event.profiles?.username || 'Viber'}
                  </Text>
                  {event.profiles?.vibe_score && (
                    <View style={[styles.vibeScoreBadge, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
                      <Feather name="zap" size={8} color={primary} />
                      <Text style={[styles.vibeScoreText, { color: primary }]}>{event.profiles.vibe_score}</Text>
                    </View>
                  )}
                  {event.profiles?.is_verified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: primary }]}>
                      <Feather name="check" size={8} color="#000" />
                    </View>
                  )}
                </View>
                <Text style={[styles.handle, { color: muted }]}>
                  @{(event.profiles?.username || 'viber').toLowerCase().replace(/\s+/g, '')}
                </Text>
              </View>
              <View style={[styles.priceBadge, {
                backgroundColor: (!event.price || event.price === 'FREE' || event.price === 0) ? 'rgba(16,185,129,0.15)' : `${catColor}22`,
                borderColor:     (!event.price || event.price === 'FREE' || event.price === 0) ? '#10b981' : catColor,
              }]}>
                <Text style={[styles.priceText, {
                  color: (!event.price || event.price === 'FREE' || event.price === 0) ? '#10b981' : catColor,
                }]}>
                  {(!event.price || event.price === 0) ? 'FREE' : event.price}
                </Text>
              </View>
            </View>

            {/* Crew signal badge */}
            {crewCount >= 1 && (
              <View style={[styles.crewBadge, { backgroundColor: `${primary}15`, borderColor: `${primary}35` }]}>
                <Feather name="users" size={11} color={primary} />
                <Text style={[styles.crewBadgeText, { color: primary }]}>
                  {crewCount} {crewCount === 1 ? 'person' : 'people'} you follow {crewCount === 1 ? 'is' : 'are'} going
                </Text>
              </View>
            )}

            {/* Title + description — tap to open full detail */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedEvent(event)}>
              <Text style={[styles.eventTitle, { color: textColor }]}>{title}</Text>
              <Text style={[styles.eventDesc, { color: muted }]} numberOfLines={2}>{event.description}</Text>
            </TouchableOpacity>

            {/* Meta row */}
            <View style={styles.metaRow}>
              {event.event_date ? (
                <View style={styles.metaItem}>
                  <Feather name="calendar" size={11} color={muted} />
                  <Text style={[styles.metaText, { color: muted }]}>
                    {new Date(event.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              ) : null}
              {event.event_time ? (
                <View style={styles.metaItem}>
                  <Feather name="clock" size={11} color={muted} />
                  <Text style={[styles.metaText, { color: muted }]}>{event.event_time}</Text>
                </View>
              ) : null}
              {(event.venue_name || event.address) ? (
                <TouchableOpacity
                  style={styles.metaItem}
                  onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(event.address || event.venue_name)}`)}
                >
                  <Feather name="map-pin" size={11} color={primary} />
                  <Text style={[styles.metaText, { color: primary }]} numberOfLines={1}>
                    {event.venue_name || event.address}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Countdown pill */}
            {countdown ? (
              <View style={[styles.countdown, { backgroundColor: `${primary}12`, borderColor: `${primary}28` }]}>
                <Feather name="clock" size={11} color={primary} />
                <Text style={[styles.countdownText, { color: primary }]}>{countdown}</Text>
              </View>
            ) : null}

            {/* RSVP progress bar */}
            {event.capacity > 0 ? (
              <View style={styles.rsvpWrap}>
                <View style={[styles.rsvpTrack, { backgroundColor: `${catColor}15` }]}>
                  <View style={[
                    styles.rsvpFill, 
                    { width: `${goingPct}%`, backgroundColor: catColor },
                    isWeb && { boxShadow: `0 0 10px ${catColor}80` }
                  ]} />
                </View>
                <View style={styles.rsvpLabels}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AvatarStack count={event.going || 0} primary={primary} />
                    <Text style={[styles.rsvpText, { color: textColor }]}>{event.going || 0} going</Text>
                  </View>
                  {event.capacity - (event.going || 0) > 0 && (
                    <Text style={[styles.rsvpText, { color: muted }]}>
                      {event.capacity - (event.going || 0)} spots left
                    </Text>
                  )}
                </View>
              </View>
            ) : null}

            {/* Ticket */}
            {event.ticket_url ? (
              <TouchableOpacity
                style={[styles.ticketBtn, { borderColor: catColor }]}
                onPress={() => Linking.openURL(event.ticket_url)}
              >
                <Feather name="tag" size={13} color={catColor} />
                <Text style={[styles.ticketText, { color: catColor }]}>Get Tickets / RSVP</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Reaction summary */}
          {event.reaction_count > 0 ? (
            <View style={[styles.reactionSummary, { borderTopColor: `${primary}12`, borderBottomColor: `${primary}12` }]}>
              <Text style={styles.reactionEmojis}>{event.reactions_summary || '🔥❤️🙌'}</Text>
              <Text style={[styles.reactionCount, { color: muted }]}>{event.reaction_count} reactions</Text>
            </View>
          ) : null}

          {/* Action bar */}
          <View style={[styles.actionBar, { borderTopColor: `${primary}15` }]}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleVibe(id)}>
              <Feather name="zap" size={19} color={isVibed ? '#ef4444' : muted} />
              <Text style={[styles.actionCount, { color: isVibed ? '#ef4444' : muted }]}>{vibeCounts[id] || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => startTransition(() => setOpenReact(p => ({ ...p, [id]: !p[id] })))}>
              {userReaction
                ? <Text style={{ fontSize: 19 }}>{REACTION_LIST.find(r => r.key === userReaction)?.emoji || '😊'}</Text>
                : <Feather name="smile" size={19} color={muted} />
              }
              <Text style={[styles.actionLabel, { color: userReaction ? primary : muted }]}>React</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => startTransition(() => setOpenEcho(p => ({ ...p, [id]: !p[id] })))}>
              <Feather name="message-circle" size={19} color={openEcho[id] ? primary : muted} />
              <Text style={[styles.actionCount, { color: openEcho[id] ? primary : muted }]}>{event.echo_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => startTransition(() => setOpenGallery(p => ({ ...p, [id]: !p[id] })))}>
              <Feather name="camera" size={19} color={openGallery[id] ? primary : muted} />
              <Text style={[styles.actionLabel, { color: openGallery[id] ? primary : muted }]}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => startTransition(() => setOpenRate(p => ({ ...p, [id]: !p[id] })))}>
              <Feather name="star" size={19} color={openRate[id] ? primary : muted} />
              <Text style={[styles.actionLabel, { color: openRate[id] ? primary : muted }]}>Rate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(event)}>
              <Feather name="share-2" size={19} color={muted} />
              <Text style={[styles.actionLabel, { color: muted }]}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              user ? setRsvpEvent(event) : onAuthRequired();
            }}>
              <Feather name="check-circle" size={19} color={muted} />
              <Text style={[styles.actionLabel, { color: muted }]}>RSVP</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => setReportTarget({ id, type: 'event' })}>
              <Feather name="flag" size={19} color={muted} />
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => setEditEvent(event)}>
                <Feather name="edit-2" size={19} color={primary} />
              </TouchableOpacity>
            )}

            {isOwner && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => setAdminEvent(event)}>
                <Feather name="bar-chart-2" size={19} color={primary} />
                <Text style={[styles.actionLabel, { color: primary }]}>Admin</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Collapsible sections */}
          {openReact[id] && (
            <ReactPicker visible onReact={key => handleReact(id, key)} userReaction={userReaction} />
          )}
          {openEcho[id] && (
            <EchoSection eventId={id} isSample={isSample} onAuthRequired={onAuthRequired} />
          )}
          {openGallery[id] && (
            <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
              <EventGallery eventId={id} />
            </View>
          )}
          {openRate[id] && (
            <RatingSection eventId={id} isSample={isSample} onAuthRequired={onAuthRequired} />
          )}
          {!isSample && (
            <PresenceBar
              eventId={id}
              eventEndTime={event.end_time}
              onAuthRequired={onAuthRequired}
            />
          )}
          {!isSample && (
            <ReturnPathCard
              event={event}
              checkins={eventCheckins[id] || []}
              primary={primary}
              muted={muted}
              textColor={textColor}
              bg={surface}
              onDismiss={() => {}}
              onCheckinsFetch={() => fetchEventCheckins(id)}
            />
          )}
        </View>
      </FadeInView>
      {showAd && (
        <AdFlywheel
          intentTag="attending"
          onNavigateToServices={() => {}}
        />
      )}
      </React.Fragment>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <AuraEffect />

      <FlatList
        ref={flatListRef}
        data={loading ? [] : events}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderTrending()}
            {mode === 'drop' && (
              <CrewJourneyPanel onEventPress={(ev) => {
                const idx = events.findIndex(e => e.id === ev.id);
                if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
              }} />
            )}
            {renderFeedHeader()}
          </>
        }
        renderItem={renderCard}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 8 }}>
              {[1, 2, 3].map(i => <SkeletonCard key={i} primary={primary} />)}
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${primary}12`, borderColor: `${primary}25` }]}>
                <Feather name="compass" size={48} color={primary} />
                <View style={[styles.emptyIconGlow, { backgroundColor: primary }]} />
              </View>
              <Text style={[styles.emptyTitle, { color: textColor }]}>The Kingdom is Quiet</Text>
              <Text style={[styles.emptyText, { color: muted }]}>
                No gruvs found in this sector. Be the one to start the vibe!
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: `${primary}15`, borderColor: primary }]}
                onPress={() => user ? setPostModalVisible(true) : onAuthRequired()}
              >
                <Feather name="plus" size={16} color={primary} />
                <Text style={[styles.emptyBtnText, { color: primary }]}>Drop the first Gruv</Text>
              </TouchableOpacity>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Modals */}
      <PostEventModal
        visible={postModalVisible}
        onClose={() => setPostModalVisible(false)}
        onPostSuccess={loadData}
      />
      <ViberProfileModal
        visible={viberModalVisible}
        user={selectedViber}
        userId={selectedViber?.id}
        onClose={() => setViberModalVisible(false)}
        onNavigateToEvent={(ev) => { setViberModalVisible(false); setSelectedEvent(ev); }}
      />
      <ActivityCenterModal
        visible={activityVisible}
        onClose={() => setActivityVisible(false)}
      />
      <EventAdminPanel
        visible={!!adminEvent}
        onClose={() => setAdminEvent(null)}
        event={adminEvent}
        userId={user?.id}
      />
      <TrendingModal
        visible={trendingModalVisible}
        onClose={() => setTrendingModalVisible(false)}
        trending={trending}
        primary={primary}
        bg={bg}
        textColor={textColor}
        muted={muted}
        onSelectEvent={handleTrendingPress}
      />
      <EditEventModal
        visible={!!editEvent}
        onClose={() => setEditEvent(null)}
        event={editEvent}
        onSaved={() => loadData(true)}
      />
      <RSVPConfirmModal
        visible={!!rsvpEvent}
        onClose={() => setRsvpEvent(null)}
        event={rsvpEvent}
      />
      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.id}
        targetType={reportTarget?.type}
      />
      <OfflineBanner />
      <PathMapScreen visible={pathMapVisible} onClose={() => setPathMapVisible(false)} />
      <EventDetailScreen
        visible={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onAuthRequired={onAuthRequired}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  crewBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 8 },
  crewBadgeText: { fontSize: 11, fontWeight: '700' },
  root: { flex: 1 },

  // Header
  headerWrap: { borderBottomWidth: 1, paddingBottom: 2 },
  mainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10, gap: 10 },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmarkMini: { justifyContent: 'center' },
  brandText: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  brandSub: { fontSize: 7, fontWeight: '800', letterSpacing: 1, marginTop: -1, opacity: 0.6 },
  
  compactSearch: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 18, borderAlpha: 0.1 },
  searchInput: { flex: 1, fontSize: 12, paddingLeft: 6, height: '100%' },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8, borderRadius: 20 },
  postIconBtn: { padding: 6, borderRadius: 12, borderWidth: 1 },
  bellDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#000' },

  // Categories
  catBar: { marginTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  pillText: { fontSize: 9, fontWeight: '800' },

  // Visitor banner
  visitorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  visitorText: { flex: 1, fontSize: 12, lineHeight: 17 },

  // Trending
  trendingSection: { marginBottom: 10, marginTop: 14 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  seeAll: { fontSize: 13, fontWeight: '800' },
  trendCard: { width: 210, height: 130, borderRadius: 18, overflow: 'hidden', position: 'relative' },
  trendImg: { width: '100%', height: '100%' },
  trendOverlay: { ...StyleSheet.absoluteFillObject },
  trendRank: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendRankText: { fontSize: 10, fontWeight: '900' },
  trendBody: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  trendName: { color: '#fff', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  trendMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 10 },

  // Card
  eventCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: 22, overflow: 'hidden', borderWidth: 1 },
  imgSection: { position: 'relative' },
  catBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  catBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  bookmarkBtn: { position: 'absolute', top: 12, right: 12, padding: 8, borderRadius: 20 },
  cardBody: { padding: 14 },

  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5 },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#000' },
  username: { fontSize: 14, fontWeight: '900' },
  vibeScoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  vibeScoreText: { fontSize: 8, fontWeight: '900' },
  handle: { fontSize: 10, opacity: 0.6 },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  priceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  priceText: { fontSize: 11, fontWeight: '900' },

  eventTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8, letterSpacing: -0.3 },
  eventDesc: { fontSize: 14, lineHeight: 22, marginBottom: 14, opacity: 0.85 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },

  countdown: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginBottom: 10 },
  countdownText: { fontSize: 11, fontWeight: '800' },

  rsvpWrap: { marginBottom: 10 },
  rsvpTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  rsvpFill: { height: '100%', borderRadius: 3 },
  rsvpLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rsvpText: { fontSize: 10, fontWeight: '700' },

  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { borderWidth: 1.5 },
  stackMore: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stackMoreText: { fontSize: 7, color: '#fff', fontWeight: '900' },

  ticketBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14, alignSelf: 'flex-start', marginBottom: 4 },
  ticketText: { fontSize: 12, fontWeight: '800' },

  reactionSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1 },
  reactionEmojis: { fontSize: 14 },
  reactionCount: { fontSize: 11 },

  actionBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 13, fontWeight: '800' },
  actionLabel: { fontSize: 10, fontWeight: '700' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative' },
  emptyIconGlow: { position: 'absolute', width: 70, height: 70, borderRadius: 35, opacity: 0.15, shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20, elevation: 10 },
  emptyTitle: { fontSize: 22, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30 },
  emptyBtnText: { fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
});
