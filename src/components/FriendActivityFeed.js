/**
 * FriendActivityFeed — shows recent social actions from people you follow.
 * Actions: rsvp_going, vibe_sent, check_in, new_reel, new_event.
 * Reads from a `friend_activity` view or falls back to composing from
 * event_rsvps + event_vibes + event_checkins joined with follows.
 * Renders a compact scrollable strip — shown on LandingPage feed header.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActivityFeedManager } from '../services/dataFlow';
import { supabase } from '../services/supabase';

const avatarBg = (u = '') =>
  ["#0891b2", "#7c3aed", "#059669", "#d97706", "#db2777"][(u?.charCodeAt(0) || 0) % 5];

const ACTION_CONFIG = {
  rsvp_going:  { icon: 'check-circle', color: "#10b981", verb: 'is going to' },
  vibe_sent:   { icon: 'zap',          color: "#f59e0b", verb: 'vibed'       },
  check_in:    { icon: 'map-pin',      color: "#8b5cf6", verb: 'checked in at' },
  new_reel:    { icon: 'film',         color: "#06b6d4", verb: 'posted a reel' },
  new_event:   { icon: 'calendar',     color: "#ef4444", verb: 'created'     },
};

const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ActivityCard = ({ item, primary, textColor, muted, surface, onPress }) => {
  const cfg = ACTION_CONFIG[item.action_type] || ACTION_CONFIG.vibe_sent;
  return (
    <TouchableOpacity
      style={[ac.card, { backgroundColor: surface, borderColor: `${cfg.color}25` }]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.82}
    >
      {/* Avatar */}
      <View style={{ position: 'relative' }}>
        {item.actor_avatar
          ? <Image source={{ uri: item.actor_avatar }} style={ac.avatar} />
          : <View style={[ac.avatar, { backgroundColor: avatarBg(item.actor_username), alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>{(item.actor_username || 'V')[0].toUpperCase()}</Text>
            </View>
        }
        <View style={[ac.actionDot, { backgroundColor: cfg.color }]}>
          <Feather name={cfg.icon} size={8} color="#fff" />
        </View>
      </View>

      {/* Text */}
      <View style={ac.text}>
        <Text style={[ac.actor, { color: textColor }]} numberOfLines={1}>@{item.actor_username}</Text>
        <Text style={[ac.verb, { color: muted }]} numberOfLines={1}>
          {cfg.verb} {item.target_title || ''}
        </Text>
        <Text style={[ac.time, { color: muted }]}>{timeAgo(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
};

export const FriendActivityFeed = ({ onPressActivity }) => {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary    || "#00f2ff";
  const surface   = currentTheme?.surface    || "#1a1f21";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const [items, count] = await Promise.all([
        ActivityFeedManager.fetch(user.id, { limit: 20 }),
        ActivityFeedManager.unreadCount(user.id),
      ]);
      setActivities(items);
      setUnread(count);
    } catch {}
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const unsub = ActivityFeedManager.subscribe(user.id, (newItem) => {
      setActivities(prev => [newItem, ...prev].slice(0, 20));
      setUnread(n => n + 1);
    } ,);
    return () => unsub();
  }, [user?.id]);

  const handlePressItem = (item) => {
    ActivityFeedManager.markAllRead(user?.id).catch(() => {});
    setUnread(0);
    onPressActivity?.(item);
  };

  // Legacy path kept as fallback in case activity_feed table doesn't exist yet
  const buildActivities = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      // Get followed user IDs
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .limit(200);
      const ids = (follows || []).map(f => f.following_id);
      if (!ids.length) { setLoading(false); return; }

      const since = new Date(Date.now() - 48 * 3600000).toISOString();

      // Fetch recent RSVPs, vibes, check-ins from followed users in parallel
      const [rsvpRes, vibeRes, checkinRes, reelRes, eventRes] = await Promise.allSettled([
        supabase.from('event_rsvps')
          .select('user_id, event_id, created_at, status, events(title), profiles:user_id(username, avatar_url)')
          .in('user_id', ids).eq('status', 'going').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('event_vibes')
          .select('user_id, event_id, created_at, events(title), profiles:user_id(username, avatar_url)')
          .in('user_id', ids).gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('event_checkins')
          .select('user_id, event_id, created_at, events(title), profiles:user_id(username, avatar_url)')
          .in('user_id', ids).gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('reels')
          .select('user_id, id, created_at, caption, profiles:user_id(username, avatar_url)')
          .in('user_id', ids).gte('created_at', since).order('created_at', { ascending: false }).limit(6),
        supabase.from('events')
          .select('author_id, id, title, created_at, profiles:author_id(username, avatar_url)')
          .in('author_id', ids).gte('created_at', since).order('created_at', { ascending: false }).limit(6),
      ]);

      const items = [];

      const addItems = (res, mapFn) => {
        if (res.status === 'fulfilled' && res.value?.data) {
          res.value.data.forEach(row => { const item = mapFn(row); if (item) items.push(item); });
        }
      };

      addItems(rsvpRes, r => r.profiles ? ({
        id: `rsvp_${r.user_id}_${r.event_id}`,
        action_type: 'rsvp_going',
        actor_username: r.profiles.username,
        actor_avatar: r.profiles.avatar_url,
        target_title: r.events?.title,
        target_id: r.event_id,
        target_type: 'event',
        created_at: r.created_at,
      }) : null);

      addItems(vibeRes, r => r.profiles ? ({
        id: `vibe_${r.user_id}_${r.event_id}`,
        action_type: 'vibe_sent',
        actor_username: r.profiles.username,
        actor_avatar: r.profiles.avatar_url,
        target_title: r.events?.title,
        target_id: r.event_id,
        target_type: 'event',
        created_at: r.created_at,
      }) : null);

      addItems(checkinRes, r => r.profiles ? ({
        id: `checkin_${r.user_id}_${r.event_id}`,
        action_type: 'check_in',
        actor_username: r.profiles.username,
        actor_avatar: r.profiles.avatar_url,
        target_title: r.events?.title,
        target_id: r.event_id,
        target_type: 'event',
        created_at: r.created_at,
      }) : null);

      addItems(reelRes, r => r.profiles ? ({
        id: `reel_${r.user_id}_${r.id}`,
        action_type: 'new_reel',
        actor_username: r.profiles.username,
        actor_avatar: r.profiles.avatar_url,
        target_title: r.caption?.slice(0, 40),
        target_id: r.id,
        target_type: 'reel',
        created_at: r.created_at,
      }) : null);

      addItems(eventRes, r => r.profiles ? ({
        id: `event_${r.author_id}_${r.id}`,
        action_type: 'new_event',
        actor_username: r.profiles.username,
        actor_avatar: r.profiles.avatar_url,
        target_title: r.title,
        target_id: r.id,
        target_type: 'event',
        created_at: r.created_at,
      }) : null);

      // Sort by most recent first, dedupe
      const seen = new Set();
      const deduped = items
        .filter(i => i && !seen.has(i.id) && seen.add(i.id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20);

      setActivities(deduped);
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { buildActivities(); }, [buildActivities]);

  if (loading) return (
    <View style={ac.loadingRow}>
      <ActivityIndicator size="small" color={primary} />
    </View>
  );

  if (!activities.length) return null;

  return (
    <View style={ac.container}>
      <View style={ac.headerRow}>
        <Feather name="activity" size={13} color={primary} />
        <Text style={[ac.headerText, { color: primary }]}>Friend Activity</Text>
        {unread > 0 && (
          <View style={[ac.unreadBadge, { backgroundColor: primary }]}>
            <Text style={ac.unreadText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {activities.map(item => (
          <ActivityCard
            key={item.id}
            item={item}
            primary={primary}
            textColor={textColor}
            muted={muted}
            surface={surface}
            onPress={handlePressItem}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const ac = StyleSheet.create({
  container: { paddingHorizontal: 16, marginBottom: 12 },
  loadingRow: { paddingHorizontal: 16, paddingVertical: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  headerText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  unreadBadge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadText: { color: '#000', fontSize: 9, fontWeight: '900' },
  card: {
    width: 130, borderRadius: 14, borderWidth: 1,
    padding: 10, gap: 6,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  actionDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: "#0d1112",
  },
  text: { gap: 1 },
  actor: { fontSize: 11, fontWeight: '800' },
  verb: { fontSize: 10, lineHeight: 14 },
  time: { fontSize: 9 },
});
