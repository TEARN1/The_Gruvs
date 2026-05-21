import React, { useState, useEffect, useCallback, startTransition } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  FlatList, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const TYPE_META = {
  vibe:    { icon: 'zap',            label: 'Vibed',    color: '#f97316' },
  echo:    { icon: 'message-circle', label: 'Echoed',   color: '#8b5cf6' },
  follow:  { icon: 'user-plus',      label: 'Followed', color: '#10b981' },
  rsvp:    { icon: 'check-circle',   label: 'RSVP\'d',  color: '#3b82f6' },
  comment: { icon: 'message-square', label: 'Comment',  color: '#06b6d4' },
  royal:   { icon: 'star',           label: 'Royal',    color: '#f59e0b' },
  rating:  { icon: 'award',          label: 'Rating',   color: '#ec4899' },
};

const FILTERS = ['all', 'vibe', 'echo', 'follow', 'rsvp'];

const formatAge = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};


export const ActivityCenterModal = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (!user) { setActivities([]); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);

    try {
      const { data: myEvents } = await supabase
        .from('events')
        .select('id, title')
        .eq('author_id', user.id)
        .limit(50);

      const eventIds = (myEvents || []).map(e => e.id);
      const eventMap = Object.fromEntries((myEvents || []).map(e => [e.id, e.title]));

      // All queries fire in parallel — partial failures don't block other results
      const queries = [
        supabase.from('follows')
          .select('id, follower_id, created_at, profiles!follows_follower_id_fkey(username, avatar_url)')
          .eq('following_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ];

      if (eventIds.length > 0) {
        queries.push(
          supabase.from('event_vibes')
            .select('id, event_id, user_id, created_at, profiles(username, avatar_url)')
            .in('event_id', eventIds).neq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(30),
          supabase.from('event_rsvps')
            .select('id, event_id, user_id, created_at, profiles(username, avatar_url)')
            .in('event_id', eventIds).neq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(30),
          supabase.from('echoes')
            .select('id, event_id, user_id, body, created_at, profiles(username, avatar_url)')
            .in('event_id', eventIds).neq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(30),
          supabase.from('event_ratings')
            .select('id, event_id, user_id, rating, created_at, profiles(username, avatar_url)')
            .in('event_id', eventIds).neq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(20),
        );
      }

      const settled = await Promise.allSettled(queries);
      const [followsRes, vibesRes, rsvpsRes, echoesRes, ratingsRes] = settled.map(r =>
        r.status === 'fulfilled' ? (r.value.data || []) : []
      );

      const results = [];

      (followsRes || []).forEach(f => results.push({
        id: `follow_${f.id}`, type: 'follow',
        actor: f.profiles?.username || 'Someone',
        actor_avatar: f.profiles?.avatar_url || null,
        content: 'started following you',
        created_at: f.created_at,
      }));

      (vibesRes || []).forEach(v => results.push({
        id: `vibe_${v.id}`, type: 'vibe',
        actor: v.profiles?.username || 'Someone',
        actor_avatar: v.profiles?.avatar_url || null,
        content: `vibed with your event "${eventMap[v.event_id] || 'your event'}"`,
        created_at: v.created_at,
      }));

      (rsvpsRes || []).forEach(r => results.push({
        id: `rsvp_${r.id}`, type: 'rsvp',
        actor: r.profiles?.username || 'Someone',
        actor_avatar: r.profiles?.avatar_url || null,
        content: `RSVP'd to your event "${eventMap[r.event_id] || 'your event'}"`,
        created_at: r.created_at,
      }));

      (echoesRes || []).forEach(e => results.push({
        id: `echo_${e.id}`, type: 'echo',
        actor: e.profiles?.username || 'Someone',
        actor_avatar: e.profiles?.avatar_url || null,
        content: `echoed: "${e.body?.slice(0, 60) || '...'}"`,
        created_at: e.created_at,
      }));

      (ratingsRes || []).forEach(r => {
        const stars = '⭐'.repeat(Math.min(r.rating || 0, 5));
        results.push({
          id: `rating_${r.id}`, type: 'rating',
          actor: r.profiles?.username || 'Someone',
          actor_avatar: r.profiles?.avatar_url || null,
          content: `rated "${eventMap[r.event_id] || 'your event'}" ${stars}`,
          created_at: r.created_at,
        });
      });

      results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setActivities(results);
      setUnreadCount(results.filter(r => Date.now() - new Date(r.created_at) < 3600000).length);
    } catch {
      // Keep existing activities on transient failure — don't reset to empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (visible) fetchActivities();
  }, [visible, fetchActivities]);

  const filtered = activeFilter === 'all'
    ? activities
    : activities.filter(a => a.type === activeFilter);

  const renderActivityItem = useCallback(({ item }) => {
    const meta = TYPE_META[item.type] || TYPE_META.vibe;
    const initials = item.actor?.[0]?.toUpperCase() || 'G';
    const COLORS = ['#0891b2', '#7c3aed', '#dc2626', '#059669', '#d97706'];
    const bgColor = COLORS[(item.actor?.charCodeAt(0) || 0) % COLORS.length];
    const isNew = Date.now() - new Date(item.created_at) < 3600000;
    return (
      <View
        style={[
          ac.item,
          { borderBottomColor: `${primary}12` },
          isNew && { backgroundColor: `${primary}06` },
        ]}
      >
        <View style={ac.avatarWrap}>
          {item.actor_avatar
            ? <Image source={{ uri: item.actor_avatar }} style={ac.avatar} />
            : <View style={[ac.avatar, { backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>{initials}</Text>
              </View>
          }
          <View style={[ac.typeDot, { backgroundColor: meta.color }]}>
            <Feather name={meta.icon} size={8} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[ac.text, { color: textColor }]}>
            <Text style={[ac.actor, { color: primary }]}>{item.actor}</Text>
            {' '}
            <Text style={{ color: textColor }}>{item.content}</Text>
          </Text>
          <Text style={[ac.time, { color: muted }]}>{formatAge(item.created_at)}</Text>
        </View>
        {isNew && <View style={[ac.newDot, { backgroundColor: primary }]} />}
      </View>
    );
  }, [primary, textColor, muted]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ac.overlay}>
        <GlassView style={[ac.container, { backgroundColor: `${bg}F0` }]}>

          {/* Header */}
          <View style={ac.header}>
            <View>
              <Text style={[ac.title, { color: primary }]}>ACTIVITY CENTER</Text>
              {unreadCount > 0 && (
                <Text style={[ac.unread, { color: muted }]}>{unreadCount} new in last hour</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Filter pills */}
          <View style={ac.filterRow}>
            {FILTERS.map(f => {
              const isActive = activeFilter === f;
              const meta = TYPE_META[f];
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => startTransition(() => setActiveFilter(f))}
                  style={[ac.filterPill, isActive && { backgroundColor: primary, borderColor: primary }]}
                >
                  {meta && <Feather name={meta.icon} size={11} color={isActive ? '#000' : primary} />}
                  <Text style={[ac.filterText, { color: isActive ? '#000' : primary }]}>
                    {f === 'all' ? 'All' : (TYPE_META[f]?.label || f)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={primary} size="large" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchActivities(true)}
                  tintColor={primary}
                />
              }
              renderItem={renderActivityItem}
              ListEmptyComponent={
                <View style={ac.empty}>
                  <Feather name={user ? 'bell' : 'lock'} size={40} color={muted} />
                  <Text style={[ac.emptyText, { color: muted }]}>
                    {user ? 'Your kingdom is quiet...' : 'Sign in to see activity'}
                  </Text>
                  <Text style={[ac.emptySub, { color: muted }]}>
                    {user
                      ? 'When people vibe, echo, or RSVP to your events — it appears here.'
                      : 'Activity from your events and followers will appear here once you sign in.'}
                  </Text>
                </View>
              }
            />
          )}
        </GlassView>
      </View>
    </Modal>
  );
};

const ac = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-start', paddingTop: 55 },
  container: { marginHorizontal: 16, maxHeight: '88%', borderRadius: 24, padding: 20, paddingBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  unread: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  filterText: { fontSize: 11, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  typeDot: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#000' },
  text: { fontSize: 13, lineHeight: 18 },
  actor: { fontWeight: '900', fontSize: 13 },
  time: { fontSize: 10, marginTop: 4, fontWeight: '600' },
  newDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  empty: { alignItems: 'center', paddingTop: 50, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700' },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});
