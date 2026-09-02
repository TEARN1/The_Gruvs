import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Animated,
  ScrollView, Image, ActivityIndicator, Dimensions, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { LocationService } from '../services/locationService';
import { DiscoveryManager, UserManager, CAT_KEY_TO_SUBCATS } from '../services/dataFlow';
import { resilientRead } from '../utils/resilience';
import { useToast } from '../components/ToastNotification';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { EventMapView } from '../components/EventMapView';
import { money } from '../constants/currencies';
import { filterByViewerAge } from '../utils/contentAgeRating';
import { viewerAgeSync } from '../utils/viewerAge';

// react-native-maps is native-only — lazy require prevents web crash
let RNMapView = null;
let RNMarker = null;
let RNCircle = null;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  RNMapView = maps.default;
  RNMarker = maps.Marker;
  RNCircle = maps.Circle;
}

const { width: SW } = Dimensions.get('window');

// Default region: Midrand, South Africa
const MIDRAND = {
  latitude: -25.9928,
  longitude: 28.1282,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const CATEGORY_ICON = {
  music: 'music', nightlife: 'weather-night', sport: 'trophy', art: 'palette', food: 'silverware-fork-knife',
  culture: 'bank', wellness: 'meditation', tech: 'laptop', fashion: 'hanger', comedy: 'emoticon-lol',
  outdoor: 'leaf', film: 'movie-open', esports: 'gamepad-variant', festival: 'tent', party: 'party-popper',
  networking: 'handshake', business: 'briefcase', gaming: 'gamepad', dance: 'dance-ballroom',
};
const getIcon = (cat) => CATEGORY_ICON[cat?.toLowerCase()] ?? 'map-marker';

const CATEGORIES = [
  'All', 'Music', 'Nightlife', 'Party', 'Festival', 'Comedy', 'Art', 'Tech',
  'Esports', 'Gaming', 'Sport', 'Food', 'Wellness', 'Fashion', 'Film', 'Dance',
  'Business', 'Culture',
];
// City-wide = no distance cap (sentinel). Presets are real radii in km.
const CITYWIDE = 100000;
const RADIUS_KM = [1, 5, 10, 25, 50, 100, CITYWIDE];
const radiusLabel = (km) => (km >= CITYWIDE ? 'City-wide' : `${km} km`);

// Lets the user type any custom radius (km) — appears at the end of the preset row.
const CustomRadiusChip = ({ radiusKm, setRadiusKm, primary, variant }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const isCustom = radiusKm < CITYWIDE && !RADIUS_KM.includes(radiusKm);
  const apply = () => {
    const n = Math.max(1, Math.min(500, Math.round(Number(val) || 0)));
    if (n > 0) setRadiusKm(n);
    setEditing(false);
    setVal('');
  };
  const base = variant === 'web'
    ? { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, borderWidth: 1 }
    : { ...sRadiusChipBase };
  if (editing) {
    return (
      <View style={[base, { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${primary}22`, borderColor: primary }]}>
        <TextInput
          value={val}
          onChangeText={setVal}
          onSubmitEditing={apply}
          onBlur={apply}
          autoFocus
          keyboardType="number-pad"
          placeholder="km"
          placeholderTextColor="rgba(255,255,255,0.4)"
          maxLength={3}
          style={{ minWidth: 30, fontSize: 11, fontWeight: '700', color: primary, padding: 0 }}
        />
        <TouchableOpacity onPress={apply}><Feather name="check" size={12} color={primary} /></TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[base, { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isCustom ? `${primary}22` : 'transparent', borderColor: isCustom ? primary : `${primary}22` }]}
      onPress={() => { setVal(isCustom ? String(radiusKm) : ''); setEditing(true); }}
    >
      <Feather name="sliders" size={11} color={isCustom ? primary : 'rgba(255,255,255,0.5)'} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: isCustom ? primary : 'rgba(255,255,255,0.5)' }}>
        {isCustom ? `${radiusKm} km` : 'Custom'}
      </Text>
    </TouchableOpacity>
  );
};
const sRadiusChipBase = { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 };

const CACHE_KEY = 'scout_events_v1';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: "#0a1418" }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: "#0a1418" }] },
  { elementType: 'labels.text.fill', stylers: [{ color: "#3a7a8c" }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: "#1a2a30" }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: "#c0c8d8" }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: "#162025" }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: "#0d1a1f" }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: "#1a2e38" }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: "#8ab4c4" }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: "#050d12" }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: "#2a4a5a" }] },
];

// ─── Haversine distance (km) ──────────────────────────────────────────────────
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── MarkerPin ────────────────────────────────────────────────────────────────
const MarkerPin = React.memo(({ event, primary, isPlanned, isAutoPlanned }) => {
  const color = isPlanned
    ? "#10b981" // user planned (green)
    : (isAutoPlanned
        ? "#ff9f1c" // auto planned (orange)
        : primary); // regular
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[mkS.ring, { borderColor: color + '55' }]}>
        <View style={[mkS.circle, { backgroundColor: color + '22', borderColor: color }]}>
          <MaterialCommunityIcons name={getIcon(event.category)} size={18} color={color} />
        </View>
      </View>
      <View style={[mkS.stem, { backgroundColor: color }]} />
    </View>
  );
});

const mkS = StyleSheet.create({
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18 },
  stem: { width: 3, height: 8, borderRadius: 2, marginTop: -2 },
});

// ─── MiniVibeCard ─────────────────────────────────────────────────────────────
const MiniVibeCard = ({ event, primary, onView, onClose, isPlanned, onTogglePlan }) => {
  const slideAnim = useRef(new Animated.Value(220)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 80, friction: 12,
    }).start();
  }, [event?.id]);

  // TODO(v6): remove media_urls/image_url fallbacks after migration
  const thumb = event?.media_urls?.[0] || event?.image_url;
  const date = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD';
  const price = !event?.price || event.price === 0 ? 'FREE' : money(event.price);

  return (
    <Animated.View style={[cvS.root, { transform: [{ translateY: slideAnim }] }]}>
      <View style={cvS.inner}>
        {thumb
          ? <Image source={{ uri: thumb }} style={cvS.thumb} />
          : <View style={[cvS.thumb, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialCommunityIcons name={getIcon(event?.category)} size={30} color={primary} />
            </View>
        }
        <View style={cvS.info}>
          {event?.category && (
            <Text style={[cvS.category, { color: primary }]}>{event.category.toUpperCase()}</Text>
          )}
          <Text style={[cvS.title]} numberOfLines={2}>{event?.title}</Text>
          <View style={cvS.metaRow}>
            <Feather name="calendar" size={10} color="rgba(255,255,255,0.4)" />
            <Text style={cvS.metaText}>{date}</Text>
          </View>
          {event?.venue_name && (
            <View style={cvS.metaRow}>
              <Feather name="map-pin" size={10} color="rgba(255,255,255,0.4)" />
              <Text style={cvS.metaText} numberOfLines={1}>{event.venue_name}</Text>
            </View>
          )}
          <View style={cvS.footer}>
            <View style={[cvS.pricePill, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}>
              <Text style={[cvS.priceText, { color: primary }]}>{price}</Text>
            </View>
            {event?.vibe_count > 0 && (
              <View style={[cvS.vibePill, { backgroundColor: 'rgba(255,107,53,0.15)', borderColor: 'rgba(255,107,53,0.3)' }]}>
                <Feather name="zap" size={10} color="#ff6b35" />
                <Text style={[cvS.vibeText]}>{event.vibe_count}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[cvS.planBtn, { backgroundColor: isPlanned ? '#10b981' : 'rgba(255,255,255,0.08)', borderColor: isPlanned ? '#10b981' : `${primary}35` }]}
              onPress={onTogglePlan}
              activeOpacity={0.85}
            >
              <Feather name={isPlanned ? "check" : "plus"} size={10} color={isPlanned ? '#000' : primary} />
              <Text style={[cvS.planBtnText, { color: isPlanned ? '#000' : '#fff' }]}>{isPlanned ? 'Planned' : 'Plan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cvS.viewBtn, { backgroundColor: primary }]}
              onPress={onView}
              activeOpacity={0.85}
            >
              <Text style={cvS.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={cvS.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const cvS = StyleSheet.create({
  root: {
    position: 'absolute', bottom: 20, left: 12, right: 12,
    borderRadius: 20, backgroundColor: "#111820",
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 24, elevation: 24,
    overflow: 'hidden',
  },
  inner: { flexDirection: 'row', padding: 12, gap: 12 },
  thumb: { width: 84, height: 96, borderRadius: 12 },
  info: { flex: 1, gap: 4 },
  category: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pricePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  priceText: { fontSize: 11, fontWeight: '800' },
  vibePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  vibeText: { color: "#ff6b35", fontSize: 11, fontWeight: '800' },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, marginLeft: 'auto' },
  viewBtnText: { color: '#000', fontSize: 12, fontWeight: '900' },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1, marginLeft: 6 },
  planBtnText: { fontSize: 11, fontWeight: '900' },
  closeBtn: { position: 'absolute', top: 10, right: 10, padding: 2 },
});

// ─── Web list fallback ────────────────────────────────────────────────────────
const WebScoutList = ({ events, primary, insets, activeCategory, setActiveCategory, loading, onNavigateToEvent, radiusKm, setRadiusKm, userCoords }) => {
  const cityWide = !radiusKm || radiusKm >= CITYWIDE;
  const subtitle = loading
    ? 'Finding events around you…'
    : events.length === 0
      ? 'Events happening near you'
      : `${events.length} event${events.length === 1 ? '' : 's'} ${cityWide ? 'coming up near you' : `within ${radiusKm} km`}`;
  return (
  <View style={{ flex: 1 }}>
    <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: `${primary}18` }}>
      <Text style={{ color: primary, fontSize: 22, fontWeight: '900', letterSpacing: 2 }}>THE SCOUT</Text>
      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
    </View>

    {/* Category */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
      {CATEGORIES.map(cat => {
        const active = activeCategory === cat;
        return (
          <TouchableOpacity
            key={cat}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: active ? primary : 'transparent', borderColor: active ? primary : `${primary}30` }}
            onPress={() => setActiveCategory(cat)}
          >
            {cat !== 'All' && <MaterialCommunityIcons name={getIcon(cat)} size={13} color={active ? '#000' : primary} />}
            <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#000' : primary }}>{cat}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>

    {/* Distance range — control how far out to look */}
    {setRadiusKm && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingBottom: 10 }}>
        {RADIUS_KM.map(km => {
          const active = radiusKm === km;
          return (
            <TouchableOpacity
              key={km}
              style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, borderWidth: 1, backgroundColor: active ? `${primary}22` : 'transparent', borderColor: active ? primary : `${primary}22` }}
              onPress={() => setRadiusKm(km)}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: active ? primary : 'rgba(255,255,255,0.5)' }}>{radiusLabel(km)}</Text>
            </TouchableOpacity>
          );
        })}
        <CustomRadiusChip radiusKm={radiusKm} setRadiusKm={setRadiusKm} primary={primary} variant="web" />
      </ScrollView>
    )}

    {loading ? (
      <ScoutSkeleton primary={primary} />
    ) : (
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}>
        {events.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 50, gap: 10 }}>
            <MaterialCommunityIcons name="map-search" size={46} color="rgba(255,255,255,0.3)" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{cityWide ? 'No events coming up' : 'Nothing within range'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', paddingHorizontal: 44, lineHeight: 19 }}>
              {cityWide
                ? 'New Gruvs show up here the moment they’re posted. Check back soon.'
                : `No events within ${radiusKm} km of you. Widen the range to see what’s on.`}
            </Text>
            {!cityWide && setRadiusKm && (
              <TouchableOpacity onPress={() => setRadiusKm(CITYWIDE)} style={{ marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: primary }}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Show city-wide</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {events.map(event => {
          // TODO(v6): remove media_urls/image_url fallbacks after migration
          const thumb = event.media_urls?.[0] || event.image_url;
          const date = event.event_date
            ? new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            : 'TBD';
          const dist = (userCoords && event.lat != null && event.lon != null)
            ? haversine(userCoords.lat, userCoords.lon, Number(event.lat), Number(event.lon))
            : null;
          const distLabel = dist != null ? ` · ${dist < 1 ? '<1' : Math.round(dist)} km away` : '';
          return (
            <TouchableOpacity
              key={event.id}
              style={{ backgroundColor: `${primary}08`, borderRadius: 16, borderWidth: 1, borderColor: `${primary}20`, flexDirection: 'row', overflow: 'hidden' }}
              onPress={() => onNavigateToEvent?.(event)}
              activeOpacity={0.8}
            >
              {thumb
                ? <Image source={{ uri: thumb }} style={{ width: 80, height: 80 }} />
                : <View style={{ width: 80, height: 80, backgroundColor: `${primary}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name={getIcon(event.category)} size={28} color={primary} />
                  </View>
              }
              <View style={{ flex: 1, padding: 12, justifyContent: 'center', gap: 4 }}>
                <Text style={{ color: primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }}>{event.category?.toUpperCase()}</Text>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>{event.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }} numberOfLines={1}>{date} · {event.venue_name || 'Location TBD'}{distLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    )}
  </View>
  );
};

// ─── Scout list skeleton ───────────────────────────────────────────────────────
const ScoutSkeleton = ({ primary }) => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse, padding: 14, gap: 10 }}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={{ height: 72, borderRadius: 14, backgroundColor: `${primary}10` }} />
      ))}
    </Animated.View>
  );
};

// ─── ScoutScreen ──────────────────────────────────────────────────────────────
export const ScoutScreen = ({ onNavigateToEvent, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const insets = useSafeAreaInsets();

  const primary = currentTheme?.primary || "#00f2ff";
  const background = currentTheme?.background || "#0d1112";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [crewToggle, setCrewToggle] = useState(false);
  const { profile } = useAuth();
  const [plannedIds, setPlannedIds] = useState(new Set());

  useEffect(() => {
    AsyncStorage.getItem(`@user_plan:${user?.id || 'anon'}`).then(val => {
      if (val) setPlannedIds(new Set(JSON.parse(val)));
    }).catch(() => {});
  }, [user]);

  const togglePlan = useCallback(async (eventId) => {
    const next = new Set(plannedIds);
    if (next.has(eventId)) {
      next.delete(eventId);
      showToast('Removed event from your scout plan', 'info');
    } else {
      next.add(eventId);
      showToast('Added event to your scout plan!', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setPlannedIds(next);
    try {
      await AsyncStorage.setItem(`@user_plan:${user?.id || 'anon'}`, JSON.stringify(Array.from(next)));
    } catch {}
  }, [plannedIds, user]);

  const userInterests = useMemo(() => profile?.interests || [], [profile]);
  const isAutoPlanned = useCallback((ev) => {
    if (userInterests.includes(ev.category)) return true;
    if (ev.vibe_count > 40) return true;
    return false;
  }, [userInterests]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [radiusKm, setRadiusKm] = useState(CITYWIDE); // start city-wide → never empty on arrival; user narrows to find events near them
  const [crewEventIds, setCrewEventIds] = useState(new Set());
  const [mapModalVisible, setMapModalVisible] = useState(false);

  const mapRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // B-pass: Scout is a discovery surface like The Drop — the same viewer-age
  // content gate applies (it was missing here; a minor could scout 18+ nights).
  const ageGate = useCallback(
    (list) => filterByViewerAge(list || [], viewerAgeSync(), e => `${e.title || ''} ${e.description || ''}`),
    []
  );

  // Load events — cache-first, then 3-tier live fetch
  const loadEvents = useCallback(async (coords) => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { events: cachedEvents, ts } = JSON.parse(cached);
        if (Date.now() - ts < 600000) {
          setEvents(ageGate(cachedEvents));
          setLoading(false);
        }
      }
    } catch (err) {
      console.warn('ScoutScreen.loadEvents cached err:', err);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const evts = await resilientRead(
        async () => {
          if (coords) return DiscoveryManager.findNearbyEvents(coords.lat, coords.lon, 50);
          const { data, error } = await supabase
            .from('events')
            .select('id, title, category, lat, lon, venue_name, event_date, cover_url, media, vibe_count, price, capacity, profiles(username, avatar_url)')
            .gte('event_date', today)
            .is('deleted_at', null)
            .neq('status', 'cancelled')
            .order('event_date', { ascending: true })
            .limit(80);
          if (error) throw error;
          return data;
        },
        async () => {
          const { data, error } = await supabase
            .from('events')
            .select('id, title, category, lat, lon, venue_name, event_date, vibe_count')
            .gte('event_date', today)
            .order('event_date', { ascending: true })
            .limit(80);
          if (error) throw error;
          return data;
        },
        async () => {
          const { data, error } = await supabase
            .from('events')
            .select('id, title, lat, lon, event_date')
            .gte('event_date', today)
            .limit(40);
          if (error) throw error;
          return data;
        },
        [],
        'ScoutScreen.loadEvents'
      );
      setEvents(ageGate(evts));
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ events: evts || [], ts: Date.now() }));
    } catch (err) {
      console.warn('ScoutScreen.loadEvents live err:', err);
    }
    finally {
      setLoading(false);
    }
  }, []);

  // Load which events crew has RSVP'd to
  const loadCrewEvents = useCallback(async () => {
    if (!user) return;
    try {
      const followedIds = await UserManager.getFollowedIds(user.id);
      if (!followedIds.length) return;
      const data = await resilientRead(
        async () => {
          const { data: d, error } = await supabase
            .from('event_rsvps')
            .select('event_id')
            .in('user_id', followedIds)
            .eq('status', 'going');
          if (error) throw error;
          return d;
        },
        async () => {
          const { data: d, error } = await supabase
            .from('event_rsvps')
            .select('event_id, user_id')
            .in('user_id', followedIds.slice(0, 50));
          if (error) throw error;
          return d;
        },
        async () => {
          const { data: d, error } = await supabase
            .from('event_rsvps')
            .select('event_id')
            .in('user_id', followedIds.slice(0, 20));
          if (error) throw error;
          return d;
        },
        [],
        'ScoutScreen.loadCrewEvents'
      );
      setCrewEventIds(new Set((data || []).map(r => r.event_id)));
    } catch (err) {
      console.warn('ScoutScreen.loadCrewEvents err:', err);
    }
  }, [user]);

  useEffect(() => {
    const init = async () => {
      const coords = await LocationService.requestAndGet();
      if (coords) {
        setUserCoords(coords);
        if (Platform.OS !== 'web' && mapRef.current) {
          mapRef.current.animateToRegion(
            { latitude: coords.lat, longitude: coords.lon, latitudeDelta: 0.1, longitudeDelta: 0.1 },
            800
          );
        }
      }
      await loadEvents(coords);
    };
    init();
    loadCrewEvents();
  }, [loadEvents, loadCrewEvents]);

  // Real-time: new event drops appear on the map instantly
  useEffect(() => {
    const chan = supabase.channel('scout_new_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        const e = payload.new;
        if (e.lat != null && e.lon != null) {
          setEvents(prev => [...ageGate([e]), ...prev]);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, []);

  const handleFindMe = useCallback(async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (err) { console.warn('Haptics error:', err); }
    const coords = await LocationService.requestAndGet();
    if (coords) {
      setUserCoords(coords);
      if (Platform.OS !== 'web' && mapRef.current) {
        mapRef.current.animateToRegion(
          { latitude: coords.lat, longitude: coords.lon, latitudeDelta: 0.07, longitudeDelta: 0.07 },
          600
        );
      }
      showToast('Frequency centered', 'success');
    } else {
      showToast('Enable location to sync', 'error');
    }
  }, []);

  const handleCrewToggle = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (err) { console.warn('Haptics error:', err); }
    if (!user) { onAuthRequired?.(); return; }
    setCrewToggle(v => !v);
  }, [user]);

  const filteredEvents = useMemo(() => {
    let evts = events;

    if (crewToggle && crewEventIds.size > 0) {
      evts = evts.filter(e => crewEventIds.has(e.id));
    }

    if (activeCategory !== 'All') {
      const catKey = activeCategory.toLowerCase();
      const subCats = CAT_KEY_TO_SUBCATS[catKey] || new Set([catKey]);
      evts = evts.filter(e => {
        const eCat = e.category?.toLowerCase();
        if (eCat && subCats.has(eCat)) return true;
        if (Array.isArray(e.categories) && e.categories.some(c => subCats.has(c?.toLowerCase()))) return true;
        return false;
      });
    }

    if (userCoords && radiusKm < CITYWIDE) {
      evts = evts.filter(e => {
        const lat = Number(e.lat);
        const lon = Number(e.lon);
        if (e.lat == null || e.lon == null || isNaN(lat) || isNaN(lon)) return false;
        return haversine(userCoords.lat, userCoords.lon, lat, lon) <= radiusKm;
      });
    }

    return evts;
  }, [events, crewToggle, crewEventIds, activeCategory, radiusKm, userCoords]);

  // ── Web: list view ────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: background }}>
        <WebScoutList
          events={filteredEvents}
          primary={primary}
          insets={insets}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          loading={loading}
          onNavigateToEvent={onNavigateToEvent}
          radiusKm={radiusKm}
          setRadiusKm={setRadiusKm}
          userCoords={userCoords}
        />
      </View>
    );
  }

  // ── Native Expo Go / no react-native-maps: use custom canvas map ────────
  if (!RNMapView) {
    return (
      <View style={{ flex: 1, backgroundColor: background }}>
        <WebScoutList
          events={filteredEvents}
          primary={primary}
          insets={insets}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          loading={loading}
          onNavigateToEvent={onNavigateToEvent}
          radiusKm={radiusKm}
          setRadiusKm={setRadiusKm}
          userCoords={userCoords}
        />
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setMapModalVisible(true)}
            style={{ backgroundColor: primary, borderRadius: 14, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            activeOpacity={0.85}
          >
            <Feather name="map" size={16} color="#000" />
            <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>View on Map ({filteredEvents.length})</Text>
          </TouchableOpacity>
        </View>
        <EventMapView
          visible={mapModalVisible}
          onClose={() => setMapModalVisible(false)}
          events={filteredEvents}
          userCoords={userCoords}
          onSelectEvent={(ev) => { setMapModalVisible(false); onNavigateToEvent?.(ev); }}
        />
      </View>
    );
  }

  return (
    <ErrorBoundary label="Scout">
    <View style={s.root}>
      <RNMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={
          userCoords
            ? { latitude: userCoords.lat, longitude: userCoords.lon, latitudeDelta: 0.1, longitudeDelta: 0.1 }
            : MIDRAND
        }
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={() => setSelectedEvent(null)}
      >
        {/* Scan radius ring */}
        {userCoords && radiusKm < CITYWIDE && (
          <RNCircle
            center={{ latitude: userCoords.lat, longitude: userCoords.lon }}
            radius={radiusKm * 1000}
            strokeColor={`${primary}45`}
            fillColor={`${primary}07`}
            strokeWidth={1.5}
          />
        )}

        {/* Event markers */}
        {filteredEvents.map(event => {
          if (event.lat == null || event.lon == null) return null;
          return (
            <RNMarker
              key={event.id}
              coordinate={{ latitude: Number(event.lat), longitude: Number(event.lon) }}
              onPress={() => setSelectedEvent(event)}
              tracksViewChanges={false}
            >
              <MarkerPin
                event={event}
                primary={primary}
                isPlanned={plannedIds.has(event.id)}
                isAutoPlanned={isAutoPlanned(event)}
              />
            </RNMarker>
          );
        })}
      </RNMapView>

      {/* Legend Overlay */}
      <View style={s.legend} pointerEvents="none">
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={s.legendText}>Planned (User)</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#ff9f1c' }]} />
          <Text style={s.legendText}>Auto Planned (Vibes)</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: primary }]} />
          <Text style={s.legendText}>Other Events</Text>
        </View>
      </View>

      {/* Top overlay: header + filters */}
      <View style={[s.topOverlay, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={s.headerRow} pointerEvents="box-none">
          <View pointerEvents="none">
            <Text style={[s.title, { color: primary }]}>THE SCOUT</Text>
            <Text style={s.subtitle}>
              {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} {radiusKm >= CITYWIDE ? 'nearby' : `within ${radiusKm} km`}
            </Text>
          </View>
          <View style={s.actions}>
            {/* Find Me */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[s.iconBtn, { backgroundColor: primary, shadowColor: primary }]}
                onPress={handleFindMe}
                accessibilityRole="button"
                accessibilityLabel="Center map on my location"
              >
                <Feather name="crosshair" size={18} color="#000" />
              </TouchableOpacity>
            </Animated.View>

            {/* Crew Toggle */}
            <TouchableOpacity
              style={[
                s.iconBtn,
                {
                  backgroundColor: crewToggle ? primary : 'rgba(0,0,0,0.65)',
                  borderColor: crewToggle ? primary : 'rgba(255,255,255,0.18)',
                  borderWidth: 1,
                  shadowColor: crewToggle ? primary : 'transparent',
                },
              ]}
              onPress={handleCrewToggle}
              accessibilityRole="button"
              accessibilityLabel={crewToggle ? 'Show all events' : 'Show crew events only'}
            >
              <Feather name="users" size={18} color={crewToggle ? '#000' : 'rgba(255,255,255,0.85)'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catScroll}
          style={s.catScrollWrap}
        >
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  s.catChip,
                  {
                    backgroundColor: active ? primary : 'rgba(0,0,0,0.65)',
                    borderColor: active ? primary : 'rgba(255,255,255,0.15)',
                  },
                ]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.8}
              >
                {cat !== 'All' && <MaterialCommunityIcons name={getIcon(cat)} size={12} color={active ? '#000' : 'rgba(255,255,255,0.9)'} />}
                <Text style={[s.catChipText, { color: active ? '#000' : 'rgba(255,255,255,0.9)' }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Radius selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.radiusScroll}
        >
          {RADIUS_KM.map(km => {
            const active = radiusKm === km;
            return (
              <TouchableOpacity
                key={km}
                style={[
                  s.radiusChip,
                  {
                    backgroundColor: active ? `${primary}22` : 'rgba(0,0,0,0.55)',
                    borderColor: active ? primary : 'rgba(255,255,255,0.12)',
                  },
                ]}
                onPress={() => setRadiusKm(km)}
                activeOpacity={0.8}
              >
                <Text style={[s.radiusText, { color: active ? primary : 'rgba(255,255,255,0.55)' }]}>
                  {radiusLabel(km)}
                </Text>
              </TouchableOpacity>
            );
          })}
          <CustomRadiusChip radiusKm={radiusKm} setRadiusKm={setRadiusKm} primary={primary} variant="native" />
        </ScrollView>
      </View>

      {/* Scanning overlay */}
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color={primary} size="large" />
          <Text style={[s.loadingText, { color: primary }]}>Scanning frequency...</Text>
        </View>
      )}

      {/* Mini Vibe Card */}
      {selectedEvent && (
        <MiniVibeCard
          event={selectedEvent}
          primary={primary}
          isPlanned={plannedIds.has(selectedEvent.id)}
          onTogglePlan={() => togglePlan(selectedEvent.id)}
          onView={() => {
            onNavigateToEvent?.(selectedEvent);
            setSelectedEvent(null);
          }}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </View>

    </ErrorBoundary>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1418" },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 14, gap: 8,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 2,
  },
  title: {
    fontSize: 20, fontWeight: '900', letterSpacing: 2.5,
    textShadowColor: 'rgba(0,242,255,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.7, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  catScrollWrap: { maxHeight: 40 },
  legend: { position: 'absolute', bottom: 130, left: 16, backgroundColor: 'rgba(13,17,18,0.88)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700' },
  catScroll: { gap: 8, paddingRight: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  catChipText: { fontSize: 12, fontWeight: '700' },
  radiusScroll: { gap: 6, paddingRight: 4 },
  radiusChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  radiusText: { fontSize: 11, fontWeight: '600' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,20,24,0.88)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  loadingText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
});
