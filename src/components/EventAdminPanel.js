import React, { useState, useEffect, useCallback, startTransition } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Platform, Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';

const buildCSV = (rsvps) => {
  const header = 'Username,Status,RSVP Date\n';
  const rows = rsvps.map(r =>
    `${r.profiles?.username || 'Unknown'},${r.status || 'going'},${r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}`
  ).join('\n');
  return header + rows;
};

const exportRSVPs = async (event, rsvps) => {
  const csv = buildCSV(rsvps);
  const filename = `${(event?.title || 'event').replace(/\s+/g, '_')}_rsvps.csv`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } else {
    await Share.share({ message: csv, title: filename });
  }
};

const formatAge = (d) => {
  if (!d) return '';
  const mins = Math.floor((Date.now() - new Date(d)) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const TYPES = [
  { key: 'all',     label: 'All',     icon: 'activity',      color: '#00f2ff' },
  { key: 'vibe',    label: 'Vibes',   icon: 'zap',           color: '#f59e0b' },
  { key: 'rsvp',    label: 'RSVPs',   icon: 'check-circle',  color: '#10b981' },
  { key: 'echo',    label: 'Echoes',  icon: 'message-circle',color: '#8b5cf6' },
  { key: 'rating',  label: 'Ratings', icon: 'star',          color: '#f97316' },
];

const avatarBg = (name) => {
  const cols = ['#0891b2', '#7c3aed', '#dc2626', '#059669', '#d97706'];
  return cols[(name?.charCodeAt(0) || 0) % cols.length];
};

export const EventAdminPanel = ({ visible, onClose, event, userId }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [filter, setFilter] = useState('all');
  const [feed, setFeed] = useState([]);
  const [rsvpList, setRsvpList] = useState([]);
  const [stats, setStats] = useState({ vibes: 0, rsvps: 0, echoes: 0, avgRating: null });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const eventId = event?.id;

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [vibeRes, rsvpRes, echoRes, ratingRes] = await Promise.all([
        supabase.from('event_vibes').select('created_at, profiles(username, avatar_url)').eq('event_id', eventId).order('created_at', { ascending: false }).limit(50),
        supabase.from('event_rsvps').select('id, status, created_at, profiles(username, avatar_url)').eq('event_id', eventId).order('created_at', { ascending: false }).limit(200),
        supabase.from('echoes').select('body, created_at, profiles(username, avatar_url)').eq('event_id', eventId).order('created_at', { ascending: false }).limit(50),
        supabase.from('event_ratings').select('rating, review, created_at, profiles(username, avatar_url)').eq('event_id', eventId).order('created_at', { ascending: false }).limit(50),
      ]);

      const vibes = (vibeRes.data || []).map(r => ({ ...r, type: 'vibe' }));
      const rsvps = (rsvpRes.data || []).map(r => ({ ...r, type: 'rsvp' }));
      setRsvpList(rsvpRes.data || []);
      const echoes = (echoRes.data || []).map(r => ({ ...r, type: 'echo' }));
      const ratings = (ratingRes.data || []).map(r => ({ ...r, type: 'rating' }));

      const all = [...vibes, ...rsvps, ...echoes, ...ratings]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setFeed(all);

      const goingCount = (rsvpRes.data || []).filter(r => r.status === 'going').length;
      const ratingVals = (ratingRes.data || []).map(r => r.rating).filter(Boolean);
      const avgRating = ratingVals.length > 0
        ? (ratingVals.reduce((s, v) => s + v, 0) / ratingVals.length).toFixed(1)
        : null;

      setStats({
        vibes: vibes.length,
        rsvps: goingCount,
        echoes: echoes.length,
        avgRating,
      });
    } catch (e) {
      console.log('AdminPanel error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (visible && eventId) loadData();
  }, [visible, eventId, loadData]);

  // Real-time subscription
  useEffect(() => {
    if (!visible || !eventId) return;
    const channel = supabase
      .channel(`admin:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_vibes', filter: `event_id=eq.${eventId}` }, () => loadData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_rsvps', filter: `event_id=eq.${eventId}` }, () => loadData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'echoes', filter: `event_id=eq.${eventId}` }, () => loadData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_ratings', filter: `event_id=eq.${eventId}` }, () => loadData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [visible, eventId, loadData]);

  const displayed = filter === 'all' ? feed : feed.filter(item => item.type === filter);

  const renderItem = (item, i) => {
    const name = item.profiles?.username || 'Viber';
    const avatarUrl = item.profiles?.avatar_url;
    const typeConfig = TYPES.find(t => t.key === item.type) || TYPES[0];

    let message = '';
    if (item.type === 'vibe') message = 'vibed with your event';
    else if (item.type === 'rsvp') message = `RSVP'd as "${item.status}"`;
    else if (item.type === 'echo') message = `echoed: "${(item.body || '').slice(0, 60)}${item.body?.length > 60 ? '…' : ''}"`;
    else if (item.type === 'rating') message = `rated ${item.rating}★${item.review ? ` — "${item.review.slice(0, 40)}…"` : ''}`;

    return (
      <View key={`${item.type}_${i}`} style={[ad.row, { borderBottomColor: `${primary}08` }]}>
        <View style={ad.avatarWrap}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={ad.avatar} />
            : <View style={[ad.avatar, { backgroundColor: avatarBg(name), alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={ad.avatarLetter}>{name[0].toUpperCase()}</Text>
              </View>
          }
          <View style={[ad.typeDot, { backgroundColor: typeConfig.color }]} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[ad.nameText, { color: textColor }]}>
            <Text style={{ color: primary }}>@{name}</Text>{' '}{message}
          </Text>
          <Text style={[ad.timeText, { color: muted }]}>{formatAge(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ad.overlay}>
        <View style={[ad.sheet, { backgroundColor: bg, borderColor: `${primary}25` }]}>
          {/* Handle */}
          <View style={[ad.pill, { backgroundColor: `${primary}50` }]} />

          {/* Header */}
          <View style={ad.header}>
            <View style={{ flex: 1 }}>
              <Text style={[ad.title, { color: primary }]}>📊 EVENT DASHBOARD</Text>
              <Text style={[ad.subtitle, { color: muted }]} numberOfLines={1}>
                {event?.title || 'Your Event'}
              </Text>
            </View>
            <TouchableOpacity
              style={[ad.exportBtn, { borderColor: `${primary}40` }]}
              onPress={() => exportRSVPs(event, rsvpList)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="download" size={13} color={primary} />
              <Text style={[ad.exportText, { color: primary }]}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 12 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={ad.statsRow}>
            {[
              { label: 'Vibes',   value: stats.vibes,    icon: 'zap',           color: '#f59e0b' },
              { label: 'Going',   value: stats.rsvps,    icon: 'check-circle',  color: '#10b981' },
              { label: 'Echoes',  value: stats.echoes,   icon: 'message-circle',color: '#8b5cf6' },
              { label: 'Avg ★',   value: stats.avgRating || '—', icon: 'star', color: '#f97316' },
            ].map(s => (
              <View key={s.label} style={[ad.statBox, { backgroundColor: `${s.color}12`, borderColor: `${s.color}25` }]}>
                <Feather name={s.icon} size={16} color={s.color} />
                <Text style={[ad.statVal, { color: s.color }]}>{s.value}</Text>
                <Text style={[ad.statLabel, { color: muted }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Filter pills */}
          <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} style={ad.filterScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {TYPES.map(t => {
              const isActive = filter === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => startTransition(() => setFilter(t.key))}
                  style={[ad.filterPill, { backgroundColor: isActive ? t.color : `${t.color}12`, borderColor: isActive ? t.color : `${t.color}25` }]}
                >
                  <Feather name={t.icon} size={11} color={isActive ? '#000' : t.color} />
                  <Text style={[ad.filterText, { color: isActive ? '#000' : t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Live feed */}
          <ScrollView showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={primary} />}
          >
            {loading && feed.length === 0 ? (
              <ActivityIndicator color={primary} style={{ marginTop: 40 }} />
            ) : displayed.length === 0 ? (
              <View style={ad.empty}>
                <Text style={{ fontSize: 36 }}>📭</Text>
                <Text style={[ad.emptyText, { color: muted }]}>No activity yet.</Text>
                <Text style={[ad.emptySub, { color: muted }]}>Share your event to get the vibe going!</Text>
              </View>
            ) : (
              displayed.map(renderItem)
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const ad = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  sheet: { height: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, overflow: 'hidden' },
  pill: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  subtitle: { fontSize: 12, marginTop: 3 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '700' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  exportText: { fontSize: 11, fontWeight: '800' },
  filterScroll: { maxHeight: 42, marginBottom: 12 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarLetter: { color: '#fff', fontSize: 14, fontWeight: '900' },
  typeDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#000' },
  nameText: { fontSize: 13, lineHeight: 18 },
  timeText: { fontSize: 10, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 50, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 12 },
});
