import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { useToast } from '../components/ToastNotification';
import { DiscoveryManager } from '../services/dataFlow';

const FILTERS = [
  { key: 'all',    label: 'All Vibers', icon: 'users' },
  { key: 'online', label: 'Online Now', icon: 'zap' },
  { key: 'nearby', label: 'Near Me',    icon: 'map-pin' },
];

const RANK_LABELS = [
  { min: 0,     max: 100,    name: 'Viber',       color: '#94a3b8' },
  { min: 101,   max: 500,    name: 'Elite Viber', color: '#06b6d4' },
  { min: 501,   max: 2000,   name: 'Royal Viber', color: '#8b5cf6' },
  { min: 2001,  max: 10000,  name: 'Gruv Master', color: '#f59e0b' },
  { min: 10001, max: Infinity, name: 'Grand Viber', color: '#ef4444' },
];
const getRank = (score = 0) => RANK_LABELS.find(r => score >= r.min && score <= r.max) || RANK_LABELS[0];

const avatarBg = (u = '') =>
  ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777'][(u.charCodeAt(0) || 0) % 5];

function ViberRow({ viber, primary, textColor, muted, bg, onPress, onMessage, isFollowing }) {
  const rank = getRank(viber.vibe_score || 0);
  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: bg, borderColor: viber.is_online ? `${primary}30` : 'rgba(255,255,255,0.06)' }]}
      onPress={() => onPress(viber)}
      activeOpacity={0.82}
    >
      {/* Avatar */}
      <View style={{ position: 'relative' }}>
        {viber.avatar_url
          ? <Image source={{ uri: viber.avatar_url }} style={s.avatar} />
          : <View style={[s.avatar, { backgroundColor: avatarBg(viber.username), alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{(viber.username || 'V')[0].toUpperCase()}</Text>
            </View>
        }
        {viber.is_online && (
          <View style={[s.onlineDot, { borderColor: bg }]} />
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.username, { color: textColor }]} numberOfLines={1}>@{viber.username}</Text>
          {viber.is_verified && <Feather name="check-circle" size={12} color={primary} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[s.rankLabel, { color: rank.color }]}>{rank.name}</Text>
          {viber.distance_km != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Feather name="map-pin" size={9} color={muted} />
              <Text style={[s.dist, { color: muted }]}>{viber.distance_km.toFixed(1)}km</Text>
            </View>
          )}
        </View>
        {viber.bio ? <Text style={[s.bio, { color: muted }]} numberOfLines={1}>{viber.bio}</Text> : null}
      </View>

      {/* Vibe score */}
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={[s.score, { color: primary }]}>{viber.vibe_score || 0}</Text>
        <Text style={[s.scoreLabel, { color: muted }]}>vibes</Text>
      </View>

      {/* Message button */}
      <TouchableOpacity
        style={[s.msgBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
        onPress={(e) => { e.stopPropagation?.(); onMessage(viber); }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="message-circle" size={16} color={primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function DiscoverPeopleScreen({ onClose, onAuthRequired }) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: showToast } = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const surface   = currentTheme?.surface    || '#1a1f21';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [filter, setFilter] = useState('all');
  const [query, setQuery]   = useState('');
  const [vibers, setVibers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [selectedViber, setSelectedViber] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [msgTarget, setMsgTarget] = useState(null);
  const [msgVisible, setMsgVisible] = useState(false);
  const [followedIds, setFollowedIds] = useState(new Set());

  const searchTimer = useRef(null);

  const loadFollowing = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    setFollowedIds(new Set((data || []).map(r => r.following_id)));
  }, [user]);

  const fetchAll = useCallback(async (q = '') => {
    let qb = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, is_online, is_verified, vibe_score, interests')
      .order('vibe_score', { ascending: false })
      .limit(100);

    if (user?.id) qb = qb.neq('id', user.id);
    if (q.trim()) qb = qb.or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`);
    if (filter === 'online') qb = qb.eq('is_online', true);

    const { data, error } = await qb;
    if (error) throw new Error(error.message);
    return data || [];
  }, [filter, user]);

  const fetchNearby = useCallback(async () => {
    if (!user) return [];
    const results = await DiscoveryManager.findNearbyVibers(user.id, 25);
    return (results || []).filter(v => v.id !== user.id);
  }, [user]);

  const load = useCallback(async (isRefresh = false, q = '') => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);
    try {
      const results = filter === 'nearby' ? await fetchNearby() : await fetchAll(q);
      // Sort online users to the top
      setVibers(results.sort((a, b) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0)));
    } catch (e) {
      setFetchError(e.message || 'Could not load Vibers');
      setVibers([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [filter, fetchAll, fetchNearby]);

  // Re-run when filter changes OR when auth resolves (user goes from null → logged in)
  useEffect(() => {
    load();
    loadFollowing();
  }, [filter, user?.id]);

  useEffect(() => {
    if (!query.trim()) { load(); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(false, query), 350);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const handleMessage = (viber) => {
    if (!user) { onAuthRequired?.(); return; }
    setMsgTarget(viber);
    setMsgVisible(true);
  };

  return (
    <View style={[s.screen, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={20} color={textColor} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: textColor }]}>Find Vibers</Text>
          <Text style={[s.sub, { color: muted }]}>Discover people on The Gruvs</Text>
        </View>
        <View style={[s.onlineBadge, { backgroundColor: '#10b98118', borderColor: '#10b98135' }]}>
          <View style={s.onlinePip} />
          <Text style={s.onlineBadgeText}>{vibers.filter(v => v.is_online).length} online</Text>
        </View>
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80` }]}>
        <Feather name="search" size={16} color={query ? primary : muted} />
        <TextInput
          style={[s.searchInput, { color: textColor }]}
          placeholder="Search by username..."
          placeholderTextColor={muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Feather name="x" size={14} color={muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterBtn, { backgroundColor: filter === f.key ? primary : `${primary}12`, borderColor: filter === f.key ? primary : `${primary}25` }]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.8}
          >
            <Feather name={f.icon} size={12} color={filter === f.key ? '#000' : primary} />
            <Text style={[s.filterText, { color: filter === f.key ? '#000' : primary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={primary} />
          <Text style={[{ color: muted, marginTop: 12, fontSize: 13 }]}>Loading Vibers...</Text>
        </View>
      ) : fetchError ? (
        <View style={s.empty}>
          <Feather name="alert-circle" size={44} color="#ef4444" style={{ opacity: 0.7 }} />
          <Text style={[s.emptyTitle, { color: '#ef4444' }]}>Could not load Vibers</Text>
          <Text style={[s.emptySub, { color: muted }]}>{fetchError}</Text>
          <TouchableOpacity
            style={[s.retryBtn, { backgroundColor: primary }]}
            onPress={() => load()}
          >
            <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vibers}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primary} colors={[primary]} />}
          ListHeaderComponent={vibers.length > 0 ? (
            <Text style={[s.countHeader, { color: muted }]}>
              {vibers.length} Viber{vibers.length !== 1 ? 's' : ''}
              {filter === 'online' ? ' online now' : filter === 'nearby' ? ' near you' : ' in the kingdom'}
              {vibers.filter(v => v.is_online).length > 0 && filter !== 'online'
                ? ` · ${vibers.filter(v => v.is_online).length} online`
                : ''}
            </Text>
          ) : null}
          renderItem={({ item }) => (
            <ViberRow
              viber={item}
              primary={primary}
              textColor={textColor}
              muted={muted}
              bg={surface}
              onPress={(v) => { setSelectedViber(v); setProfileVisible(true); }}
              onMessage={handleMessage}
              isFollowing={followedIds.has(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="users" size={44} color={muted} style={{ opacity: 0.4 }} />
              <Text style={[s.emptyTitle, { color: textColor }]}>No Vibers found</Text>
              <Text style={[s.emptySub, { color: muted }]}>
                {filter === 'nearby'
                  ? 'No one nearby yet — enable location and check back.'
                  : filter === 'online'
                  ? 'No one is online right now — check back later.'
                  : query
                  ? `No Vibers matching "${query}"`
                  : 'No Vibers found — pull down to refresh.'}
              </Text>
            </View>
          }
        />
      )}

      <ViberProfileModal
        visible={profileVisible}
        user={selectedViber}
        userId={selectedViber?.id}
        onClose={() => setProfileVisible(false)}
      />

      {msgVisible && msgTarget && (
        <DirectMessageModal
          visible={msgVisible}
          onClose={() => { setMsgVisible(false); setMsgTarget(null); }}
          recipientId={msgTarget.id}
          recipientUsername={msgTarget.username}
          recipientAvatar={msgTarget.avatar_url}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  sub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  onlinePip: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10b981' },
  onlineBadgeText: { color: '#10b981', fontSize: 11, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, height: 44, borderRadius: 22, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  filterText: { fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 8 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2 },
  username: { fontSize: 14, fontWeight: '800' },
  rankLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  dist: { fontSize: 10, fontWeight: '700' },
  bio: { fontSize: 11, marginTop: 2 },
  score: { fontSize: 15, fontWeight: '900' },
  scoreLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  msgBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  countHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
});
