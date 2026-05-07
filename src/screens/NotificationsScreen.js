import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { supabase } from '../services/supabase';
import { NotificationService } from '../services/notificationService';

const TYPE_META = {
  vibe:    { icon: 'zap',            color: '#f97316' },
  rsvp:    { icon: 'check-circle',   color: '#10b981' },
  echo:    { icon: 'message-circle', color: '#8b5cf6' },
  follow:  { icon: 'user-plus',      color: '#06b6d4' },
  comment: { icon: 'message-square', color: '#3b82f6' },
  royal:   { icon: 'star',           color: '#f59e0b' },
  rating:  { icon: 'award',          color: '#ec4899' },
};

const SEGMENTS = ['Today', 'This Week', 'Older'];

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

const isInSegment = (dateStr, segment) => {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  if (segment === 'Today') return date >= todayStart;
  if (segment === 'This Week') return date >= weekStart && date < todayStart;
  return date < weekStart;
};

export const NotificationsScreen = ({ onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState('Today');
  const channelRef = useRef(null);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!user) { setNotifications([]); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setNotifications(data || []);
    } catch (e) {
      console.log('Notifications fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const markRead = useCallback(async (id) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await NotificationService.markAllRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications_screen_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => { fetchNotifications(); }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const filtered = notifications.filter(n => isInSegment(n.created_at, segment));
  const unreadCount = notifications.filter(n => !n.read).length;

  const renderItem = ({ item }) => {
    const meta = TYPE_META[item.type] || TYPE_META.vibe;
    return (
      <TouchableOpacity
        onPress={() => { if (!item.read) markRead(item.id); }}
        activeOpacity={0.75}
      >
        <View
          style={[
            ns.item,
            { borderBottomColor: `${primary}15` },
            !item.read && { backgroundColor: `${primary}08` },
          ]}
        >
          <View style={[ns.iconWrap, { backgroundColor: `${meta.color}22` }]}>
            <Feather name={meta.icon} size={18} color={meta.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[ns.title, { color: textColor }]}>
              <Text style={{ fontWeight: '900' }}>{item.title}</Text>
            </Text>
            {!!item.body && (
              <Text style={[ns.body, { color: muted }]} numberOfLines={2}>
                {item.body}
              </Text>
            )}
            <Text style={[ns.time, { color: muted }]}>{formatAge(item.created_at)}</Text>
          </View>
          {!item.read && (
            <View style={[ns.unreadDot, { backgroundColor: '#3b82f6' }]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={[ns.screen, { backgroundColor: bg }]}>
        <View style={ns.unauthContainer}>
          <Feather name="lock" size={52} color={muted} />
          <Text style={[ns.unauthTitle, { color: textColor }]}>Sign in required</Text>
          <Text style={[ns.unauthSub, { color: muted }]}>
            Sign in to see your notifications
          </Text>
          {onAuthRequired && (
            <TouchableOpacity
              style={[ns.signInBtn, { backgroundColor: primary }]}
              onPress={onAuthRequired}
            >
              <Text style={ns.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[ns.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={ns.header}>
        <Text style={[ns.headerTitle, { color: primary }]}>ACTIVITY</Text>
        <TouchableOpacity onPress={markAllRead} disabled={unreadCount === 0}>
          <Text style={[ns.markAll, { color: unreadCount > 0 ? primary : muted }]}>
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {/* Segment control */}
      <View style={[ns.segmentRow, { backgroundColor: surface }]}>
        {SEGMENTS.map(seg => {
          const isActive = segment === seg;
          return (
            <TouchableOpacity
              key={seg}
              style={[ns.segBtn, isActive && { backgroundColor: primary }]}
              onPress={() => setSegment(seg)}
            >
              <Text style={[ns.segText, { color: isActive ? '#000' : muted }]}>
                {seg}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              tintColor={primary}
            />
          }
          ListEmptyComponent={
            <View style={ns.empty}>
              <Feather name="bell-off" size={44} color={muted} />
              <Text style={[ns.emptyText, { color: muted }]}>
                All quiet in the kingdom
              </Text>
              <Text style={[ns.emptySub, { color: muted }]}>
                No notifications for this period yet.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
};

// ── useUnreadCount hook ──────────────────────────────────────────────────────
export const useUnreadCount = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const channelRef = useRef(null);

  const fetchCount = useCallback(async () => {
    if (!user) { setCount(0); return; }
    const { count: c } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false);
    setCount(c || 0);
  }, [user]);

  useEffect(() => {
    fetchCount();
    if (!user) return;
    const channel = supabase
      .channel(`unread_count_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => { fetchCount(); }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCount]);

  return count;
};

const ns = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d1112' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  markAll: { fontSize: 13, fontWeight: '700' },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  segText: { fontSize: 12, fontWeight: '800' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  body: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  time: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 10 },
  empty: { alignItems: 'center', paddingTop: 70, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  unauthContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  unauthTitle: { fontSize: 18, fontWeight: '900' },
  unauthSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  signInBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  signInBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
});
