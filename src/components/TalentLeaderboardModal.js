/**
 * TalentLeaderboardModal — the scout engine UI.
 *
 * "Find me the top U-20 striker in Gauteng." Ranks players by any metric
 * (goals/assists/rating/apps/followers), filterable by sport, age bracket,
 * position and region. Tapping a result opens the player's career card.
 * Backed by TalentEngine.searchTopPlayers → search_top_players() RPC.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, TextInput, Platform, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { LiquidBackground } from './LiquidBackground';
import { AnimatedCounter } from './Motion';
import { haptics } from '../utils/haptics';
import { PlayerProfileModal } from './PlayerProfileModal';
import { TalentEngine, playerOVR } from '../services/talentEngine';

const METRICS = [
  { key: 'rating',    label: 'Rating' },
  { key: 'events',    label: 'Events' },
  { key: 'goals',     label: 'Goals'  },
  { key: 'awards',    label: 'Awards' },
  { key: 'followers', label: 'Fans'   },
];

// Universal — any event category, not just sport.
const CATEGORIES = ['all', 'sport', 'music', 'comedy', 'hackathon', 'fashion', 'esports', 'debate'];

const AGE_BRACKETS = [
  { key: 'all',    label: 'All ages', min: null, max: null },
  { key: 'u18',    label: 'U-18',     min: null, max: 17 },
  { key: 'u20',    label: 'U-20',     min: null, max: 19 },
  { key: 'u23',    label: 'U-23',     min: null, max: 22 },
  { key: 'senior', label: 'Senior',   min: 23,   max: null },
];

const MEDALS = ['🥇', '🥈', '🥉'];

const metricValue = (p, metric) => {
  switch (metric) {
    case 'events':    return p.career_events || 0;
    case 'awards':    return p.career_awards || 0;
    case 'assists':   return p.career_assists || 0;
    case 'apps':      return p.career_apps || 0;
    case 'rating':    return Math.round((p.career_rating || 0) * 10) / 10;
    case 'followers': return p.follower_count || 0;
    default:          return p.career_goals || 0;
  }
};

export const TalentLeaderboardModal = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const [metric, setMetric]   = useState('rating');
  const [category, setCategory] = useState('all');
  const [ageKey, setAgeKey]   = useState('all');
  const [region, setRegion] = useState('');
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openPlayer, setOpenPlayer] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const ab = AGE_BRACKETS.find(a => a.key === ageKey) || AGE_BRACKETS[0];
    const data = await TalentEngine.searchTopPlayers({
      metric,
      category: category === 'all' ? null : category,
      region: region.trim() || null,
      minAge: ab.min,
      maxAge: ab.max,
      limit: 25,
    });
    setRows(data || []);
    setLoading(false); setRefreshing(false);
  }, [metric, category, ageKey, region]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const Chip = ({ active, onPress, children }) => (
    <TouchableOpacity
      onPress={() => { haptics.select(); onPress(); }}
      style={[lb.chip, { backgroundColor: active ? primary : `${primary}12`, borderColor: active ? primary : `${primary}30` }]}
      activeOpacity={0.85}
    >
      <Text style={[lb.chipText, { color: active ? '#000' : primary }]}>{children}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[lb.root, { backgroundColor: bg }]}>
        <LiquidBackground intensity={0.9} />

        {/* Header */}
        <View style={lb.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={lb.headerBtn}>
            <Feather name="x" size={22} color={textColor} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[lb.headerTitle, { color: textColor }]}>Talent Scout</Text>
            <Text style={[lb.headerSub, { color: muted }]}>Top players, ranked</Text>
          </View>
          <View style={lb.headerBtn} />
        </View>

        {/* Filters */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={lb.filterRow}>
            {METRICS.map(m => (
              <Chip key={m.key} active={metric === m.key} onPress={() => setMetric(m.key)}>{m.label}</Chip>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={lb.filterRow}>
            {CATEGORIES.map(c => (
              <Chip key={c} active={category === c} onPress={() => setCategory(c)}>
                {c === 'all' ? 'All talent' : c.charAt(0).toUpperCase() + c.slice(1)}
              </Chip>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={lb.filterRow}>
            {AGE_BRACKETS.map(a => (
              <Chip key={a.key} active={ageKey === a.key} onPress={() => setAgeKey(a.key)}>{a.label}</Chip>
            ))}
          </ScrollView>
          <View style={[lb.searchWrap, { backgroundColor: surface, borderColor: `${primary}20` }]}>
            <Feather name="map-pin" size={14} color={muted} />
            <TextInput
              style={[lb.searchInput, { color: textColor }]}
              placeholder="Region / city (e.g. Gauteng)"
              placeholderTextColor={muted}
              value={region}
              onChangeText={setRegion}
              onSubmitEditing={() => load()}
              returnKeyType="search"
            />
            {region.length > 0 && (
              <TouchableOpacity onPress={() => { setRegion(''); }}>
                <Feather name="x" size={14} color={muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={lb.center}><ActivityIndicator color={primary} size="large" /></View>
        ) : rows.length === 0 ? (
          <View style={lb.center}>
            <Feather name="search" size={38} color={muted} />
            <Text style={{ color: muted, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }}>
              No players match yet. As players feature in events, the board fills up.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primary} colors={[primary]} />}
          >
            {rows.map((p, i) => (
              <TouchableOpacity key={p.id || i} activeOpacity={0.85} onPress={() => { haptics.light(); setOpenPlayer(p.id); }}>
                <GlassView sheen={i < 3} glow={i === 0} intensity={i < 3 ? 1.1 : 0.8} style={lb.row}>
                  {/* Rank */}
                  <View style={lb.rankCol}>
                    {i < 3
                      ? <Text style={lb.medal}>{MEDALS[i]}</Text>
                      : <Text style={[lb.rankNum, { color: muted }]}>{i + 1}</Text>}
                  </View>
                  {/* Photo */}
                  {p.photo_url
                    ? <Image source={{ uri: p.photo_url }} style={lb.photo} />
                    : <View style={[lb.photo, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: primary, fontWeight: '900', fontSize: 18 }}>{(p.full_name || '?')[0].toUpperCase()}</Text>
                      </View>}
                  {/* Name + meta */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={[lb.name, { color: textColor }]} numberOfLines={1}>{p.known_as || p.full_name}</Text>
                      {p.is_verified && <Feather name="check-circle" size={12} color={primary} />}
                    </View>
                    <Text style={[lb.sub, { color: muted }]} numberOfLines={1}>
                      {[p.current_club_name, p.primary_position, p.age != null ? `${p.age}y` : null, p.region].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {/* Metric */}
                  <View style={lb.metricCol}>
                    <AnimatedCounter value={metricValue(p, metric)} style={[lb.metricVal, { color: primary }]} />
                    <Text style={[lb.metricLabel, { color: muted }]}>
                      {METRICS.find(m => m.key === metric)?.label?.toUpperCase()}
                    </Text>
                  </View>
                  {/* OVR */}
                  <View style={[lb.ovrBadge, { borderColor: `${primary}40` }]}>
                    <Text style={[lb.ovrText, { color: primary }]}>{playerOVR(p)}</Text>
                  </View>
                </GlassView>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <PlayerProfileModal visible={!!openPlayer} playerId={openPlayer} onClose={() => setOpenPlayer(null)} />
      </View>
    </Modal>
  );
};

const lb = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 8 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { fontSize: 10, fontWeight: '700', marginTop: 1 },

  filterRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 6, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 13 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10 },
  rankCol: { width: 26, alignItems: 'center' },
  medal: { fontSize: 20 },
  rankNum: { fontSize: 15, fontWeight: '900' },
  photo: { width: 46, height: 46, borderRadius: 12 },
  name: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 11, marginTop: 2 },
  metricCol: { alignItems: 'center', minWidth: 46 },
  metricVal: { fontSize: 19, fontWeight: '900' },
  metricLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.6, marginTop: 1 },
  ovrBadge: { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ovrText: { fontSize: 14, fontWeight: '900' },
});

export default TalentLeaderboardModal;
