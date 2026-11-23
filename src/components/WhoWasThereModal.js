import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { SmartImage } from './SmartImage';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { likeContains } from '../utils/sanitize';
import { isOnline as checkOnline, BlockManager } from '../services/dataFlow';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { useBackClose } from '../hooks/useBackClose';
import { personScore } from '../services/peopleScore';
import { deferred } from '../utils/deferred';

// Deferred imports break the circular dependency cycle between WhoWasThereModal <-> ViberProfileModal <-> DirectMessageModal
const DirectMessageModal = deferred(() => require('./DirectMessageModal').DirectMessageModal, 'DirectMessageModal');
const ViberProfileModal = deferred(() => require('./ViberProfileModal').ViberProfileModal, 'ViberProfileModal');

const avatarBg = (u = '') =>
  ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777'][(u.charCodeAt(0) || 0) % 5];

const GENDERS = [
  { key: 'male', label: '♂ Male' },
  { key: 'female', label: '♀ Female' },
  { key: 'non_binary', label: '⚧ Non-binary' },
  { key: 'any', label: 'Any' },
];

const HAIR_STYLES = [
  'Short', 'Long', 'Medium', 'Bald', 'Locs/Dreads', 'Braids', 'Natural/Afro',
  'Weave', 'Relaxed', 'Coloured', 'Curly', 'Wavy', 'Straight', 'Faded',
];

const BODY_TYPES = ['Slim', 'Athletic', 'Average', 'Curvy', 'Plus Size', 'Tall', 'Short', 'Muscular'];

const SKIN_TONES = [
  { key: 'very_light', label: 'Very Light', color: '#fddbc4' },
  { key: 'light', label: 'Light', color: '#f1c89b' },
  { key: 'medium', label: 'Medium', color: '#c8926b' },
  { key: 'tan', label: 'Tan/Olive', color: '#9c6b42' },
  { key: 'brown', label: 'Brown', color: '#7c4a28' },
  { key: 'dark', label: 'Dark Brown', color: '#4a2712' },
  { key: 'deep', label: 'Deep/Ebony', color: '#2d1408' },
];

const OUTFIT_VIBES = [
  'Casual', 'Smart Casual', 'Formal', 'Party/Glam', 'Streetwear', 'Sporty',
  'Traditional', 'Vintage', 'Punk/Alt', 'Business', 'Beach', 'Festival',
];

const APPROXIMATE_AGES = [
  { key: 'teens', label: '16–19' },
  { key: 'twenties', label: '20–29' },
  { key: 'thirties', label: '30–39' },
  { key: 'forties', label: '40–49' },
  { key: 'fifty_plus', label: '50+' },
];

const CHRONO_PRESETS = [
  { key: '2h', label: '⚡ Last 2h', hours: 2 },
  { key: 'tonight', label: '🌙 Tonight (8h)', hours: 8 },
  { key: '24h', label: '🔥 Last Night (24h)', hours: 24 },
  { key: 'weekend', label: '🎉 Weekend (72h)', hours: 72 },
  { key: '7d', label: '🛰️ 7 Days', hours: 168 },
];

const DEFAULT_HOTSPOTS = [
  'All Venues',
  'Konka Soweto',
  'Taboo Sandton',
  'Zone 6 Venue',
  'Maboneng Precinct',
  'Kitcheners Braam',
];

const safeDate = (d, fallback) =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d : fallback || new Date();

const toLocalDatetimeString = (date) => {
  const valid = safeDate(date, new Date());
  const d = new Date(valid.getTime() - valid.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const formatDisplayWindow = (date) => {
  const d = safeDate(date, new Date());
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ChipRow = ({ label, options, selected, onSelect, renderLabel, primary, muted }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={[s.filterLabel, { color: muted }]}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {options.map((opt) => {
        const key = typeof opt === 'string' ? opt : opt.key;
        const display = renderLabel ? renderLabel(opt) : typeof opt === 'string' ? opt : opt.label;
        const isActive = selected === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect?.(isActive ? null : key)}
            style={[
              s.chip,
              {
                backgroundColor: isActive ? primary : `${primary}12`,
                borderColor: isActive ? primary : `${primary}25`,
              },
            ]}
          >
            {typeof opt === 'object' && opt.color && <View style={[s.skinDot, { backgroundColor: opt.color }]} />}
            <Text style={[s.chipText, { color: isActive ? '#000' : primary }]}>{display}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

export function WhoWasThereModal({ visible, onClose, onAuthRequired }) {
  useBackClose(visible, onClose);
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const { applyProfilePrivacy } = useIdentity();

  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const surface = currentTheme?.surface || '#1a1f21';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';

  const [venue, setVenue] = useState('');
  const [presetKey, setPresetKey] = useState('24h');
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 24 * 3600 * 1000));
  const [toDate, setToDate] = useState(() => new Date());
  const [hotspots, setHotspots] = useState(DEFAULT_HOTSPOTS);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [msgTarget, setMsgTarget] = useState(null);
  const [msgVisible, setMsgVisible] = useState(false);
  const [selectedViber, setSelectedViber] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [wavedIds, setWavedIds] = useState({});

  // Investigation filters
  const [filterGender, setFilterGender] = useState(null);
  const [filterHair, setFilterHair] = useState(null);
  const [filterBodyType, setFilterBodyType] = useState(null);
  const [filterSkinTone, setFilterSkinTone] = useState(null);
  const [filterOutfit, setFilterOutfit] = useState(null);
  const [filterAgeRange, setFilterAgeRange] = useState(null);
  const [filterUsername, setFilterUsername] = useState('');

  // Holographic radar pulse animation
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulseAnim]);

  // Populate live hotspot venue pills from active events
  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('events')
          .select('venue_name')
          .not('venue_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(12);
        const names = [...new Set((data || []).map((r) => (r.venue_name || '').trim()).filter(Boolean))];
        if (mounted && names.length > 0) {
          setHotspots(['All Venues', ...names.slice(0, 6)]);
        }
      } catch {
        /* keep default hotspots */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [visible]);

  const activeFilterCount =
    [filterGender, filterHair, filterBodyType, filterSkinTone, filterOutfit, filterAgeRange].filter(Boolean).length +
    (filterUsername.trim() ? 1 : 0);

  const applyPreset = (preset) => {
    const now = new Date();
    setPresetKey(preset.key);
    setFromDate(new Date(now.getTime() - preset.hours * 3600 * 1000));
    setToDate(now);
  };

  const shiftFromHours = (deltaHours) => {
    setPresetKey('custom');
    setFromDate((prev) => {
      const base = safeDate(prev, new Date());
      return new Date(base.getTime() + deltaHours * 3600 * 1000);
    });
  };

  const search = useCallback(async () => {
    if (!user) {
      onAuthRequired?.();
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const validFrom = safeDate(fromDate, new Date(Date.now() - 24 * 3600 * 1000));
      const validTo = safeDate(toDate, new Date());
      const since = (validFrom < validTo ? validFrom : validTo).toISOString();
      const until = (validFrom < validTo ? validTo : validFrom).toISOString();

      const fullSelect = `
        user_id,
        venue_name,
        event_id,
        checked_in_at,
        profiles:user_id (id, username, avatar_url, bio, vibe_score, is_online, last_seen, is_verified,
          gender, hair_style, body_type, skin_tone, outfit_vibe, age_range, display_name,
          identity_mode, is_beacon_active, interests)
      `;
      const coreSelect = `
        user_id,
        venue_name,
        event_id,
        checked_in_at,
        profiles:user_id (id, username, avatar_url, bio, vibe_score, is_online, last_seen, is_verified, gender, display_name)
      `;

      let rows = [];
      let qb = supabase
        .from('live_checkins')
        .select(fullSelect)
        .gte('checked_in_at', since)
        .lte('checked_in_at', until)
        .neq('user_id', user.id)
        .order('checked_in_at', { ascending: false })
        .limit(100);
      if (venue.trim()) qb = qb.ilike('venue_name', likeContains(venue));

      const tier1 = await qb;
      if (!tier1.error && Array.isArray(tier1.data)) {
        rows = tier1.data;
      } else {
        // Tier 2 fallback: core guaranteed profile columns if optional descriptor columns don't exist yet
        let qb2 = supabase
          .from('live_checkins')
          .select(coreSelect)
          .gte('checked_in_at', since)
          .lte('checked_in_at', until)
          .neq('user_id', user.id)
          .order('checked_in_at', { ascending: false })
          .limit(80);
        if (venue.trim()) qb2 = qb2.ilike('venue_name', likeContains(venue));
        const tier2 = await qb2;
        if (!tier2.error && Array.isArray(tier2.data)) {
          rows = tier2.data;
        }
      }

      // Tier 3 supplement: also surface recent event attendees / RSVPs if checkins are sparse
      if (rows.length < 5) {
        try {
          const { data: rsvpRows } = await supabase
            .from('event_rsvps')
            .select(`
              user_id,
              created_at,
              events:event_id (venue_name, title),
              profiles:user_id (id, username, avatar_url, bio, vibe_score, is_online, last_seen, is_verified, gender, display_name)
            `)
            .neq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(35);
          for (const r of rsvpRows || []) {
            const vName = r.events?.venue_name || r.events?.title || '';
            if (venue.trim() && !vName.toLowerCase().includes(venue.trim().toLowerCase())) continue;
            if (r.profiles) {
              rows.push({
                user_id: r.user_id,
                venue_name: vName || 'Nearby Event',
                checked_in_at: r.created_at,
                profiles: r.profiles,
                _signalType: 'RSVP Signal',
              });
            }
          }
        } catch {
          /* non-fatal fallback */
        }
      }

      const blocked = new Set(await BlockManager.getBlockedIds(user.id).catch(() => []));
      const seen = new Set();
      let unique = [];

      for (const row of rows) {
        if (blocked.has(row.user_id)) continue;
        const mode = row.profiles?.identity_mode;
        if (mode === 'ghost') continue;
        if (mode === 'celebrity' && !row.profiles?.is_beacon_active) continue;
        if (!seen.has(row.user_id) && row.profiles) {
          seen.add(row.user_id);
          const privateProfile = applyProfilePrivacy ? applyProfilePrivacy(row.profiles, row.user_id) : row.profiles;
          if (privateProfile) {
            unique.push({
              ...privateProfile,
              venue_name: row.venue_name,
              checkin_at: row.checked_in_at,
              signal_type: row._signalType || 'Verified Touch Down',
            });
          }
        }
      }

      // Client-side descriptor filtering (permissive when descriptor not populated on peer profile)
      if (filterGender && filterGender !== 'any') {
        unique = unique.filter((u) => !u.gender || u.gender === filterGender);
      }
      if (filterHair) {
        unique = unique.filter((u) => !u.hair_style || u.hair_style?.toLowerCase().includes(filterHair.toLowerCase()));
      }
      if (filterBodyType) {
        unique = unique.filter((u) => !u.body_type || u.body_type === filterBodyType);
      }
      if (filterSkinTone) {
        unique = unique.filter((u) => !u.skin_tone || u.skin_tone === filterSkinTone);
      }
      if (filterOutfit) {
        unique = unique.filter((u) => !u.outfit_vibe || u.outfit_vibe === filterOutfit);
      }
      if (filterAgeRange) {
        unique = unique.filter((u) => !u.age_range || u.age_range === filterAgeRange);
      }
      if (filterUsername.trim()) {
        const q = filterUsername.trim().toLowerCase();
        unique = unique.filter(
          (u) => u.username?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q)
        );
      }

      const confirmedMatches = (u) => {
        let k = 0;
        if (filterGender && filterGender !== 'any' && u.gender) k++;
        if (filterHair && u.hair_style) k++;
        if (filterBodyType && u.body_type) k++;
        if (filterSkinTone && u.skin_tone) k++;
        if (filterOutfit && u.outfit_vibe) k++;
        if (filterAgeRange && u.age_range) k++;
        return k;
      };
      const viewer = { id: user?.id, interests: profile?.interests, lat: profile?.lat, lon: profile?.lon };
      unique = unique
        .map((u) => {
          const score = personScore ? personScore(viewer, u) : 50;
          const matchPct = Math.min(99, Math.max(62, Math.round(62 + (score % 37))));
          return { ...u, _confirmed: confirmedMatches(u), _personScore: score, _matchPct: matchPct };
        })
        .sort((a, b) => b._confirmed - a._confirmed || b._personScore - a._personScore);

      setResults(unique);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [
    user,
    profile,
    venue,
    fromDate,
    toDate,
    filterGender,
    filterHair,
    filterBodyType,
    filterSkinTone,
    filterOutfit,
    filterAgeRange,
    filterUsername,
    applyProfilePrivacy,
    onAuthRequired,
  ]);

  const fmtAge = (ts) => {
    if (!ts) return '';
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (Number.isNaN(diff) || diff < 0) return 'recent';
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const clearFilters = () => {
    setFilterGender(null);
    setFilterHair(null);
    setFilterBodyType(null);
    setFilterSkinTone(null);
    setFilterOutfit(null);
    setFilterAgeRange(null);
    setFilterUsername('');
  };

  const reset = () => {
    setVenue('');
    setResults([]);
    setHasSearched(false);
    applyPreset(CHRONO_PRESETS[2]);
    clearFilters();
  };

  const ringScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] });
  const ringOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0.1] });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.screen, { backgroundColor: bg, paddingTop: insets.top }]}>
        {/* Futuristic Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={20} color={textColor} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: textColor }]}>Who Was There · Chrono-Radar</Text>
            <Text style={[s.sub, { color: primary }]}>Holographic Temporal Presence & Match Scanner</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters((f) => !f)}
            style={[
              s.filterToggle,
              {
                backgroundColor: activeFilterCount > 0 ? `${primary}20` : `${surface}80`,
                borderColor: activeFilterCount > 0 ? primary : `${primary}25`,
              },
            ]}
          >
            <Feather name="sliders" size={14} color={activeFilterCount > 0 ? primary : muted} />
            <Text style={[s.filterToggleText, { color: activeFilterCount > 0 ? primary : muted }]}>
              DNA{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
          {hasSearched && (
            <TouchableOpacity onPress={reset} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="rotate-ccw" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Holographic Chrono-Radar Visualizer HUD */}
          <View style={[s.radarCard, { borderColor: `${primary}35`, backgroundColor: `${surface}90` }]}>
            <View style={s.radarVisualWrap}>
              <Animated.View
                style={[
                  s.radarRing,
                  { borderColor: primary, opacity: ringOpacity, transform: [{ scale: ringScale }] },
                ]}
              />
              <View style={[s.radarRingInner, { borderColor: `${primary}50` }]} />
              <View style={[s.radarCore, { backgroundColor: `${primary}25`, borderColor: primary }]}>
                <Feather name="radio" size={20} color={primary} />
              </View>
              {results.slice(0, 5).map((r, i) => {
                const angles = [25, 110, 195, 265, 325];
                const rad = (angles[i] * Math.PI) / 180;
                const dist = 30 + (i % 2) * 14;
                return (
                  <View
                    key={r.id || i}
                    style={[
                      s.blipDot,
                      {
                        backgroundColor: i === 0 ? '#10b981' : primary,
                        transform: [{ translateX: Math.cos(rad) * dist }, { translateY: Math.sin(rad) * dist }],
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
                TEMPORAL FOOTPRINT SCANNER
              </Text>
              <Text style={{ color: textColor, fontSize: 13, fontWeight: '800' }}>
                {hasSearched
                  ? `${results.length} verified presence signal${results.length === 1 ? '' : 's'} locked`
                  : 'Lock onto any venue & time slice'}
              </Text>
              <Text style={{ color: muted, fontSize: 11, lineHeight: 15 }}>
                {formatDisplayWindow(fromDate)} → {formatDisplayWindow(toDate)}
              </Text>
            </View>
          </View>

          {/* Hotspot Quick-Select Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, marginBottom: 10 }}
          >
            {hotspots.map((spot) => {
              const active = (spot === 'All Venues' && !venue.trim()) || venue.trim() === spot;
              return (
                <TouchableOpacity
                  key={spot}
                  onPress={() => setVenue(spot === 'All Venues' ? '' : spot)}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? `${primary}22` : `${surface}80`,
                      borderColor: active ? primary : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                >
                  <Feather name="map-pin" size={11} color={active ? primary : muted} />
                  <Text style={[s.chipText, { color: active ? primary : textColor }]}>{spot}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Venue search */}
          <View style={[s.inputWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80` }]}>
            <Feather name="map-pin" size={16} color={venue ? primary : muted} />
            <TextInput
              style={[s.input, { color: textColor }]}
              placeholder="Or type venue name (e.g. Konka, Taboo)..."
              placeholderTextColor={muted}
              value={venue}
              onChangeText={setVenue}
              returnKeyType="search"
              onSubmitEditing={search}
            />
            {venue.length > 0 && (
              <TouchableOpacity onPress={() => setVenue('')}>
                <Feather name="x" size={14} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Futuristic Chrono-Warp Presets */}
          <Text style={[s.sectionLabel, { color: muted }]}>CHRONO-WARP TIME WINDOW</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, marginBottom: 10 }}
          >
            {CHRONO_PRESETS.map((p) => {
              const active = presetKey === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => applyPreset(p)}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? primary : `${surface}80`,
                      borderColor: active ? primary : `${primary}25`,
                    },
                  ]}
                >
                  <Text style={[s.chipText, { color: active ? '#000' : textColor }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Safe Fine-Tune Steppers (no crash-prone partial date string input on mobile) */}
          <View style={[s.windowBar, { borderColor: `${primary}20`, backgroundColor: `${surface}70` }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, fontSize: 10, fontWeight: '800' }}>ACTIVE SCAN RANGE</Text>
              <Text style={{ color: textColor, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                {toLocalDatetimeString(fromDate).replace('T', ' ')} → {toLocalDatetimeString(toDate).replace('T', ' ')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity onPress={() => shiftFromHours(-3)} style={[s.stepBtn, { borderColor: `${primary}35` }]}>
                <Text style={{ color: primary, fontSize: 11, fontWeight: '900' }}>-3h</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shiftFromHours(-24)} style={[s.stepBtn, { borderColor: `${primary}35` }]}>
                <Text style={{ color: primary, fontSize: 11, fontWeight: '900' }}>-1d</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Investigation DNA Filters */}
          {showFilters && (
            <View style={[s.filtersBox, { backgroundColor: `${surface}60`, borderColor: `${primary}15` }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[s.filtersTitle, { color: textColor }]}>🔍 Vibe & Appearance Signature</Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[s.filterLabel, { color: muted }]}>Username / Handle</Text>
              <View style={[s.inputWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80`, marginBottom: 14, marginHorizontal: 0 }]}>
                <Feather name="search" size={14} color={muted} />
                <TextInput
                  style={[s.input, { color: textColor }]}
                  placeholder="@username or display name..."
                  placeholderTextColor={muted}
                  value={filterUsername}
                  onChangeText={setFilterUsername}
                />
              </View>

              <ChipRow label="Gender" options={GENDERS} selected={filterGender} onSelect={setFilterGender} primary={primary} muted={muted} />
              <ChipRow label="Approximate Age" options={APPROXIMATE_AGES} selected={filterAgeRange} onSelect={setFilterAgeRange} primary={primary} muted={muted} />
              <ChipRow label="Skin Tone" options={SKIN_TONES} selected={filterSkinTone} onSelect={setFilterSkinTone} primary={primary} muted={muted} />
              <ChipRow label="Hair Style" options={HAIR_STYLES} selected={filterHair} onSelect={setFilterHair} primary={primary} muted={muted} />
              <ChipRow label="Body Type" options={BODY_TYPES} selected={filterBodyType} onSelect={setFilterBodyType} primary={primary} muted={muted} />
              <ChipRow label="Outfit Vibe" options={OUTFIT_VIBES} selected={filterOutfit} onSelect={setFilterOutfit} primary={primary} muted={muted} />
            </View>
          )}

          {/* Scan CTA Button */}
          <TouchableOpacity
            style={[s.searchBtn, { backgroundColor: primary, marginTop: 4 }]}
            onPress={search}
            activeOpacity={0.85}
          >
            <Feather name="crosshair" size={16} color="#000" />
            <Text style={s.searchBtnText}>
              Scan Presence Radar{activeFilterCount > 0 ? ` (${activeFilterCount} DNA filters)` : ''}
            </Text>
          </TouchableOpacity>

          {/* Results */}
          {loading ? (
            <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={{ color: primary, fontSize: 13, fontWeight: '700' }}>Triangulating check-ins & signals...</Text>
            </View>
          ) : hasSearched ? (
            results.length === 0 ? (
              <View style={s.empty}>
                <Feather name="clock" size={40} color={muted} style={{ opacity: 0.4 }} />
                <Text style={[s.emptyTitle, { color: textColor }]}>No signals detected in slice</Text>
                <Text style={[s.emptySub, { color: muted }]}>
                  No public check-ins matched "{venue || 'All Venues'}" in this Chrono-Warp window.
                  {'\n'}Try tapping "🛰️ 7 Days" or "All Venues".
                </Text>
              </View>
            ) : (
              <View>
                <Text style={[s.resultHeader, { color: muted, paddingHorizontal: 16 }]}>
                  {results.length} Signal{results.length !== 1 ? 's' : ''} · {venue || 'All Venues'}
                </Text>
                {results.map((item) => {
                  const waved = !!wavedIds[item.id];
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        s.row,
                        {
                          backgroundColor: surface,
                          borderColor: checkOnline(item) ? `${primary}45` : 'rgba(255,255,255,0.08)',
                          marginHorizontal: 16,
                          marginBottom: 8,
                        },
                      ]}
                      onPress={() => {
                        setSelectedViber(item);
                        setProfileVisible(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ position: 'relative' }}>
                        {item.avatar_url ? (
                          <SmartImage source={item.avatar_url} style={s.avatar} />
                        ) : (
                          <View style={[s.avatar, { backgroundColor: avatarBg(item.username), alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                              {(item.username || 'V')[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {checkOnline(item) && <View style={[s.onlineDot, { borderColor: surface }]} />}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[s.username, { color: textColor }]} numberOfLines={1}>
                            @{item.username || item.display_name || 'viber'}
                          </Text>
                          {item.is_verified && <Feather name="check-circle" size={11} color={primary} />}
                          <View style={[s.matchPill, { backgroundColor: `${primary}18`, borderColor: `${primary}40` }]}>
                            <Text style={{ color: primary, fontSize: 9, fontWeight: '900' }}>
                              {item._matchPct}% MATCH
                            </Text>
                          </View>
                        </View>
                        {item.venue_name ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Feather name="map-pin" size={9} color="#f97316" />
                            <Text style={[s.venueName, { color: '#f97316' }]} numberOfLines={1}>
                              {item.venue_name} · {item.signal_type}
                            </Text>
                          </View>
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                          {item.gender && <Text style={[s.tag, { color: muted }]}>{item.gender}</Text>}
                          {item.hair_style && <Text style={[s.tag, { color: muted }]}>{item.hair_style} hair</Text>}
                          {item.outfit_vibe && <Text style={[s.tag, { color: muted }]}>{item.outfit_vibe}</Text>}
                        </View>
                        <Text style={[s.checkinTime, { color: muted }]}>{fmtAge(item.checkin_at)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={[
                            s.msgBtn,
                            {
                              backgroundColor: waved ? '#10b98125' : 'rgba(255,255,255,0.06)',
                              borderColor: waved ? '#10b981' : 'rgba(255,255,255,0.14)',
                            },
                          ]}
                          onPress={() => setWavedIds((prev) => ({ ...prev, [item.id]: true }))}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                          <Feather name={waved ? 'check' : 'zap'} size={15} color={waved ? '#10b981' : '#f59e0b'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.msgBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
                          onPress={() => {
                            setMsgTarget(item);
                            setMsgVisible(true);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                        >
                          <Feather name="message-circle" size={16} color={primary} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <View style={{ height: 120 }} />
              </View>
            )
          ) : (
            <View style={s.hint}>
              <Feather name="crosshair" size={44} color={primary} style={{ opacity: 0.45 }} />
              <Text style={[s.hintTitle, { color: textColor }]}>Holographic Chrono-Radar Ready</Text>
              <Text style={[s.hintSub, { color: muted }]}>
                Pick a hotspot venue, tap a Chrono-Warp time window, or open DNA filters to pinpoint who crossed paths with you at that spot.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {profileVisible && (
        <ViberProfileModal
          visible={profileVisible}
          user={selectedViber}
          userId={selectedViber?.id}
          onClose={() => setProfileVisible(false)}
        />
      )}

      {msgVisible && msgTarget && (
        <DirectMessageModal
          visible={msgVisible}
          onClose={() => {
            setMsgVisible(false);
            setMsgTarget(null);
          }}
          recipient={msgTarget}
        />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  sub: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterToggleText: { fontSize: 11, fontWeight: '800' },
  radarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  radarVisualWrap: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
  },
  radarRingInner: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
  },
  radarCore: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blipDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  sectionLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14 },
  windowBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  stepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filtersBox: { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, borderWidth: 1, padding: 16 },
  filtersTitle: { fontSize: 14, fontWeight: '900' },
  filterLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  chipText: { fontSize: 11, fontWeight: '800' },
  skinDot: { width: 12, height: 12, borderRadius: 6 },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 13,
    borderRadius: 22,
  },
  searchBtnText: { color: '#000', fontSize: 14, fontWeight: '900' },
  resultHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
  },
  username: { fontSize: 14, fontWeight: '800' },
  matchPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  venueName: { fontSize: 10, fontWeight: '800' },
  tag: { fontSize: 9, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  checkinTime: { fontSize: 10, fontWeight: '600' },
  msgBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 12, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  hint: { alignItems: 'center', paddingTop: 32, gap: 14, paddingHorizontal: 24, paddingBottom: 60 },
  hintTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  hintSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
