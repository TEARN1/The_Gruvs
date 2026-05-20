import React, { useState, useEffect, useCallback, startTransition } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Platform, Share,
  TextInput,
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

const TABS = [
  { key: 'feed',    label: 'Live Feed', icon: 'activity' },
  { key: 'checkin', label: 'Check-In',  icon: 'user-check' },
  { key: 'rsvps',   label: 'Guest List',icon: 'list' },
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

  const [activeTab, setActiveTab] = useState('feed');
  const [filter, setFilter] = useState('all');
  const [feed, setFeed] = useState([]);
  const [rsvpList, setRsvpList] = useState([]);
  const [checkedIn, setCheckedIn] = useState({});
  const [stats, setStats] = useState({ vibes: 0, rsvps: 0, echoes: 0, avgRating: null });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkInQuery, setCheckInQuery] = useState('');
  const [checkInResult, setCheckInResult] = useState(null);
  const [checkInLoading, setCheckInLoading] = useState(false);

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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  // Load existing check-ins
  const loadCheckins = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data } = await supabase
        .from('event_checkins')
        .select('rsvp_id')
        .eq('event_id', eventId);
      const map = {};
      for (const c of data || []) map[c.rsvp_id] = true;
      setCheckedIn(map);
    } catch { /* keep existing check-in state on transient failure */ }
  }, [eventId]);

  // Verify ticket ref or username and mark checked in
  const doCheckIn = async () => {
    const q = checkInQuery.trim().toUpperCase().replace(/^#/, '');
    if (!q || !eventId) return;
    setCheckInLoading(true);
    setCheckInResult(null);
    try {
      // Try as rsvp id prefix first
      let rsvp = null;
      const { data: byRef } = await supabase
        .from('event_rsvps')
        .select('id, user_id, status, profiles:user_id(username, avatar_url)')
        .eq('event_id', eventId)
        .ilike('id', `${q}%`)
        .limit(1)
        .single();
      if (byRef) rsvp = byRef;

      if (!rsvp) {
        // Try by username
        const { data: byUser } = await supabase
          .from('event_rsvps')
          .select('id, user_id, status, profiles:user_id(username, avatar_url)')
          .eq('event_id', eventId)
          .ilike('profiles.username', `%${q.toLowerCase()}%`)
          .limit(1)
          .single();
        if (byUser) rsvp = byUser;
      }

      if (!rsvp) {
        setCheckInResult({ ok: false, msg: 'Ticket not found. Check the ref or username.' });
        return;
      }
      if (rsvp.status !== 'going') {
        setCheckInResult({ ok: false, msg: `@${rsvp.profiles?.username} RSVP'd as "${rsvp.status}" — not confirmed going.` });
        return;
      }
      if (checkedIn[rsvp.id]) {
        setCheckInResult({ ok: false, msg: `@${rsvp.profiles?.username} is already checked in.`, username: rsvp.profiles?.username, avatar: rsvp.profiles?.avatar_url });
        return;
      }
      await supabase.from('event_checkins').upsert({ event_id: eventId, rsvp_id: rsvp.id, user_id: rsvp.user_id }, { onConflict: 'rsvp_id' });
      setCheckedIn(prev => ({ ...prev, [rsvp.id]: true }));
      setCheckInResult({ ok: true, msg: `@${rsvp.profiles?.username} checked in!`, username: rsvp.profiles?.username, avatar: rsvp.profiles?.avatar_url });
      setCheckInQuery('');
    } finally {
      setCheckInLoading(false);
    }
  };

  useEffect(() => {
    if (visible && eventId) { loadData(); loadCheckins(); }
  }, [visible, eventId, loadData, loadCheckins]);

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
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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

          {/* Tab bar */}
          <View style={[ad.tabBar, { borderBottomColor: `${primary}18` }]}>
            {TABS.map(t => {
              const isActive = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setActiveTab(t.key)}
                  style={[ad.tabBtn, isActive && { borderBottomColor: primary, borderBottomWidth: 2 }]}
                >
                  <Feather name={t.icon} size={13} color={isActive ? primary : muted} />
                  <Text style={[ad.tabLabel, { color: isActive ? primary : muted }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Live Feed tab */}
          {activeTab === 'feed' && (
            <>
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
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
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
            </>
          )}

          {/* Check-In tab */}
          {activeTab === 'checkin' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Text style={[ad.sectionTitle, { color: muted }]}>VERIFY TICKET AT DOOR</Text>
              <Text style={[ad.sectionSub, { color: muted }]}>Enter the 8-character ticket ref or @username</Text>
              <View style={[ad.searchRow, { borderColor: `${primary}40` }]}>
                <TextInput
                  style={[ad.searchInput, { color: textColor }]}
                  value={checkInQuery}
                  onChangeText={setCheckInQuery}
                  placeholder="Ticket ref or @username..."
                  placeholderTextColor={muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={doCheckIn}
                />
                <TouchableOpacity
                  style={[ad.checkInBtn, { backgroundColor: primary }]}
                  onPress={doCheckIn}
                  disabled={checkInLoading}
                >
                  {checkInLoading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Feather name="check" size={18} color="#000" />
                  }
                </TouchableOpacity>
              </View>

              {checkInResult && (
                <View style={[ad.resultCard, { backgroundColor: checkInResult.ok ? '#10b98118' : '#ef444418', borderColor: checkInResult.ok ? '#10b981' : '#ef4444' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {checkInResult.avatar
                      ? <Image source={{ uri: checkInResult.avatar }} style={ad.resultAvatar} />
                      : checkInResult.username
                        ? <View style={[ad.resultAvatar, { backgroundColor: avatarBg(checkInResult.username), alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ color: '#fff', fontWeight: '900' }}>{checkInResult.username[0].toUpperCase()}</Text>
                          </View>
                        : null
                    }
                    <View style={{ flex: 1 }}>
                      <Feather name={checkInResult.ok ? 'check-circle' : 'x-circle'} size={18} color={checkInResult.ok ? '#10b981' : '#ef4444'} />
                      <Text style={[ad.resultMsg, { color: checkInResult.ok ? '#10b981' : '#ef4444' }]}>{checkInResult.msg}</Text>
                    </View>
                  </View>
                </View>
              )}

              <Text style={[ad.sectionTitle, { color: muted, marginTop: 24 }]}>
                CHECKED IN — {Object.keys(checkedIn).length} / {stats.rsvps}
              </Text>
              {rsvpList.filter(r => r.status === 'going').map(r => (
                <View key={r.id} style={[ad.guestRow, { borderBottomColor: `${primary}10` }]}>
                  {r.profiles?.avatar_url
                    ? <Image source={{ uri: r.profiles.avatar_url }} style={ad.guestAvatar} />
                    : <View style={[ad.guestAvatar, { backgroundColor: avatarBg(r.profiles?.username), alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{(r.profiles?.username || '?')[0].toUpperCase()}</Text>
                      </View>
                  }
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[ad.guestName, { color: textColor }]}>@{r.profiles?.username}</Text>
                    <Text style={[ad.guestRef, { color: muted }]}>Ref: {r.id.slice(0, 8).toUpperCase()}</Text>
                  </View>
                  {checkedIn[r.id]
                    ? <View style={ad.checkedBadge}><Feather name="check" size={12} color="#10b981" /><Text style={[ad.checkedText, { color: '#10b981' }]}>IN</Text></View>
                    : <Text style={[ad.pendingText, { color: muted }]}>Pending</Text>
                  }
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* Guest list tab */}
          {activeTab === 'rsvps' && (
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={primary} />}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 12 }}>
                <TouchableOpacity
                  style={[ad.exportBtn, { borderColor: `${primary}40` }]}
                  onPress={() => exportRSVPs(event, rsvpList)}
                >
                  <Feather name="download" size={13} color={primary} />
                  <Text style={[ad.exportText, { color: primary }]}>Export CSV</Text>
                </TouchableOpacity>
              </View>
              {rsvpList.map((r) => (
                <View key={r.id} style={[ad.guestRow, { borderBottomColor: `${primary}10` }]}>
                  {r.profiles?.avatar_url
                    ? <Image source={{ uri: r.profiles.avatar_url }} style={ad.guestAvatar} />
                    : <View style={[ad.guestAvatar, { backgroundColor: avatarBg(r.profiles?.username), alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{(r.profiles?.username || '?')[0].toUpperCase()}</Text>
                      </View>
                  }
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[ad.guestName, { color: textColor }]}>@{r.profiles?.username}</Text>
                    <Text style={[ad.guestRef, { color: muted }]}>{formatAge(r.created_at)}</Text>
                  </View>
                  <View style={[ad.statusPill, {
                    backgroundColor: r.status === 'going' ? '#10b98118' : r.status === 'maybe' ? '#f59e0b18' : '#ef444418',
                    borderColor: r.status === 'going' ? '#10b981' : r.status === 'maybe' ? '#f59e0b' : '#ef4444',
                  }]}>
                    <Text style={[ad.statusText, { color: r.status === 'going' ? '#10b981' : r.status === 'maybe' ? '#f59e0b' : '#ef4444' }]}>
                      {r.status?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
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
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 2 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11 },
  tabLabel: { fontSize: 11, fontWeight: '800' },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  searchInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  checkInBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  resultCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 8 },
  resultAvatar: { width: 36, height: 36, borderRadius: 18 },
  resultMsg: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  guestRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  guestAvatar: { width: 36, height: 36, borderRadius: 18 },
  guestName: { fontSize: 13, fontWeight: '800' },
  guestRef: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  checkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#10b98120' },
  checkedText: { fontSize: 10, fontWeight: '900' },
  pendingText: { fontSize: 11, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '900' },
});
