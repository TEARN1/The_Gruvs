import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  TextInput, Dimensions, Animated, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { FadeInView } from '../components/FadeInView';
import { AuraEffect } from '../components/AuraEffect';
import { BrandLogo } from '../components/BrandLogo';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { FeedManager, TrendingManager, DiscoveryManager } from '../services/dataFlow';
import { LocationService } from '../services/locationService';
import { SAMPLE_EVENTS, SAMPLE_TRENDING } from '../constants/SampleData';
import { CATEGORY_CONFIG, CATEGORY_KEYS, getCategoryColor } from '../constants/CategoryConfig';
import { RouteJourneyCard } from '../components/RouteJourneyCard';

const { width } = Dimensions.get('window');

// ── Mood buckets ───────────────────────────────────────────────────────────────
const MOODS = [
  { key: 'hype',     label: 'Hype',     icon: 'zap',        color: '#f97316', cats: ['music','party','nightlife'] },
  { key: 'chill',    label: 'Chill',    icon: 'coffee',     color: '#06b6d4', cats: ['food','art','wellness','nature'] },
  { key: 'culture',  label: 'Culture',  icon: 'globe',      color: '#8b5cf6', cats: ['art','film','gallery','heritage'] },
  { key: 'sport',    label: 'Sport',    icon: 'activity',   color: '#10b981', cats: ['sport','fitness','outdoor'] },
  { key: 'family',   label: 'Family',   icon: 'users',      color: '#f59e0b', cats: ['kids','family','carnival'] },
  { key: 'network',  label: 'Network',  icon: 'briefcase',  color: '#3b82f6', cats: ['tech','business','workshop'] },
];

// ── Hero card (featured event of the day) ────────────────────────────────────
const HeroCard = ({ event, primary, onPress }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const getMediaUrl = (item) => {
    if (!item) return 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=85';
    const url = typeof item === 'string' ? item : item.url;
    return url.includes('?') ? `${url}&w=1200&q=85` : `${url}?w=1200&q=85`;
  };

  const thumb = getMediaUrl(event.media?.[0]);
  const catColor = event.category_color || getCategoryColor(event.category) || primary;

  const isWeb = Platform.OS === 'web';

  return (
    <TouchableOpacity 
      style={[
        hero.wrap, 
        isWeb && { boxShadow: '0 15px 45px rgba(0,0,0,0.6)' }
      ]} 
      onPress={onPress} 
      activeOpacity={0.92}
    >
      <Animated.Image
        source={{ uri: typeof thumb === 'string' ? thumb : thumb }}
        style={[hero.img, { transform: [{ scale: pulse }] }]}
        resizeMode="cover"
      />
      {/* Gradient overlay */}
      <View style={[hero.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

      {/* Featured badge */}
      <View style={[hero.badge, { backgroundColor: catColor, ...(isWeb ? { boxShadow: `0 0 15px ${catColor}80` } : {}) }]}>
        <Feather name="star" size={10} color="#000" />
        <Text style={hero.badgeText}>FEATURED TODAY</Text>
      </View>

      {/* Bottom info */}
      <View style={hero.info}>
        <View style={[hero.catPill, { backgroundColor: `${catColor}33`, borderColor: `${catColor}60` }]}>
          <Text style={[hero.catText, { color: catColor }]}>
            {(CATEGORY_CONFIG[event.category]?.label || event.category || 'EVENT').toUpperCase()}
          </Text>
        </View>
        <Text style={hero.title} numberOfLines={2}>{event.title}</Text>
        <View style={hero.metaRow}>
          {event.event_date ? (
            <View style={hero.metaItem}>
              <Feather name="calendar" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={hero.metaText}>
                {new Date(event.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ) : null}
          {event.venue_name ? (
            <View style={hero.metaItem}>
              <Feather name="map-pin" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={hero.metaText} numberOfLines={1}>{event.venue_name}</Text>
            </View>
          ) : null}
          <View style={hero.metaItem}>
            <Feather name="zap" size={12} color={catColor} />
            <Text style={[hero.metaText, { color: catColor }]}>{event.vibe_count || event.going || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const hero = StyleSheet.create({
  wrap: { height: 320, borderRadius: 24, overflow: 'hidden', marginHorizontal: 16, marginBottom: 20 },
  img: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject },
  badge: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { color: '#000', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  info: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  catPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, marginBottom: 8 },
  catText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 10, lineHeight: 26 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
});

// ── Mood selector ─────────────────────────────────────────────────────────────
const MoodRow = ({ activeMood, onSelect, primary }) => (
  <ScrollView showsVerticalScrollIndicator={false}
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 4 }}
  >
    {MOODS.map(m => {
      const isActive = activeMood === m.key;
      return (
        <TouchableOpacity
          key={m.key}
          style={[mr.btn, {
            backgroundColor: isActive ? m.color : `${m.color}15`,
            borderColor: isActive ? m.color : `${m.color}30`,
          }]}
          onPress={() => onSelect(isActive ? null : m.key)}
        >
          <Feather name={m.icon} size={14} color={isActive ? '#000' : m.color} />
          <Text style={[mr.text, { color: isActive ? '#000' : m.color }]}>{m.label}</Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const mr = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  text: { fontSize: 12, fontWeight: '800' },
});

// ── Category discovery grid ───────────────────────────────────────────────────
const CategoryGrid = ({ onSelect, primary, textColor, muted, categoryCounts }) => {
  const TOP_CATS = CATEGORY_KEYS.slice(0, 12);
  return (
    <View style={cg.grid}>
      {TOP_CATS.map(key => {
        const cfg = CATEGORY_CONFIG[key];
        const count = categoryCounts[key] || 0;
        return (
          <TouchableOpacity
            key={key}
            style={[cg.cell, { backgroundColor: `${cfg.color}12`, borderColor: `${cfg.color}25` }]}
            onPress={() => onSelect(key)}
          >
            <Text style={{ fontSize: 22 }}>{cfg.icon}</Text>
            <Text style={[cg.label, { color: textColor }]}>{cfg.label}</Text>
            {count > 0 && <Text style={[cg.count, { color: cfg.color }]}>{count}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const cg = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  cell: { width: (width - 56) / 3, height: 85, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  count: { fontSize: 9, fontWeight: '900' },
});

// ── Nearby viber bubbles ──────────────────────────────────────────────────────
const NearbyVibers = ({ vibers, primary, textColor, onPress }) => {
  if (!vibers.length) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
        {vibers.map(v => (
          <TouchableOpacity key={v.profile_id || v.id} style={nv.wrap} onPress={() => onPress(v)}>
            <View style={[nv.ring, { borderColor: primary }]}>
              <Image source={{ uri: v.avatar_url || `https://i.pravatar.cc/60?u=${v.profile_id}` }} style={nv.avatar} />
              {v.is_online && <View style={nv.dot} />}
            </View>
            <Text style={[nv.name, { color: textColor }]} numberOfLines={1}>@{v.username}</Text>
            <Text style={[nv.dist, { color: primary }]}>
              {typeof v.distance_km === 'number' ? `${v.distance_km.toFixed(1)}km` : 'Near'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const nv = StyleSheet.create({
  wrap: { alignItems: 'center', width: 68 },
  ring: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, padding: 2, marginBottom: 6 },
  avatar: { width: '100%', height: '100%', borderRadius: 25 },
  dot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#000' },
  name: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  dist: { fontSize: 9, fontWeight: '900' },
});

// ── Compact event tile for horizontal scrolls ─────────────────────────────────
const EventTile = ({ event, primary, textColor, muted, onPress }) => {
  const catColor = event.category_color || getCategoryColor(event.category) || primary;
  const thumb = event.media?.[0]?.url || event.media?.[0] ||
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400';
    const isWeb = Platform.OS === 'web';
    return (
      <TouchableOpacity 
        style={[
          et.wrap, 
          { borderColor: `${catColor}35` },
          isWeb && { boxShadow: '0 8px 25px rgba(0,0,0,0.45)' }
        ]} 
        onPress={onPress} 
        activeOpacity={0.85}
      >
        <Image source={{ uri: typeof thumb === 'string' ? thumb : thumb }} style={et.img} />
        <View style={[et.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
        <View style={[et.catBadge, { backgroundColor: catColor, ...(isWeb ? { boxShadow: `0 0 10px ${catColor}80` } : {}) }]}>
          <Text style={et.catText}>{CATEGORY_CONFIG[event.category]?.icon || '🎭'}</Text>
        </View>
      <View style={et.info}>
        <Text style={et.title} numberOfLines={2}>{event.title}</Text>
        <View style={et.meta}>
          <Feather name="zap" size={10} color="rgba(255,255,255,0.8)" />
          <Text style={et.metaText}>{event.vibe_count || event.going || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const et = StyleSheet.create({
  wrap: { width: 165, height: 210, borderRadius: 18, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  img: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: StyleSheet.absoluteFillObject,
  catBadge: { position: 'absolute', top: 10, left: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  catText: { fontSize: 14 },
  info: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  title: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 6, lineHeight: 17 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
});

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ title, actionLabel, onAction, textColor, primary }) => (
  <View style={sh.row}>
    <Text style={[sh.title, { color: textColor }]}>{title}</Text>
    {actionLabel && (
      <TouchableOpacity onPress={onAction}>
        <Text style={[sh.action, { color: primary }]}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  action: { fontSize: 14, fontWeight: '800' },
});

// ── Main ExplorePage ──────────────────────────────────────────────────────────
export const ExplorePage = ({ onAuthRequired, onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [activeMood, setActiveMood] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [featuredEvent, setFeaturedEvent] = useState(null);
  const [happeningNow, setHappeningNow] = useState([]);
  const [trendingEvents, setTrendingEvents] = useState([]);
  const [nearbyVibers, setNearbyVibers] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedViber, setSelectedViber] = useState(null);
  const [viberModalVisible, setViberModalVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef(null);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);

    const [trending, happening, counts] = await Promise.all([
      TrendingManager.fetch(8),
      TrendingManager.fetchHappeningNow(),
      TrendingManager.fetchCategoryCounts(),
    ]);

    const trendFull  = trending.length  > 0 ? trending  : SAMPLE_TRENDING;
    const happenFull = happening.length > 0 ? happening : SAMPLE_EVENTS.slice(0, 4);

    setTrendingEvents(trendFull);
    setHappeningNow(happenFull);
    setCategoryCounts(counts);

    const featured = happenFull.reduce((best, e) =>
      (e.vibe_count || e.going || 0) > (best.vibe_count || best.going || 0) ? e : best,
      happenFull[0]
    );
    setFeaturedEvent(featured || SAMPLE_EVENTS[0]);

    setLoading(false);

    // ── Location: runs after initial render so UI isn't blocked ──────────────
    setLocationLoading(true);
    const coords = await LocationService.requestAndGet();
    if (coords) {
      setUserCoords(coords);
      // Save to profile so PostGIS viber-proximity works
      if (user) {
        LocationService.saveToProfile(user.id, coords.lat, coords.lon);
        const nearby = await DiscoveryManager.findNobility(user.id, 25);
        setNearbyVibers(nearby);
      }
      // Fetch events near the user's physical location
      const eventsNear = await DiscoveryManager.findNearbyEvents(coords.lat, coords.lon, 30);
      setNearbyEvents(eventsNear);
    } else if (user) {
      // No location but user logged in — still try vibers (profile may already have coords)
      const nearby = await DiscoveryManager.findNobility(user.id, 25);
      setNearbyVibers(nearby);
    }
    setLocationLoading(false);
  };

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); setUserResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { events, users } = await FeedManager.searchAll(query);
      const fromSample = SAMPLE_EVENTS.filter(e =>
        e.title?.toLowerCase().includes(query.toLowerCase()) ||
        e.description?.toLowerCase().includes(query.toLowerCase()) ||
        e.category?.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(events.length > 0 ? events : fromSample);
      setUserResults(users);
      setSearching(false);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  // Filter events by mood or category
  const filteredEvents = (() => {
    if (activeCat) return (happeningNow.length > 0 ? happeningNow : SAMPLE_EVENTS).filter(e => e.category === activeCat);
    if (activeMood) {
      const mood = MOODS.find(m => m.key === activeMood);
      if (mood) return (happeningNow.length > 0 ? happeningNow : SAMPLE_EVENTS).filter(e => mood.cats.includes(e.category));
    }
    return happeningNow.length > 0 ? happeningNow : SAMPLE_EVENTS;
  })();

  const isSearching = query.trim().length > 0;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <AuraEffect />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: `${primary}18` }]}>
          <View style={styles.brandRow}>
            <BrandLogo size={34} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.headerTitle, { color: primary }]}>Explore</Text>
              <Text style={[styles.headerSub, { color: muted }]}>Discover your next Gruv</Text>
            </View>
          </View>
        </View>

        {/* Search bar */}
        <View style={[styles.searchWrap, { borderColor: `${primary}25` }]}>
          <Feather name="search" size={17} color={isSearching ? primary : muted} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search events, artists, venues..."
            placeholderTextColor={muted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── SEARCH MODE ─────────────────────────────────────────────────── */}
        {isSearching ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {searching ? (
              <Text style={[{ color: muted, textAlign: 'center', marginTop: 20, fontSize: 13 }]}>
                Searching the kingdom...
              </Text>
            ) : (searchResults.length === 0 && userResults.length === 0) ? (
              <View style={styles.noResults}>
                <Feather name="search" size={36} color={muted} />
                <Text style={[styles.noResultsText, { color: muted }]}>No results for "{query}"</Text>
              </View>
            ) : (
              <>
                {userResults.length > 0 && (
                  <>
                    <Text style={[styles.resultCount, { color: muted }]}>PEOPLE</Text>
                    {userResults.map((u, i) => (
                      <FadeInView key={u.id} delay={i * 30} direction="up">
                        <View style={[src.wrap, { borderColor: `${primary}25` }]}>
                          <Image source={{ uri: u.avatar_url || `https://i.pravatar.cc/60?u=${u.id}` }} style={[src.thumb, { borderRadius: 30 }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[src.title, { color: textColor, fontSize: 13 }]}>@{u.username}</Text>
                            {u.bio ? <Text style={[src.metaText, { color: muted }]} numberOfLines={1}>{u.bio}</Text> : null}
                            {u.location ? <Text style={[src.metaText, { color: muted }]}>{u.location}</Text> : null}
                          </View>
                          <View style={[src.badge, { backgroundColor: `${primary}20` }]}>
                            <Feather name="zap" size={11} color={primary} />
                            <Text style={[src.badgeText, { color: primary }]}>{u.vibe_score || 0}</Text>
                          </View>
                        </View>
                      </FadeInView>
                    ))}
                  </>
                )}
                {searchResults.length > 0 && (
                  <>
                    <Text style={[styles.resultCount, { color: muted, marginTop: userResults.length > 0 ? 12 : 0 }]}>
                      EVENTS — {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </Text>
                    {searchResults.map((ev, i) => (
                      <FadeInView key={ev.id} delay={i * 40} direction="up">
                        <SearchResultCard ev={ev} primary={primary} textColor={textColor} muted={muted} catColor={ev.category_color || getCategoryColor(ev.category) || primary} onPress={() => onNavigateToEvent && onNavigateToEvent(ev)} />
                      </FadeInView>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        ) : (
          <>
            {/* ── Mood selector ──────────────────────────────────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader title="What's your mood?" textColor={textColor} primary={primary} />
              <MoodRow activeMood={activeMood} onSelect={(m) => { setActiveMood(m); setActiveCat(null); }} primary={primary} />
            </View>

            {/* ── Hero card ──────────────────────────────────────────────── */}
            {featuredEvent ? (
              <FadeInView direction="up" delay={0}>
                <HeroCard event={featuredEvent} primary={primary} onPress={() => onNavigateToEvent && onNavigateToEvent(featuredEvent)} />
              </FadeInView>
            ) : loading ? (
              <View style={[styles.heroSkeleton, { backgroundColor: `${primary}12` }]} />
            ) : null}

            {/* ── Happening Now ───────────────────────────────────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader
                title={activeMood || activeCat ? `${activeMood ? MOODS.find(m => m.key === activeMood)?.label : (CATEGORY_CONFIG[activeCat]?.label || '')} Gruvs` : 'Happening Now'}
                actionLabel="See all"
                onAction={() => { setActiveMood(null); setActiveCat(null); }}
                textColor={textColor}
                primary={primary}
              />
              <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                {(loading ? [{id:'s1'},{id:'s2'},{id:'s3'}] : filteredEvents.slice(0, 8)).map((ev, i) => (
                  loading ? (
                    <View key={ev.id} style={[et.wrap, { backgroundColor: `${primary}10` }]} />
                  ) : (
                    <FadeInView key={ev.id} delay={i * 50} direction="right">
                      <EventTile event={ev} primary={primary} textColor={textColor} muted={muted} onPress={() => onNavigateToEvent && onNavigateToEvent(ev)} />
                    </FadeInView>
                  )
                ))}
              </ScrollView>
            </View>

            {/* ── Near Me events ─────────────────────────────────────────── */}
            {(nearbyEvents.length > 0 || locationLoading) && (
              <View style={{ marginBottom: 20 }}>
                <SectionHeader
                  title={userCoords ? `Near You · ${nearbyEvents.length} gruv${nearbyEvents.length !== 1 ? 's' : ''}` : 'Near You'}
                  textColor={textColor}
                  primary={primary}
                />
                {locationLoading && nearbyEvents.length === 0 ? (
                  <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {[1, 2, 3].map(i => (
                      <View key={i} style={[et.wrap, { backgroundColor: `${primary}10` }]} />
                    ))}
                  </ScrollView>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {nearbyEvents.slice(0, 8).map((ev, i) => (
                      <FadeInView key={ev.id} delay={i * 50} direction="right">
                        <EventTile
                          event={ev}
                          primary={primary}
                          textColor={textColor}
                          muted={muted}
                          onPress={() => onNavigateToEvent && onNavigateToEvent(ev)}
                        />
                      </FadeInView>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* ── Nearby vibers ──────────────────────────────────────────── */}
            {nearbyVibers.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <SectionHeader title="Vibers Near You" actionLabel="Find Them" onAction={() => { setActiveMood(null); setActiveCat(null); }} textColor={textColor} primary={primary} />
                <NearbyVibers vibers={nearbyVibers} primary={primary} textColor={textColor} onPress={(v) => { setSelectedViber(v); setViberModalVisible(true); }} />
              </View>
            )}

            {/* ── Trending ────────────────────────────────────────────────── */}
            {trendingEvents.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <SectionHeader title="Trending" textColor={textColor} primary={primary} />
                <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                  {trendingEvents.slice(0, 6).map((spot, i) => (
                    <TrendTile key={spot.event_id || i} spot={spot} rank={i} primary={primary} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Royal Routes (curated multi-stop journeys) ──────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader title="Royal Routes" textColor={textColor} primary={primary} />
              {[
                { title: 'Jozi Nightowl Route', color: '#00f2ff', vibe_score: '2.4k', steps: [{ title: 'Sky Deck', icon: 'glass-wine' }, { title: 'Warehouse IX', icon: 'music' }, { title: 'Newtown Hub', icon: 'map-marker' }] },
                { title: 'Cape Town Sunset Crawl', color: '#f59e0b', vibe_score: '1.8k', steps: [{ title: 'Signal Hill', icon: 'flag' }, { title: 'De Waterkant', icon: 'glass-wine' }, { title: 'Biscuit Mill', icon: 'music' }] },
              ].map((route, i) => (
                <RouteJourneyCard key={i} route={route} onPress={() => {}} />
              ))}
            </View>

            {/* ── Category discovery ──────────────────────────────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader title="Browse by Category" textColor={textColor} primary={primary} />
              <CategoryGrid
                onSelect={(key) => { setActiveCat(key); setActiveMood(null); }}
                primary={primary}
                textColor={textColor}
                muted={muted}
                categoryCounts={categoryCounts}
              />
            </View>

            {/* ── Guest CTA ───────────────────────────────────────────────── */}
            {!user && (
              <TouchableOpacity
                style={[styles.guestCta, { backgroundColor: `${primary}12`, borderColor: `${primary}30` }]}
                onPress={onAuthRequired}
              >
                <Feather name="user-plus" size={20} color={primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ctaTitle, { color: primary }]}>Join The Gruvs</Text>
                  <Text style={[styles.ctaSub, { color: muted }]}>Post events, vibe, react & connect with creators</Text>
                </View>
                <Feather name="chevron-right" size={18} color={`${primary}80`} />
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <ViberProfileModal
        visible={viberModalVisible}
        user={selectedViber}
        onClose={() => setViberModalVisible(false)}
      />
    </View>
  );
};

// ── Search result row ─────────────────────────────────────────────────────────
const SearchResultCard = ({ ev, primary, textColor, muted, catColor, onPress }) => (
  <TouchableOpacity style={[src.wrap, { borderColor: `${catColor}25` }]} onPress={onPress} activeOpacity={0.8}>
    <Image
      source={{ uri: ev.media?.[0]?.url || ev.media?.[0] || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200' }}
      style={src.thumb}
    />
    <View style={{ flex: 1 }}>
      <Text style={[src.title, { color: textColor }]} numberOfLines={2}>{ev.title}</Text>
      <View style={src.meta}>
        {ev.event_date ? <Text style={[src.metaText, { color: muted }]}>{new Date(ev.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}</Text> : null}
        {ev.venue_name ? <Text style={[src.metaText, { color: muted }]}>· {ev.venue_name}</Text> : null}
      </View>
    </View>
    <View style={[src.badge, { backgroundColor: `${catColor}20` }]}>
      <Feather name="zap" size={11} color={catColor} />
      <Text style={[src.badgeText, { color: catColor }]}>{ev.vibe_count || ev.going || 0}</Text>
    </View>
  </TouchableOpacity>
);

const src = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10 },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  meta: { flexDirection: 'row', gap: 4 },
  metaText: { fontSize: 11 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '800' },
});

// ── Trend tile ────────────────────────────────────────────────────────────────
const TrendTile = ({ spot, rank, primary }) => (
  <View style={[tt.wrap, { backgroundColor: rank < 3 ? `${primary}10` : 'rgba(255,255,255,0.04)' }]}>
    <Image source={{ uri: spot.image || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200' }} style={tt.img} />
    <View style={[tt.rankBadge, { backgroundColor: rank < 3 ? primary : 'rgba(255,255,255,0.15)' }]}>
      <Text style={[tt.rankText, { color: rank < 3 ? '#000' : '#fff' }]}>#{rank + 1}</Text>
    </View>
    <View style={tt.info}>
      <Text style={tt.name} numberOfLines={2}>{spot.description || spot.title}</Text>
      <View style={tt.metaRow}>
        <Feather name="zap" size={10} color={primary} />
        <Text style={[tt.metaText, { color: primary }]}>{spot.rsvp_count || spot.going || 0}</Text>
      </View>
    </View>
  </View>
);

const tt = StyleSheet.create({
  wrap: { width: 130, borderRadius: 16, overflow: 'hidden', marginLeft: 0 },
  img: { width: '100%', height: 100 },
  rankBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  rankText: { fontSize: 10, fontWeight: '900' },
  info: { padding: 10 },
  name: { fontSize: 12, fontWeight: '800', color: '#fff', marginBottom: 5, lineHeight: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '800' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 14, paddingHorizontal: 14, height: 48, borderRadius: 24, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  searchInput: { flex: 1, fontSize: 14 },
  heroSkeleton: { height: 320, borderRadius: 24, marginHorizontal: 16, marginBottom: 20 },
  noResults: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noResultsText: { fontSize: 14 },
  resultCount: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  guestCta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, padding: 18, borderRadius: 20, borderWidth: 1 },
  ctaTitle: { fontSize: 15, fontWeight: '900' },
  ctaSub: { fontSize: 12, marginTop: 3, lineHeight: 16 },
});
