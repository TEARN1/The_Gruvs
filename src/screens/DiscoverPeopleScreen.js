import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Platform, ScrollView, Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { useToast } from '../components/ToastNotification';
import { DiscoveryManager, isOnline as checkOnline } from '../services/dataFlow';
import { resilientRead, resilient } from '../utils/resilience';

const FILTERS = [
  { key: 'all',    label: 'All Vibers', icon: 'users' },
  { key: 'online', label: 'Online Now', icon: 'zap' },
  { key: 'nearby', label: 'Near Me',    icon: 'map-pin' },
];

const RADIUS_OPTIONS = [1, 5, 10, 25, 50, 100];

const DESC_GENDERS = [
  { key: 'male',       label: '♂ Male' },
  { key: 'female',     label: '♀ Female' },
  { key: 'non_binary', label: '⚧ Non-binary' },
];

const DESC_HAIR = [
  'Short', 'Long', 'Medium', 'Bald', 'Locs/Dreads', 'Braids',
  'Natural/Afro', 'Weave', 'Coloured', 'Curly', 'Faded',
];

const DESC_BODY = ['Slim', 'Athletic', 'Average', 'Curvy', 'Plus Size', 'Tall', 'Short', 'Muscular'];

const DESC_SKIN = [
  { key: 'very_light', label: 'Very Light', color: '#fddbc4' },
  { key: 'light',      label: 'Light',      color: '#f1c89b' },
  { key: 'medium',     label: 'Medium',     color: '#c8926b' },
  { key: 'tan',        label: 'Tan/Olive',  color: '#9c6b42' },
  { key: 'brown',      label: 'Brown',      color: '#7c4a28' },
  { key: 'dark',       label: 'Dark Brown', color: '#4a2712' },
  { key: 'deep',       label: 'Deep/Ebony', color: '#2d1408' },
];

const DESC_INTERESTS = [
  'Music', 'Art', 'Food', 'Sports', 'Tech', 'Fashion', 'Film', 'Dance',
  'Gaming', 'Travel', 'Fitness', 'Comedy', 'Nightlife', 'Wellness', 'Business',
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

function ViberSkeleton({ primary, surface }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: 14, marginBottom: 6, padding: 12, backgroundColor: surface }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${primary}25` }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 10, borderRadius: 5, width: '50%', backgroundColor: `${primary}25` }} />
        <View style={{ height: 8, borderRadius: 4, width: '35%', backgroundColor: `${primary}15` }} />
      </View>
      <View style={{ width: 64, height: 28, borderRadius: 14, backgroundColor: `${primary}20` }} />
    </Animated.View>
  );
}

function ViberRow({ viber, primary, textColor, muted, bg, onPress, onMessage, isFollowing }) {
  const rank = getRank(viber.vibe_score || 0);
  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: bg, borderColor: checkOnline(viber) ? `${primary}30` : 'rgba(255,255,255,0.06)' }]}
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
        {checkOnline(viber) && (
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
  const { applyProfilePrivacy } = useIdentity();
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
  const [suggested, setSuggested] = useState([]);
  const [blockedIds, setBlockedIds] = useState(new Set());
  const pendingFollowIds = useRef(new Set());
  const [showDescFilters, setShowDescFilters] = useState(false);
  const [descGender, setDescGender] = useState(null);
  const [descHair, setDescHair] = useState(null);
  const [descBody, setDescBody] = useState(null);
  const [descSkin, setDescSkin] = useState(null);
  const [descInterest, setDescInterest] = useState(null);
  const [nearbyRadius, setNearbyRadius] = useState(25);

  const searchTimer = useRef(null);

  const loadFollowing = useCallback(async () => {
    if (!user) return;
    try {
      const [followRes, blockRes] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id),
      ]);
      setFollowedIds(new Set((followRes.data || []).map(r => r.following_id)));
      setBlockedIds(new Set((blockRes.data || []).map(r => r.blocked_id)));
    } catch { }
  }, [user]);

  const loadSuggested = useCallback(async () => {
    if (!user) return;
    try {
      const scored = await resilientRead(
        async () => {
          const { data, error } = await supabase.rpc('suggested_follows', { p_user: user.id, p_limit: 6 });
          if (error) throw error;
          if (!data?.length) return [];
          const ids = data.map(r => r.suggested_id);
          const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, is_verified, vibe_score, bio')
            .in('id', ids);
          if (pErr) throw pErr;
          return (profiles || []).map(p => ({
            ...p,
            mutual_count: data.find(r => r.suggested_id === p.id)?.mutual_count || 0,
          })).sort((a, b) => b.mutual_count - a.mutual_count);
        },
        async () => {
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, is_verified, vibe_score')
            .neq('id', user.id)
            .order('vibe_score', { ascending: false })
            .limit(6);
          if (error) throw error;
          return (profiles || []).map(p => ({ ...p, mutual_count: 0 }));
        },
        async () => [],
        [],
        'DiscoverPeople.loadSuggested'
      );
      if (scored.length) setSuggested(scored);
    } catch { }
  }, [user]);

  const fetchAll = useCallback(async (q = '') => {
    let qb = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, is_online, last_seen, is_verified, vibe_score, interests')
      .order('vibe_score', { ascending: false })
      .limit(100);

    if (user?.id) qb = qb.neq('id', user.id);
    if (q.trim()) qb = qb.or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`);
    // 'online' filter: pull last_seen within 5min instead of relying on stale is_online flag
    if (filter === 'online') qb = qb.gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    const { data, error } = await qb;
    if (error) throw new Error(error.message);
    return data || [];
  }, [filter, user]);

  const fetchNearby = useCallback(async () => {
    if (!user) return [];
    const results = await DiscoveryManager.findNearbyVibers(user.id, nearbyRadius);
    return (results || []).filter(v => v.id !== user.id);
  }, [user, nearbyRadius]);

  const load = useCallback(async (isRefresh = false, q = '') => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);
    try {
      const results = filter === 'nearby' ? await fetchNearby() : await fetchAll(q);

      // Apply privacy filtering (Ghost/Celebrity modes)
      const filteredResults = (results || [])
        .map(v => applyProfilePrivacy(v, v.id || v.profile_id))
        .filter(v => v !== null);

      // Sort online users to the top — description filters applied reactively via useMemo
      setVibers(filteredResults.sort((a, b) => (checkOnline(b) ? 1 : 0) - (checkOnline(a) ? 1 : 0)));
    } catch (e) {
      setFetchError(e.message || 'Could not load Vibers');
      setVibers([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [filter, fetchAll, fetchNearby]);

  const displayVibers = useMemo(() => {
    let result = vibers.filter(v => !blockedIds.has(v.id));
    if (descGender) result = result.filter(v => !v.gender || v.gender === descGender);
    if (descHair)   result = result.filter(v => !v.hair_style || v.hair_style?.toLowerCase().includes(descHair.toLowerCase()));
    if (descBody)   result = result.filter(v => !v.body_type || v.body_type === descBody);
    if (descSkin)   result = result.filter(v => !v.skin_tone || v.skin_tone === descSkin);
    if (descInterest) result = result.filter(v => !v.interests || (Array.isArray(v.interests) ? v.interests.some(i => i?.toLowerCase() === descInterest.toLowerCase()) : v.interests?.toLowerCase().includes(descInterest.toLowerCase())));
    return result;
  }, [vibers, blockedIds, descGender, descHair, descBody, descSkin, descInterest]);

  // Re-run when filter changes OR when auth resolves (user goes from null → logged in)
  useEffect(() => {
    load();
    loadFollowing();
    if (!query) loadSuggested();
  }, [filter, user?.id]);

  useEffect(() => {
    if (!query.trim()) { load(); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(false, query), 350);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  // Real-time: patch online status in-place when profiles.last_seen changes
  useEffect(() => {
    const chan = supabase
      .channel('discover_presence')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'is_online=eq.true' }, (payload) => {
        const updated = payload.new;
        setVibers(prev => prev.map(v => v.id === updated.id ? { ...v, is_online: updated.is_online, last_seen: updated.last_seen } : v));
      })
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, []);

  const handleMessage = useCallback((viber) => {
    if (!user) { onAuthRequired?.(); return; }
    setMsgTarget(viber);
    setMsgVisible(true);
  }, [user, onAuthRequired]);

  const renderViberRow = useCallback(({ item }) => (
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
  ), [primary, textColor, muted, surface, followedIds, handleMessage]);

  const handleBlock = async (viber) => {
    if (!user) return;
    try {
      await supabase.from('user_blocks').upsert(
        { blocker_id: user.id, blocked_id: viber.id },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
      );
      setBlockedIds(prev => new Set([...prev, viber.id]));
      showToast(`@${viber.username} blocked`, 'info');
    } catch {
      showToast('Could not block user. Try again.', 'error');
    }
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
          <Text style={s.onlineBadgeText}>{displayVibers.filter(v => checkOnline(v)).length} online</Text>
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
        <TouchableOpacity
          style={[s.filterBtn, {
            backgroundColor: showDescFilters ? `${primary}20` : `${primary}12`,
            borderColor: showDescFilters ? primary : `${primary}25`,
          }]}
          onPress={() => setShowDescFilters(p => !p)}
          activeOpacity={0.8}
        >
          <Feather name="sliders" size={12} color={primary} />
          <Text style={[s.filterText, { color: primary }]}>
            Describe
            {(descGender || descHair || descBody || descSkin || descInterest) ? ' ✦' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Nearby radius selector */}
      {filter === 'nearby' && (
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <Text style={[s.sectionLabel, { color: muted }]}>Search Radius</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {RADIUS_OPTIONS.map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setNearbyRadius(r)}
                style={[s.filterBtn, {
                  backgroundColor: nearbyRadius === r ? primary : `${primary}12`,
                  borderColor: nearbyRadius === r ? primary : `${primary}25`,
                }]}
              >
                <Text style={[s.filterText, { color: nearbyRadius === r ? '#000' : primary }]}>{r}km</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Description filters panel */}
      {showDescFilters && (
        <View style={[s.descPanel, { backgroundColor: `${surface}80`, borderColor: `${primary}15` }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: textColor, fontSize: 13, fontWeight: '900' }}>Describe who you're looking for</Text>
            {(descGender || descHair || descBody || descSkin || descInterest) && (
              <TouchableOpacity onPress={() => { setDescGender(null); setDescHair(null); setDescBody(null); setDescSkin(null); setDescInterest(null); }}>
                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[s.descLabel, { color: muted }]}>Gender</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {DESC_GENDERS.map(g => (
              <TouchableOpacity key={g.key} onPress={() => setDescGender(descGender === g.key ? null : g.key)}
                style={[s.filterBtn, { backgroundColor: descGender === g.key ? primary : `${primary}12`, borderColor: descGender === g.key ? primary : `${primary}25` }]}>
                <Text style={[s.filterText, { color: descGender === g.key ? '#000' : primary }]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.descLabel, { color: muted }]}>Skin Tone</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {DESC_SKIN.map(sk => (
              <TouchableOpacity key={sk.key} onPress={() => setDescSkin(descSkin === sk.key ? null : sk.key)}
                style={[s.filterBtn, { backgroundColor: descSkin === sk.key ? primary : `${primary}12`, borderColor: descSkin === sk.key ? primary : `${primary}25`, flexDirection: 'row', gap: 6 }]}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: sk.color }} />
                <Text style={[s.filterText, { color: descSkin === sk.key ? '#000' : primary }]}>{sk.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.descLabel, { color: muted }]}>Hair Style</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {DESC_HAIR.map(h => (
              <TouchableOpacity key={h} onPress={() => setDescHair(descHair === h ? null : h)}
                style={[s.filterBtn, { backgroundColor: descHair === h ? primary : `${primary}12`, borderColor: descHair === h ? primary : `${primary}25` }]}>
                <Text style={[s.filterText, { color: descHair === h ? '#000' : primary }]}>{h}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.descLabel, { color: muted }]}>Body Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {DESC_BODY.map(b => (
              <TouchableOpacity key={b} onPress={() => setDescBody(descBody === b ? null : b)}
                style={[s.filterBtn, { backgroundColor: descBody === b ? primary : `${primary}12`, borderColor: descBody === b ? primary : `${primary}25` }]}>
                <Text style={[s.filterText, { color: descBody === b ? '#000' : primary }]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.descLabel, { color: muted }]}>Interests</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 4 }}>
            {DESC_INTERESTS.map(i => (
              <TouchableOpacity key={i} onPress={() => setDescInterest(descInterest === i ? null : i)}
                style={[s.filterBtn, { backgroundColor: descInterest === i ? primary : `${primary}12`, borderColor: descInterest === i ? primary : `${primary}25` }]}>
                <Text style={[s.filterText, { color: descInterest === i ? '#000' : primary }]}>{i}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <ViberSkeleton key={i} primary={primary} surface={surface} />
          ))}
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
          data={displayVibers}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primary} colors={[primary]} />}
          ListHeaderComponent={
            <>
              {/* Suggested follows (friends-of-friends) */}
              {user && suggested.length > 0 && !query && filter === 'all' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[s.sectionLabel, { color: muted }]}>SUGGESTED FOR YOU</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {suggested.filter(v => !blockedIds.has(v.id)).map(v => (
                      <TouchableOpacity
                        key={v.id}
                        style={[s.suggestCard, { backgroundColor: surface, borderColor: `${primary}20` }]}
                        onPress={() => { setSelectedViber(v); setProfileVisible(true); }}
                        activeOpacity={0.8}
                      >
                        {v.avatar_url
                          ? <Image source={{ uri: v.avatar_url }} style={s.suggestAvatar} />
                          : <View style={[s.suggestAvatar, { backgroundColor: avatarBg(v.username), alignItems: 'center', justifyContent: 'center' }]}>
                              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{(v.username || 'V')[0].toUpperCase()}</Text>
                            </View>
                        }
                        <Text style={[s.suggestName, { color: textColor }]} numberOfLines={1}>@{v.username}</Text>
                        <Text style={[s.suggestMutual, { color: muted }]}>{v.mutual_count} mutual{v.mutual_count !== 1 ? 's' : ''}</Text>
                        <TouchableOpacity
                          style={[s.suggestFollowBtn, { backgroundColor: followedIds.has(v.id) ? `${primary}20` : primary }]}
                          onPress={async () => {
                            if (!user || pendingFollowIds.current.has(v.id)) return;
                            pendingFollowIds.current.add(v.id);
                            try {
                              if (followedIds.has(v.id)) {
                                setFollowedIds(prev => { const n = new Set(prev); n.delete(v.id); return n; });
                                const ok = await resilient(
                                  [
                                    () => supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', v.id),
                                    () => supabase.from('follows').update({ unfollowed_at: new Date().toISOString() }).eq('follower_id', user.id).eq('following_id', v.id),
                                    () => supabase.rpc('unfollow_user', { p_follower_id: user.id, p_following_id: v.id }),
                                  ],
                                  { attemptsPerTier: 2, baseMs: 300, label: `DiscoverPeople.unfollow:${v.id}`, fallbackValue: null }
                                );
                                if (ok === null) setFollowedIds(prev => new Set([...prev, v.id]));
                              } else {
                                setFollowedIds(prev => new Set([...prev, v.id]));
                                const ok = await resilient(
                                  [
                                    () => supabase.from('follows').upsert({ follower_id: user.id, following_id: v.id }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true }),
                                    () => supabase.from('follows').insert({ follower_id: user.id, following_id: v.id }),
                                    () => supabase.rpc('follow_user', { p_follower_id: user.id, p_following_id: v.id }),
                                  ],
                                  { attemptsPerTier: 2, baseMs: 300, label: `DiscoverPeople.follow:${v.id}`, fallbackValue: null }
                                );
                                if (ok === null) setFollowedIds(prev => { const n = new Set(prev); n.delete(v.id); return n; });
                              }
                            } finally {
                              pendingFollowIds.current.delete(v.id);
                            }
                          }}
                        >
                          <Text style={[s.suggestFollowText, { color: followedIds.has(v.id) ? primary : '#000' }]}>
                            {followedIds.has(v.id) ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              {vibers.filter(v => !blockedIds.has(v.id)).length > 0 && (
                <Text style={[s.countHeader, { color: muted }]}>
                  {vibers.filter(v => !blockedIds.has(v.id)).length} Viber{vibers.filter(v => !blockedIds.has(v.id)).length !== 1 ? 's' : ''}
                  {filter === 'online' ? ' online now' : filter === 'nearby' ? ' near you' : ' in the kingdom'}
                  {vibers.filter(v => checkOnline(v) && !blockedIds.has(v.id)).length > 0 && filter !== 'online'
                    ? ` · ${vibers.filter(v => checkOnline(v) && !blockedIds.has(v.id)).length} online`
                    : ''}
                </Text>
              )}
            </>
          }
          renderItem={renderViberRow}
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
          recipient={msgTarget}
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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  filterText: { fontSize: 12, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  descPanel: { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, borderWidth: 1, padding: 14 },
  descLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
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
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 10 },
  suggestCard: { width: 120, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  suggestAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 4 },
  suggestName: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  suggestMutual: { fontSize: 10, textAlign: 'center' },
  suggestFollowBtn: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  suggestFollowText: { fontSize: 11, fontWeight: '900' },
});
