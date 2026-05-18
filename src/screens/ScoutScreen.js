import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Animated,
  ScrollView, Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { LocationService } from '../services/locationService';
import { DiscoveryManager, UserManager } from '../services/dataFlow';
import { useToast } from '../components/ToastNotification';

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

const CATEGORY_EMOJI = {
  music: '🎵', nightlife: '🌙', sport: '⚡', art: '🎨', food: '🍽️',
  culture: '🏛️', wellness: '🧘', tech: '💻', fashion: '👗', comedy: '😂',
  outdoor: '🌿', film: '🎬', esports: '🎮', festival: '🎪', party: '🎉',
  networking: '🤝', business: '💼', gaming: '🕹️', dance: '💃',
};
const getEmoji = (cat) => CATEGORY_EMOJI[cat?.toLowerCase()] ?? '📍';

const CATEGORIES = ['All', 'Music', 'Nightlife', 'Esports', 'Art', 'Tech', 'Sport', 'Food'];
const RADIUS_KM = [1, 5, 10, 25, 50];

const CACHE_KEY = 'scout_events_v1';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a1418' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a1418' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3a7a8c' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2a30' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c0c8d8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#162025' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0d1a1f' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#1a2e38' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8ab4c4' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050d12' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a4a5a' }] },
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
const MarkerPin = React.memo(({ event, primary, isCrewEvent }) => {
  const color = isCrewEvent ? '#00f2ff' : (event.vibe_count > 50 ? '#ff6b35' : primary);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[mkS.ring, { borderColor: color + '55' }]}>
        <View style={[mkS.circle, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={mkS.emoji}>{getEmoji(event.category)}</Text>
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
const MiniVibeCard = ({ event, primary, onView, onClose }) => {
  const slideAnim = useRef(new Animated.Value(220)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 80, friction: 12,
    }).start();
  }, [event?.id]);

  const thumb = event?.media_urls?.[0] || event?.image_url;
  const date = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD';
  const price = !event?.price || event.price === 0 ? 'FREE' : `R${event.price}`;

  return (
    <Animated.View style={[cvS.root, { transform: [{ translateY: slideAnim }] }]}>
      <View style={cvS.inner}>
        {thumb
          ? <Image source={{ uri: thumb }} style={cvS.thumb} />
          : <View style={[cvS.thumb, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 30 }}>{getEmoji(event?.category)}</Text>
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
              style={[cvS.viewBtn, { backgroundColor: primary }]}
              onPress={onView}
              activeOpacity={0.85}
            >
              <Text style={cvS.viewBtnText}>View Gruv</Text>
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
    borderRadius: 20, backgroundColor: '#111820',
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
  vibeText: { color: '#ff6b35', fontSize: 11, fontWeight: '800' },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, marginLeft: 'auto' },
  viewBtnText: { color: '#000', fontSize: 12, fontWeight: '900' },
  closeBtn: { position: 'absolute', top: 10, right: 10, padding: 2 },
});

// ─── Web list fallback ────────────────────────────────────────────────────────
const WebScoutList = ({ events, primary, insets, activeCategory, setActiveCategory, loading, onNavigateToEvent }) => (
  <View style={{ flex: 1 }}>
    <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: `${primary}18` }}>
      <Text style={{ color: primary, fontSize: 22, fontWeight: '900', letterSpacing: 2 }}>THE SCOUT</Text>
      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
        {events.length} pulses in range · Map view on mobile
      </Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 12 }}>
      {CATEGORIES.map(cat => {
        const active = activeCategory === cat;
        return (
          <TouchableOpacity
            key={cat}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: active ? primary : 'transparent', borderColor: active ? primary : `${primary}30` }}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#000' : primary }}>{cat !== 'All' ? `${getEmoji(cat)} ` : ''}{cat}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
    {loading ? (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={primary} />
      </View>
    ) : (
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}>
        {events.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <Text style={{ fontSize: 48 }}>📡</Text>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' }}>No pulses in range</Text>
          </View>
        )}
        {events.map(event => {
          const thumb = event.media_urls?.[0] || event.image_url;
          const date = event.event_date
            ? new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            : 'TBD';
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
                    <Text style={{ fontSize: 28 }}>{getEmoji(event.category)}</Text>
                  </View>
              }
              <View style={{ flex: 1, padding: 12, justifyContent: 'center', gap: 4 }}>
                <Text style={{ color: primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }}>{event.category?.toUpperCase()}</Text>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>{event.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{date} · {event.venue_name || 'Location TBD'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    )}
  </View>
);

// ─── ScoutScreen ──────────────────────────────────────────────────────────────
export const ScoutScreen = ({ onNavigateToEvent, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const insets = useSafeAreaInsets();

  const primary = currentTheme?.primary || '#00f2ff';
  const background = currentTheme?.background || '#0d1112';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [crewToggle, setCrewToggle] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [radiusKm, setRadiusKm] = useState(10);
  const [crewEventIds, setCrewEventIds] = useState(new Set());

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

  // Load events — try cache first, then live query
  const loadEvents = useCallback(async (coords) => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { events: cachedEvents, ts } = JSON.parse(cached);
        if (Date.now() - ts < 600000) {
          setEvents(cachedEvents);
          setLoading(false);
        }
      }
    } catch { }

    try {
      let evts;
      if (coords) {
        evts = await DiscoveryManager.findNearbyEvents(coords.lat, coords.lon, 50);
      } else {
        const { data } = await supabase
          .from('events')
          .select('id, title, category, lat, lon, venue_name, event_date, media_urls, image_url, vibe_count, price, max_attendees, profiles(username, avatar_url)')
          .gte('event_date', new Date().toISOString().split('T')[0])
          .order('event_date', { ascending: true })
          .limit(80);
        evts = data || [];
      }
      setEvents(evts);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ events: evts, ts: Date.now() }));
    } catch (err) {
      console.error('[Scout] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load which events crew has RSVP'd to
  const loadCrewEvents = useCallback(async () => {
    if (!user) return;
    try {
      const followedIds = await UserManager.getFollowedIds(user.id);
      if (!followedIds.length) return;
      const { data } = await supabase
        .from('event_rsvps')
        .select('event_id')
        .in('user_id', followedIds)
        .eq('status', 'going');
      setCrewEventIds(new Set((data || []).map(r => r.event_id)));
    } catch { }
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
  }, []);

  // Real-time: new event drops appear on the map instantly
  useEffect(() => {
    const chan = supabase.channel('scout_new_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        const e = payload.new;
        if (e.lat != null && e.lon != null) {
          setEvents(prev => [e, ...prev]);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, []);

  const handleFindMe = useCallback(async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch { }
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
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
    if (!user) { onAuthRequired?.(); return; }
    setCrewToggle(v => !v);
  }, [user]);

  const filteredEvents = useMemo(() => {
    let evts = events;

    if (crewToggle && crewEventIds.size > 0) {
      evts = evts.filter(e => crewEventIds.has(e.id));
    }

    if (activeCategory !== 'All') {
      evts = evts.filter(e => e.category?.toLowerCase() === activeCategory.toLowerCase());
    }

    if (userCoords && radiusKm < 50) {
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
        />
      </View>
    );
  }

  // ── Native: real map ──────────────────────────────────────────────────────
  if (!RNMapView) return null;

  return (
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
        {userCoords && (
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
                isCrewEvent={crewEventIds.has(event.id)}
              />
            </RNMarker>
          );
        })}
      </RNMapView>

      {/* Top overlay: header + filters */}
      <View style={[s.topOverlay, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={s.headerRow} pointerEvents="box-none">
          <View pointerEvents="none">
            <Text style={[s.title, { color: primary }]}>THE SCOUT</Text>
            <Text style={s.subtitle}>{filteredEvents.length} pulses in range</Text>
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
                {cat !== 'All' && <Text style={{ fontSize: 11 }}>{getEmoji(cat)}</Text>}
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
                  {km === 50 ? 'City-wide' : `${km} km`}
                </Text>
              </TouchableOpacity>
            );
          })}
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
          onView={() => {
            onNavigateToEvent?.(selectedEvent);
            setSelectedEvent(null);
          }}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1418' },
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
