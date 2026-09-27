/**
 * TalentLeaderboardModal — the scout engine UI.
 *
 * "Find me the top U-20 striker in Gauteng." Ranks players by any metric
 * (rating/events/goals/awards/fans), filterable by category, age bracket and
 * region, with instant name search. Top 3 stand on a podium; every row reads
 * like a scout card (OVR + a stat strip). Tapping opens the player's career.
 * Backed by TalentEngine.searchTopPlayers → search_top_players() RPC.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  Image, TextInput, Platform, RefreshControl,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { LiquidBackground } from './LiquidBackground';
import { AnimatedCounter } from './Motion';
import { haptics } from '../utils/haptics';
import { PlayerProfileModal } from './PlayerProfileModal';
import { TalentEngine, playerOVR } from '../services/talentEngine';
import { useBackClose } from '../hooks/useBackClose';

const METRICS = [
  { key: 'rating',    label: 'Rating' },
  { key: 'events',    label: 'Events' },
  { key: 'goals',     label: 'Highlights' },
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
const PODIUM_RING = ['#FFD45A', '#C8D2DC', '#E0936A']; // gold / silver / bronze

// Compact stat strip shown on every row (a scout reads more than one number).
const STAT_DEFS = [
  { key: 'rating',    label: 'RTG' },
  { key: 'events',    label: 'EVT' },
  { key: 'goals',     label: 'HLT' },
  { key: 'awards',    label: 'AWD' },
  { key: 'followers', label: 'FAN' },
];

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

const displayName = (p) => p.known_as || p.full_name || 'Unknown';

export const TalentLeaderboardModal = ({ visible, onClose }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || "#1a1f21";

  const [metric, setMetric]   = useState('rating');
  const [category, setCategory] = useState('all');
  const [ageKey, setAgeKey]   = useState('all');
  const [region, setRegion]   = useState('');
  const [query, setQuery]     = useState('');     // instant client-side name filter
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openPlayer, setOpenPlayer] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const ab = AGE_BRACKETS.find(a => a.key === ageKey) || AGE_BRACKETS[0];
    try {
      const data = await TalentEngine.searchTopPlayers({
        metric,
        category: category === 'all' ? null : category,
        region: region.trim() || null,
        minAge: ab.min,
        maxAge: ab.max,
        limit: 50,
      });
      setRows(data || []);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [metric, category, ageKey, region]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  // Instant name filter over the loaded leaderboard.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(p =>
      displayName(p).toLowerCase().includes(q) ||
      (p.current_club_name || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const usePodium = !query.trim() && filtered.length >= 3;
  const top3 = usePodium ? filtered.slice(0, 3) : [];
  const listRows = usePodium ? filtered.slice(3) : filtered;

  const serverFiltered = category !== 'all' || ageKey !== 'all' || !!region.trim();
  const anyFilter = serverFiltered || !!query.trim();

  const resetFilters = () => {
    haptics.light();
    setCategory('all'); setAgeKey('all'); setRegion(''); setQuery('');
  };

  const ageLabel = AGE_BRACKETS.find(a => a.key === ageKey)?.label;

  const Chip = ({ active, onPress, children }) => (
    <TouchableOpacity
      onPress={() => { haptics.select(); onPress(); }}
      style={[lb.chip, { backgroundColor: active ? primary : `${primary}12`, borderColor: active ? primary : `${primary}30` }]}
      activeOpacity={0.85}
    >
      <Text style={[lb.chipText, { color: active ? '#000' : primary }]}>{children}</Text>
    </TouchableOpacity>
  );

  const Avatar = ({ p, size, ring }) => (
    p.photo_url
      ? <Image source={{ uri: p.photo_url }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 0, borderColor: ring }} />
      : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: ring }}>
          <Text style={{ color: primary, fontWeight: '900', fontSize: size * 0.4 }}>{displayName(p)[0].toUpperCase()}</Text>
        </View>
  );

  // ── Podium: 2nd · 1st · 3rd, the winner raised ───────────────────────────
  const Podium = () => (
    <View style={lb.podium}>
      {[1, 0, 2].map((idx) => {
        const p = top3[idx];
        if (!p) return <View key={idx} style={{ flex: 1 }} />;
        const first = idx === 0;
        return (
          <TouchableOpacity
            key={p.id || idx}
            style={[lb.podiumCol, { marginTop: first ? 0 : 22 }]}
            activeOpacity={0.85}
            onPress={() => { haptics.light(); setOpenPlayer(p.id); }}
          >
            <Text style={[lb.podiumMedal, { fontSize: first ? 26 : 20 }]}>{MEDALS[idx]}</Text>
            <Avatar p={p} size={first ? 72 : 56} ring={PODIUM_RING[idx]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 }}>
              <Text style={[lb.podiumName, { color: textColor, maxWidth: first ? 96 : 78 }]} numberOfLines={1}>{displayName(p)}</Text>
              {p.is_verified && <Feather name="check-circle" size={11} color={primary} />}
            </View>
            {!!p.current_club_name && (
              <Text style={[lb.podiumClub, { color: muted }]} numberOfLines={1}>{p.current_club_name}</Text>
            )}
            <GlassView sheen glow={first} intensity={first ? 1.2 : 0.9} style={lb.podiumStat}>
              <AnimatedCounter value={metricValue(p, metric)} style={[lb.podiumVal, { color: primary, fontSize: first ? 22 : 18 }]} />
              <Text style={[lb.metricLabel, { color: muted }]}>{METRICS.find(m => m.key === metric)?.label?.toUpperCase()}</Text>
            </GlassView>
            <View style={[lb.podiumOvr, { backgroundColor: `${primary}18`, borderColor: `${primary}50` }]}>
              <Text style={{ color: primary, fontWeight: '900', fontSize: 11 }}>OVR {playerOVR(p)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── A single ranked row ──────────────────────────────────────────────────
  const Row = ({ p, rank }) => {
    const pills = STAT_DEFS
      .filter(s => s.key !== metric && metricValue(p, s.key) > 0)
      .slice(0, 4);
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => { haptics.light(); setOpenPlayer(p.id); }}>
        <GlassView sheen={false} intensity={0.8} style={lb.row}>
          <View style={lb.rankCol}>
            <Text style={[lb.rankNum, { color: muted }]}>{rank}</Text>
          </View>
          <Avatar p={p} size={46} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[lb.name, { color: textColor }]} numberOfLines={1}>{displayName(p)}</Text>
              {p.is_verified && <Feather name="check-circle" size={12} color={primary} />}
            </View>
            <Text style={[lb.sub, { color: muted }]} numberOfLines={1}>
              {[p.current_club_name, p.headline || p.primary_position, p.age != null ? `${p.age}y` : null, p.region].filter(Boolean).join(' · ') || 'No club yet'}
            </Text>
            {pills.length > 0 && (
              <View style={lb.pillRow}>
                {pills.map(s => (
                  <View key={s.key} style={[lb.miniPill, { backgroundColor: `${primary}0e`, borderColor: `${primary}22` }]}>
                    <Text style={[lb.miniPillText, { color: muted }]}>
                      <Text style={{ color: textColor, fontWeight: '900' }}>{metricValue(p, s.key)}</Text> {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={lb.metricCol}>
            <AnimatedCounter value={metricValue(p, metric)} style={[lb.metricVal, { color: primary }]} />
            <Text style={[lb.metricLabel, { color: muted }]}>{METRICS.find(m => m.key === metric)?.label?.toUpperCase()}</Text>
          </View>
          <View style={[lb.ovrBadge, { borderColor: `${primary}40` }]}>
            <Text style={[lb.ovrText, { color: primary }]}>{playerOVR(p)}</Text>
          </View>
        </GlassView>
      </TouchableOpacity>
    );
  };

  const Skeleton = () => (
    <View style={{ padding: 16 }}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <GlassView key={i} sheen={false} intensity={0.6} style={[lb.row, { opacity: 1 - i * 0.12 }]}>
          <View style={[lb.skelDot, { backgroundColor: `${primary}18` }]} />
          <View style={{ flex: 1, gap: 7 }}>
            <View style={[lb.skelBar, { width: '55%', backgroundColor: `${primary}18` }]} />
            <View style={[lb.skelBar, { width: '78%', backgroundColor: `${primary}0e` }]} />
          </View>
          <View style={[lb.skelPill, { backgroundColor: `${primary}14` }]} />
        </GlassView>
      ))}
    </View>
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
            <Text style={[lb.headerSub, { color: muted }]}>Top talent, ranked</Text>
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

          {/* Name search + region (name filters instantly; region re-queries) */}
          <View style={lb.dualSearch}>
            <View style={[lb.searchWrap, { backgroundColor: surface, borderColor: `${primary}20` }]}>
              <Feather name="search" size={14} color={muted} />
              <TextInput
                style={[lb.searchInput, { color: textColor }]}
                placeholder="Search by name"
                placeholderTextColor={muted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}><Feather name="x" size={14} color={muted} /></TouchableOpacity>
              )}
            </View>
            <View style={[lb.searchWrap, { backgroundColor: surface, borderColor: `${primary}20` }]}>
              <Feather name="map-pin" size={14} color={muted} />
              <TextInput
                style={[lb.searchInput, { color: textColor }]}
                placeholder="Region"
                placeholderTextColor={muted}
                value={region}
                onChangeText={setRegion}
                onSubmitEditing={() => load()}
                returnKeyType="search"
              />
              {region.length > 0 && (
                <TouchableOpacity onPress={() => { setRegion(''); }}><Feather name="x" size={14} color={muted} /></TouchableOpacity>
              )}
            </View>
          </View>

          {/* Result summary */}
          {!loading && (
            <View style={lb.summary}>
              <Text style={[lb.summaryText, { color: muted }]}>
                {filtered.length > 0
                  ? <>Top <Text style={{ color: primary, fontWeight: '900' }}>{filtered.length}</Text>
                      {' · '}{category === 'all' ? 'all talent' : category}{ageKey !== 'all' ? ` · ${ageLabel}` : ''}</>
                  : 'No results'}
              </Text>
              {anyFilter && (
                <TouchableOpacity onPress={resetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: primary, fontSize: 12, fontWeight: '800' }}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* List */}
        {loading ? (
          <Skeleton />
        ) : filtered.length === 0 ? (
          <View style={lb.center}>
            <Feather name={anyFilter ? 'filter' : 'award'} size={40} color={muted} />
            <Text style={[lb.emptyTitle, { color: textColor }]}>
              {anyFilter ? 'No talent matches these filters' : 'The board is still filling up'}
            </Text>
            <Text style={{ color: muted, marginTop: 6, textAlign: 'center', paddingHorizontal: 44, lineHeight: 19 }}>
              {anyFilter
                ? 'Try a wider age bracket, a different category, or clear the search.'
                : 'As people are tagged as guests on events, their reputations build here — ranked by rating, events, highlights, awards and fans.'}
            </Text>
            {anyFilter && (
              <TouchableOpacity onPress={resetFilters} style={[lb.clearBtn, { backgroundColor: primary }]} activeOpacity={0.85}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primary} colors={[primary]} />}
          >
            {usePodium && <Podium />}
            {listRows.map((p, i) => (
              <Row key={p.id || i} p={p} rank={usePodium ? i + 4 : i + 1} />
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

  filterRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 5 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '800' },

  dualSearch: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 6 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 13 },

  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 2 },
  summaryText: { fontSize: 12, fontWeight: '700' },

  emptyTitle: { fontSize: 16, fontWeight: '900', marginTop: 14, textAlign: 'center', paddingHorizontal: 30 },
  clearBtn: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14 },

  // Podium
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingTop: 16, paddingBottom: 18, paddingHorizontal: 4 },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumMedal: { marginBottom: 4 },
  podiumName: { fontSize: 13, fontWeight: '900' },
  podiumClub: { fontSize: 10, fontWeight: '600', marginTop: 1, maxWidth: 96 },
  podiumStat: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, marginTop: 8 },
  podiumVal: { fontWeight: '900' },
  podiumOvr: { marginTop: 7, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9, borderWidth: 1 },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10, borderRadius: 16 },
  rankCol: { width: 22, alignItems: 'center' },
  rankNum: { fontSize: 15, fontWeight: '900' },
  name: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 11, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  miniPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1 },
  miniPillText: { fontSize: 10, fontWeight: '700' },
  metricCol: { alignItems: 'center', minWidth: 44 },
  metricVal: { fontSize: 19, fontWeight: '900' },
  metricLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.6, marginTop: 1 },
  ovrBadge: { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ovrText: { fontSize: 14, fontWeight: '900' },

  // Skeleton
  skelDot: { width: 46, height: 46, borderRadius: 23 },
  skelBar: { height: 11, borderRadius: 6 },
  skelPill: { width: 40, height: 30, borderRadius: 9 },
});

export default TalentLeaderboardModal;
