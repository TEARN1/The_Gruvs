import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform, TextInput, ScrollView } from 'react-native';
import { SmartImage } from './SmartImage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { isOnline as checkOnline, BlockManager } from '../services/dataFlow';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { DirectMessageModal } from './DirectMessageModal';
import { ViberProfileModal } from './ViberProfileModal';
import { useBackClose } from '../hooks/useBackClose';

const avatarBg = (u = '') =>
  ["#0891b2", "#7c3aed", "#059669", "#d97706", "#db2777"][(u.charCodeAt(0) || 0) % 5];


const GENDERS = [
  { key: 'male',        label: '♂ Male' },
  { key: 'female',      label: '♀ Female' },
  { key: 'non_binary',  label: '⚧ Non-binary' },
  { key: 'any',         label: 'Any' },
];

const HAIR_STYLES = [
  'Short', 'Long', 'Medium', 'Bald', 'Locs/Dreads', 'Braids', 'Natural/Afro',
  'Weave', 'Relaxed', 'Coloured', 'Curly', 'Wavy', 'Straight', 'Faded',
];

const BODY_TYPES = ['Slim', 'Athletic', 'Average', 'Curvy', 'Plus Size', 'Tall', 'Short', 'Muscular'];

const SKIN_TONES = [
  { key: 'very_light', label: 'Very Light', color: "#fddbc4" },
  { key: 'light',      label: 'Light',      color: "#f1c89b" },
  { key: 'medium',     label: 'Medium',     color: "#c8926b" },
  { key: 'tan',        label: 'Tan/Olive',  color: "#9c6b42" },
  { key: 'brown',      label: 'Brown',      color: "#7c4a28" },
  { key: 'dark',       label: 'Dark Brown', color: "#4a2712" },
  { key: 'deep',       label: 'Deep/Ebony', color: "#2d1408" },
];

const OUTFIT_VIBES = [
  'Casual', 'Smart Casual', 'Formal', 'Party/Glam', 'Streetwear', 'Sporty',
  'Traditional', 'Vintage', 'Punk/Alt', 'Business', 'Beach', 'Festival',
];

const APPROXIMATE_AGES = [
  { key: 'teens',     label: '16–19' },
  { key: 'twenties',  label: '20–29' },
  { key: 'thirties',  label: '30–39' },
  { key: 'forties',   label: '40–49' },
  { key: 'fifty_plus',label: '50+' },
];

const ChipRow = ({ label, options, selected, onSelect, renderLabel, primary, muted }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={[s.filterLabel, { color: muted }]}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {options.map(opt => {
        const key = typeof opt === 'string' ? opt : opt.key;
        const display = renderLabel ? renderLabel(opt) : (typeof opt === 'string' ? opt : opt.label);
        const isActive = selected === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(isActive ? null : key)}
            style={[s.chip, {
              backgroundColor: isActive ? primary : `${primary}12`,
              borderColor: isActive ? primary : `${primary}25`,
            }]}
          >
            {typeof opt === 'object' && opt.color && (
              <View style={[s.skinDot, { backgroundColor: opt.color }]} />
            )}
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
  const { user } = useAuth();
  const { applyProfilePrivacy } = useIdentity();

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const surface   = currentTheme?.surface    || "#1a1f21";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [venue,    setVenue]    = useState('');
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setHours(d.getHours() - 2); return d; });
  const [toDate,   setToDate]   = useState(() => new Date());
  const [results,  setResults]  = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [hasSearched,    setHasSearched]    = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);
  const [msgTarget,      setMsgTarget]      = useState(null);
  const [msgVisible,     setMsgVisible]     = useState(false);
  const [selectedViber,  setSelectedViber]  = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);

  // Investigation filters
  const [filterGender,    setFilterGender]    = useState(null);
  const [filterHair,      setFilterHair]      = useState(null);
  const [filterBodyType,  setFilterBodyType]  = useState(null);
  const [filterSkinTone,  setFilterSkinTone]  = useState(null);
  const [filterOutfit,    setFilterOutfit]    = useState(null);
  const [filterAgeRange,  setFilterAgeRange]  = useState(null);
  const [filterUsername,  setFilterUsername]  = useState('');

  const activeFilterCount = [filterGender, filterHair, filterBodyType, filterSkinTone, filterOutfit, filterAgeRange]
    .filter(Boolean).length + (filterUsername.trim() ? 1 : 0);

  const search = useCallback(async () => {
    if (!user) { onAuthRequired?.(); return; }
    setLoading(true);
    setHasSearched(true);
    try {
      const since = (fromDate < toDate ? fromDate : toDate).toISOString();
      const until = (fromDate < toDate ? toDate : fromDate).toISOString();

      let qb = supabase
        .from('live_checkins')
        .select(`
          user_id,
          venue_name,
          event_id,
          checked_in_at,
          profiles:user_id (id, username, avatar_url, bio, vibe_score, is_online, last_seen, is_verified,
            gender, hair_style, body_type, skin_tone, outfit_vibe, age_range, display_name,
            identity_mode, is_beacon_active)
        `)
        .gte('checked_in_at', since)
        .lte('checked_in_at', until)
        .neq('user_id', user?.id)
        .order('checked_in_at', { ascending: false })
        .limit(100);

      if (venue.trim()) {
        qb = qb.ilike('venue_name', `%${venue.trim()}%`);
      }

      const { data, error } = await qb;
      if (error) throw error;

      // Block is absolute: anyone the user blocked never shows in Who Was There.
      const blocked = new Set(await BlockManager.getBlockedIds(user.id).catch(() => []));

      const seen = new Set();
      let unique = [];
      for (const row of (data || [])) {
        if (blocked.has(row.user_id)) continue;
        // Ghosts chose anonymity and Incognito is hidden unless they Drop a Beacon —
        // neither is investigable in Who Was There.
        const mode = row.profiles?.identity_mode;
        if (mode === 'ghost') continue;
        if (mode === 'celebrity' && !row.profiles?.is_beacon_active) continue;
        if (!seen.has(row.user_id) && row.profiles) {
          seen.add(row.user_id);
          const privateProfile = applyProfilePrivacy(row.profiles, row.user_id);
          if (privateProfile) {
            unique.push({
              ...privateProfile,
              venue_name: row.venue_name,
              checkin_at: row.checked_in_at,
            });
          }
        }
      }

      // Client-side filter by investigation descriptors (stored in profiles table if set)
      if (filterGender && filterGender !== 'any') {
        unique = unique.filter(u => !u.gender || u.gender === filterGender);
      }
      if (filterHair) {
        unique = unique.filter(u => !u.hair_style || u.hair_style?.toLowerCase().includes(filterHair.toLowerCase()));
      }
      if (filterBodyType) {
        unique = unique.filter(u => !u.body_type || u.body_type === filterBodyType);
      }
      if (filterSkinTone) {
        unique = unique.filter(u => !u.skin_tone || u.skin_tone === filterSkinTone);
      }
      if (filterOutfit) {
        unique = unique.filter(u => !u.outfit_vibe || u.outfit_vibe === filterOutfit);
      }
      if (filterAgeRange) {
        unique = unique.filter(u => !u.age_range || u.age_range === filterAgeRange);
      }
      if (filterUsername.trim()) {
        const q = filterUsername.trim().toLowerCase();
        unique = unique.filter(u => u.username?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q));
      }

      setResults(unique);
    } catch { setResults([]); } finally {
      setLoading(false);
    }
  }, [user, venue, fromDate, toDate, filterGender, filterHair, filterBodyType, filterSkinTone, filterOutfit, filterAgeRange, filterUsername]);

  const fmtAge = (ts) => {
    if (!ts) return '';
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const clearFilters = () => {
    setFilterGender(null); setFilterHair(null); setFilterBodyType(null);
    setFilterSkinTone(null); setFilterOutfit(null); setFilterAgeRange(null);
    setFilterUsername('');
  };

  const reset = () => {
    setVenue('');
    setResults([]);
    setHasSearched(false);
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000);
    setFromDate(twoHoursAgo);
    setToDate(now);
    clearFilters();
  };

  const toLocalDatetimeString = (date) => {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  };


  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[s.screen, { backgroundColor: bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={20} color={textColor} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: textColor }]}>Who Was There?</Text>
            <Text style={[s.sub, { color: muted }]}>Find Vibers at a place & time</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(f => !f)}
            style={[s.filterToggle, {
              backgroundColor: activeFilterCount > 0 ? `${primary}20` : `${surface}80`,
              borderColor: activeFilterCount > 0 ? primary : `${primary}25`,
            }]}
          >
            <Feather name="sliders" size={14} color={activeFilterCount > 0 ? primary : muted} />
            <Text style={[s.filterToggleText, { color: activeFilterCount > 0 ? primary : muted }]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
          {hasSearched && (
            <TouchableOpacity onPress={reset} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="rotate-ccw" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Venue search */}
          <View style={[s.inputWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80` }]}>
            <Feather name="map-pin" size={16} color={venue ? primary : muted} />
            <TextInput
              style={[s.input, { color: textColor }]}
              placeholder="Venue name (e.g. Taboo, FNB Stadium)..."
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

          {/* Date & Time Range */}
          <Text style={[s.sectionLabel, { color: muted }]}>Date & Time Range</Text>
          <View style={{ paddingHorizontal: 16, gap: 10, marginBottom: 14 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>FROM</Text>
              {Platform.OS === 'web' ? (
                <View style={[s.dtWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80` }]}>
                  <Feather name="clock" size={14} color={primary} />
                  <input
                    type="datetime-local"
                    value={toLocalDatetimeString(fromDate)}
                    onChange={e => e.target.value && setFromDate(new Date(e.target.value))}
                    style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 0 }}
                  />
                </View>
              ) : (
                <View style={[s.dtWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80` }]}>
                  <Feather name="clock" size={14} color={primary} />
                  <TextInput
                    style={[s.input, { color: textColor }]}
                    placeholder="YYYY-MM-DD HH:MM"
                    placeholderTextColor={muted}
                    value={toLocalDatetimeString(fromDate).replace('T', ' ')}
                    onChangeText={v => { const d = new Date(v); if (!isNaN(d)) setFromDate(d); }}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              )}
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>TO</Text>
              {Platform.OS === 'web' ? (
                <View style={[s.dtWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80` }]}>
                  <Feather name="clock" size={14} color={primary} />
                  <input
                    type="datetime-local"
                    value={toLocalDatetimeString(toDate)}
                    onChange={e => e.target.value && setToDate(new Date(e.target.value))}
                    style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 0 }}
                  />
                </View>
              ) : (
                <View style={[s.dtWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80` }]}>
                  <Feather name="clock" size={14} color={primary} />
                  <TextInput
                    style={[s.input, { color: textColor }]}
                    placeholder="YYYY-MM-DD HH:MM"
                    placeholderTextColor={muted}
                    value={toLocalDatetimeString(toDate).replace('T', ' ')}
                    onChangeText={v => { const d = new Date(v); if (!isNaN(d)) setToDate(d); }}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              )}
            </View>
          </View>

          {/* Investigation Filters */}
          {showFilters && (
            <View style={[s.filtersBox, { backgroundColor: `${surface}60`, borderColor: `${primary}15` }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[s.filtersTitle, { color: textColor }]}>🔍 Description Filters</Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: '800' }}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[s.filterLabel, { color: muted }]}>Username / Name</Text>
              <View style={[s.inputWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80`, marginBottom: 14 }]}>
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

          {/* Search button */}
          <TouchableOpacity
            style={[s.searchBtn, { backgroundColor: primary, marginTop: 4 }]}
            onPress={search}
            activeOpacity={0.85}
          >
            <Feather name="search" size={16} color="#000" />
            <Text style={s.searchBtnText}>Search{activeFilterCount > 0 ? ` with ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''}` : ''}</Text>
          </TouchableOpacity>

          {/* Results */}
          {loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={{ color: muted, fontSize: 13 }}>Scanning checkins...</Text>
            </View>
          ) : hasSearched ? (
            results.length === 0 ? (
              <View style={s.empty}>
                <Feather name="clock" size={40} color={muted} style={{ opacity: 0.4 }} />
                <Text style={[s.emptyTitle, { color: textColor }]}>Nobody found</Text>
                <Text style={[s.emptySub, { color: muted }]}>
                  No checkins match that description in the selected time range.
                  {'\n'}Try a wider range, different venue, or fewer filters.
                </Text>
              </View>
            ) : (
              <View>
                <Text style={[s.resultHeader, { color: muted, paddingHorizontal: 16 }]}>
                  {results.length} Vibe{results.length !== 1 ? 'rs' : 'r'} · {toLocalDatetimeString(fromDate < toDate ? fromDate : toDate).replace('T', ' ')} → {toLocalDatetimeString(fromDate < toDate ? toDate : fromDate).replace('T', ' ')}
                  {venue ? ` · "${venue}"` : ' · All venues'}
                  {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''}` : ''}
                </Text>
                {results.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.row, { backgroundColor: surface, borderColor: checkOnline(item) ? `${primary}30` : 'rgba(255,255,255,0.06)', marginHorizontal: 16, marginBottom: 8 }]}
                    onPress={() => { setSelectedViber(item); setProfileVisible(true); }}
                    activeOpacity={0.82}
                  >
                    <View style={{ position: 'relative' }}>
                      {item.avatar_url
                        ? <SmartImage source={item.avatar_url} style={s.avatar} />
                        : <View style={[s.avatar, { backgroundColor: avatarBg(item.username), alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                              {(item.username || 'V')[0].toUpperCase()}
                            </Text>
                          </View>
                      }
                      {checkOnline(item) && <View style={[s.onlineDot, { borderColor: surface }]} />}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[s.username, { color: textColor }]} numberOfLines={1}>@{item.username}</Text>
                        {item.is_verified && <Feather name="check-circle" size={11} color={primary} />}
                      </View>
                      {item.venue_name
                        ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Feather name="map-pin" size={9} color="#f97316" />
                            <Text style={[s.venueName, { color: "#f97316" }]} numberOfLines={1}>{item.venue_name}</Text>
                          </View>
                        : null
                      }
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                        {item.gender && <Text style={[s.tag, { color: muted }]}>{item.gender}</Text>}
                        {item.hair_style && <Text style={[s.tag, { color: muted }]}>{item.hair_style} hair</Text>}
                        {item.outfit_vibe && <Text style={[s.tag, { color: muted }]}>{item.outfit_vibe}</Text>}
                      </View>
                      <Text style={[s.checkinTime, { color: muted }]}>{fmtAge(item.checkin_at)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.msgBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
                      onPress={() => { setMsgTarget(item); setMsgVisible(true); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="message-circle" size={16} color={primary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
                <View style={{ height: 120 }} />
              </View>
            )
          ) : (
            <View style={s.hint}>
              <Feather name="search" size={48} color={muted} style={{ opacity: 0.3 }} />
              <Text style={[s.hintTitle, { color: textColor }]}>Investigation Mode</Text>
              <Text style={[s.hintSub, { color: muted }]}>
                Enter a venue, pick a time window, and use the description filters to narrow down who was there — by appearance, gender, outfit, and more. Tap Search to find your person.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

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
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  sub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterToggleText: { fontSize: 11, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14,
    height: 44, borderRadius: 22, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14 },
  dtWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  filtersBox: { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, borderWidth: 1, padding: 16 },
  filtersTitle: { fontSize: 14, fontWeight: '900' },
  filterLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  chipText: { fontSize: 11, fontWeight: '800' },
  skinDot: { width: 12, height: 12, borderRadius: 6 },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginBottom: 16, paddingVertical: 13,
    borderRadius: 22,
  },
  searchBtnText: { color: '#000', fontSize: 14, fontWeight: '900' },
  resultHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 18, padding: 12,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: "#10b981", borderWidth: 2,
  },
  username: { fontSize: 14, fontWeight: '800' },
  venueName: { fontSize: 10, fontWeight: '800' },
  tag: { fontSize: 9, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  checkinTime: { fontSize: 10, fontWeight: '600' },
  msgBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  hint: { alignItems: 'center', paddingTop: 40, gap: 16, paddingHorizontal: 24, paddingBottom: 60 },
  hintTitle: { fontSize: 18, fontWeight: '900' },
  hintSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
