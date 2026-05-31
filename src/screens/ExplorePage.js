import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  TextInput, Dimensions, Animated, Platform, Modal, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { FadeInView } from '../components/FadeInView';
import { AuraEffect } from '../components/AuraEffect';
import { LiquidBackground } from '../components/LiquidBackground';
import { BrandLogo } from '../components/BrandLogo';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { FeedManager, TrendingManager, DiscoveryManager, UserManager, RealtimeManager, CAT_KEY_TO_SUBCATS, isOnline as checkOnline } from '../services/dataFlow';
import { resilientRead } from '../utils/resilience';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { LocationService } from '../services/locationService';
import { CATEGORY_CONFIG, CATEGORY_KEYS, getCategoryColor } from '../constants/CategoryConfig';
import { RouteJourneyCard } from '../components/RouteJourneyCard';
import { ServiceMarketplace } from './ServiceMarketplace';
import { ScoutScreen } from './ScoutScreen';
import { DiscoverPeopleScreen } from './DiscoverPeopleScreen';
import { WhoWasThereModal } from '../components/WhoWasThereModal';
import { TutorialCenter } from '../components/TutorialCenter';
import { BREAKPOINT } from '../constants/DesignTokens';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { width } = Dimensions.get('window');

// ── Sport type quick-filter chips ────────────────────────────────────────────
const SPORT_FILTERS = [
  { key: 'soccer',      label: 'Soccer',      icon: '⚽' },
  { key: 'rugby',       label: 'Rugby',        icon: '🏉' },
  { key: 'basketball',  label: 'Basketball',   icon: '🏀' },
  { key: 'cricket',     label: 'Cricket',      icon: '🏏' },
  { key: 'athletics',   label: 'Athletics',    icon: '🏃' },
  { key: 'tennis',      label: 'Tennis',       icon: '🎾' },
  { key: 'boxing',      label: 'Boxing',       icon: '🥊' },
  { key: 'esports',     label: 'Esports',      icon: '🎮' },
  { key: 'golf',        label: 'Golf',         icon: '⛳' },
  { key: 'swimming',    label: 'Swimming',     icon: '🏊' },
  { key: 'volleyball',  label: 'Volleyball',   icon: '🏐' },
  { key: 'cycling',     label: 'Cycling',      icon: '🚴' },
];

const SportFilterRow = ({ activeSport, onSelect, primary }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}
  >
    <TouchableOpacity
      style={[sf.chip, { backgroundColor: !activeSport ? primary : `${primary}20`, borderColor: primary }]}
      onPress={() => onSelect(null)}
    >
      <Text style={[sf.label, { color: !activeSport ? '#000' : primary }]}>All Sports</Text>
    </TouchableOpacity>
    {SPORT_FILTERS.map(s => {
      const active = activeSport === s.key;
      return (
        <TouchableOpacity
          key={s.key}
          style={[sf.chip, { backgroundColor: active ? primary : `${primary}15`, borderColor: active ? primary : `${primary}30` }]}
          onPress={() => onSelect(active ? null : s.key)}
          accessibilityLabel={s.label}
        >
          <Text style={sf.icon}>{s.icon}</Text>
          <Text style={[sf.label, { color: active ? '#000' : primary }]}>{s.label}</Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const sf = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  icon: { fontSize: 13 },
  label: { fontSize: 11, fontWeight: '800' },
});

// ── Mood buckets ───────────────────────────────────────────────────────────────
const MOODS = [
  { key: 'hype',       label: 'Hype',         icon: 'zap',          color: '#f97316', cats: ['music','party','nightlife','rave'] },
  { key: 'chill',      label: 'Chill',         icon: 'coffee',       color: '#06b6d4', cats: ['food','art','wellness','lounge'] },
  { key: 'culture',    label: 'Culture',       icon: 'globe',        color: '#8b5cf6', cats: ['art','film','gallery','heritage'] },
  { key: 'sport',      label: 'Sport',         icon: 'activity',     color: '#10b981', cats: ['sport','fitness','outdoor'] },
  { key: 'family',     label: 'Family',        icon: 'users',        color: '#f59e0b', cats: ['kids','family','carnival'] },
  { key: 'network',    label: 'Network',       icon: 'briefcase',    color: '#3b82f6', cats: ['tech','business','workshop'] },
  { key: 'rave',       label: 'Rave',          icon: 'headphones',   color: '#ec4899', cats: ['rave','edm','techno','nightlife'] },
  { key: 'foodie',     label: 'Foodie',        icon: 'coffee',       color: '#f59e0b', cats: ['food','market','pop-up'] },
  { key: 'romance',    label: 'Romance',       icon: 'heart',        color: '#f43f5e', cats: ['date','social','dinner'] },
  { key: 'spiritual',  label: 'Spiritual',     icon: 'sun',          color: '#a78bfa', cats: ['wellness','retreat','meditation'] },
  { key: 'comedy',     label: 'Comedy',        icon: 'smile',        color: '#facc15', cats: ['comedy','standup','entertainment'] },
  { key: 'fashion',    label: 'Fashion',       icon: 'star',         color: '#e879f9', cats: ['fashion','pop-up','market'] },
  { key: 'outdoor',    label: 'Outdoor',       icon: 'map-pin',      color: '#34d399', cats: ['outdoor','nature','hiking'] },
  { key: 'gaming',     label: 'Gaming',        icon: 'monitor',      color: '#60a5fa', cats: ['esports','gaming','tech'] },
  { key: 'arts',       label: 'Arts & Crafts', icon: 'edit-2',       color: '#fb923c', cats: ['art','gallery','workshop'] },
  { key: 'dance',      label: 'Dance',         icon: 'music',        color: '#f472b6', cats: ['dance','music','party'] },
  { key: 'education',  label: 'Education',     icon: 'book',         color: '#38bdf8', cats: ['workshop','conference','tech'] },
  { key: 'wellness',   label: 'Wellness',      icon: 'heart',        color: '#4ade80', cats: ['wellness','yoga','retreat'] },
  { key: 'social',     label: 'Social',        icon: 'users',        color: '#c084fc', cats: ['social','meetup','networking'] },
  { key: 'heritage',   label: 'Heritage',      icon: 'flag',         color: '#fbbf24', cats: ['heritage','culture','art'] },
  { key: 'film',       label: 'Film & TV',     icon: 'film',         color: '#818cf8', cats: ['film','gallery','entertainment'] },
  { key: 'kids',       label: 'Kids Fun',      icon: 'gift',         color: '#fb7185', cats: ['kids','family','carnival'] },
  { key: 'late_night', label: 'Late Night',    icon: 'moon',         color: '#6366f1', cats: ['nightlife','rave','party'] },
  { key: 'market',     label: 'Market',        icon: 'shopping-bag', color: '#d97706', cats: ['market','food','pop-up','fashion'] },
];

// ── Hero card (featured event of the day) ────────────────────────────────────
const HeroCard = ({ event, primary, onPress }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const getMediaUrl = (item) => {
    if (!item) return null;
    const url = typeof item === 'string' ? item : item.url;
    if (!url) return null;
    return url.includes('?') ? `${url}&w=1200&q=85` : `${url}?w=1200&q=85`;
  };

  const thumb = getMediaUrl(event.media?.[0]);
  const catColor = event.category_color || getCategoryColor(event.category) || primary;

  const isWeb = Platform.OS === 'web';

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    // Items 63-64: hero-card CSS hover class + accessibility
    <TouchableOpacity
      style={[
        hero.wrap,
        isWeb && { boxShadow: '0 15px 45px rgba(0,0,0,0.6)', cursor: 'pointer' }
      ]}
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`Featured event: ${event.title}${eventDate ? ', ' + eventDate : ''}${event.venue_name ? ', at ' + event.venue_name : ''}`}
      {...(isWeb ? { className: 'hero-card' } : {})}
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
  wrap: { height: Math.min(320, Math.max(240, width * 0.75)), borderRadius: 24, overflow: 'hidden', marginHorizontal: 16, marginBottom: 20 },
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
// Items 65-66: radiogroup semantics + scale transition on active mood
const MoodRow = ({ activeMoods, onSelect, primary }) => (
  <View accessibilityRole="radiogroup" accessibilityLabel="Select your mood">
    <ScrollView
      showsVerticalScrollIndicator={false}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 4 }}
    >
      {MOODS.map(m => {
        const isActive = activeMoods.has(m.key);
        return (
          <TouchableOpacity
            key={m.key}
            style={[
              mr.btn,
              {
                backgroundColor: isActive ? m.color : `${m.color}15`,
                borderColor: isActive ? m.color : `${m.color}30`,
                transform: [{ scale: isActive ? 1.05 : 1 }],
              },
              Platform.OS === 'web' && { transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1), background-color 150ms ease' },
            ]}
            onPress={() => onSelect(m.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={m.label}
          >
            <Feather name={m.icon} size={14} color={isActive ? '#000' : m.color} />
            <Text style={[mr.text, { color: isActive ? '#000' : m.color }]}>{m.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
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
          // Items 67-68: accessible label + web hover via className
          <TouchableOpacity
            key={key}
            style={[
              cg.cell,
              { backgroundColor: `${cfg.color}12`, borderColor: `${cfg.color}25` },
              Platform.OS === 'web' && { cursor: 'pointer', transition: 'transform 150ms ease, box-shadow 150ms ease' },
            ]}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityLabel={`${cfg.label} category${count > 0 ? ', ' + count + ' events' : ''}`}
            {...(Platform.OS === 'web' ? { className: 'category-cell' } : {})}
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
        {vibers.map((v, i) => (
          <TouchableOpacity 
            key={v.profile_id || v.id} 
            style={nv.wrap} 
            onPress={() => onPress(v)}
            activeOpacity={0.75}
          >
            <View style={[nv.ring, { borderColor: `${primary}30` }]}>
              <View style={{ width: 54, height: 54, borderRadius: 27, overflow: 'hidden' }}>
                {v.avatar_url
                  ? <Image source={{ uri: v.avatar_url }} style={nv.avatar} />
                  : <View style={[nv.avatar, { backgroundColor: ['#0891b2','#7c3aed','#059669'][(v.username?.charCodeAt(0)||0)%3], alignItems:'center', justifyContent:'center' }]}>
                      <Text style={{ color:'#fff', fontWeight:'900', fontSize:14 }}>{(v.username||'V')[0].toUpperCase()}</Text>
                    </View>
                }
              </View>
              {checkOnline(v) && <View style={[nv.dot, { backgroundColor: '#10b981', borderColor: '#0d1112', borderWidth: 2 }]} />}
            </View>
            <View style={{ marginTop: 4, alignItems: 'center' }}>
              <Text style={[nv.name, { color: textColor, fontWeight: '800' }]} numberOfLines={1}>@{v.username}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Feather name="map-pin" size={8} color={primary} />
                <Text style={[nv.dist, { color: primary, fontSize: 9, fontWeight: '900' }]}>
                  {typeof v.distance_km === 'number' ? `${v.distance_km.toFixed(1)}km` : 'Near'}
                </Text>
              </View>
            </View>
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
  const thumb = event.media?.[0]?.url || (typeof event.media?.[0] === 'string' ? event.media[0] : null) || null;
    const isWeb = Platform.OS === 'web';
    return (
      // Items 69-70: accessible label + aspect-ratio on web prevents CLS
      <TouchableOpacity
        style={[
          et.wrap,
          { borderColor: `${catColor}35` },
          isWeb && { boxShadow: '0 8px 25px rgba(0,0,0,0.45)', aspectRatio: 165 / 210 }
        ]}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Event: ${event.title}, ${event.vibe_count || event.going || 0} vibing`}
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
  wrap: { width: Math.min(165, (width - 48) / 2), height: Math.min(210, (width - 48) / 2 * 1.27), borderRadius: 18, overflow: 'hidden', borderWidth: 1, position: 'relative' },
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
      <TouchableOpacity
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} — ${title}`}
      >
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
  const { applyLocationPrivacy } = useIdentity();

  const [query, setQuery] = useState('');
  const [activeMoods, setActiveMoods] = useState(new Set());
  const [activeCat, setActiveCat] = useState(null);
  const [activeSport, setActiveSport] = useState(null);
  const [featuredEvent, setFeaturedEvent] = useState(null);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [happeningNow, setHappeningNow] = useState([]);
  const [trendingEvents, setTrendingEvents] = useState([]);
  const [nearbyVibers, setNearbyVibers] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [vibeMatches, setVibeMatches] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedViber, setSelectedViber] = useState(null);
  const [viberModalVisible, setViberModalVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marketplaceVisible,  setMarketplaceVisible]  = useState(false);
  const [scoutVisible,        setScoutVisible]        = useState(false);
  const [discoverVisible,     setDiscoverVisible]     = useState(false);
  const [tutorialVisible,     setTutorialVisible]     = useState(false);
  const [appUpdates,          setAppUpdates]          = useState([]);
  const [whoWasThereVisible,  setWhoWasThereVisible]  = useState(false);
  const [routes, setRoutes] = useState([]);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef(null);
  const searchTimer = useRef(null);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  // Shared helper: fetch nearby vibers + priority-sort followed+online first
  const loadNearbyVibers = useCallback(async (uid) => {
    const [nearby, followedIds] = await Promise.all([
      DiscoveryManager.findNearbyVibers(uid, 25).catch(() => []),
      resilientRead(
        async () => {
          const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', uid);
          if (error) throw error;
          return new Set((data || []).map(f => f.following_id));
        },
        async () => {
          const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', uid).limit(200);
          if (error) throw error;
          return new Set((data || []).map(f => f.following_id));
        },
        async () => new Set(),
        new Set(),
        'ExplorePage.loadFollowedIds'
      ),
    ]);
    const list = nearby || [];
    const prioritized = list.filter(v => followedIds.has(v.id || v.profile_id) && checkOnline(v));
    setNearbyVibers(prioritized.length > 0 ? prioritized : list);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [trendingRes, happeningRes, countsRes] = await Promise.allSettled([
        TrendingManager.fetch(8),
        TrendingManager.fetchHappeningNow(),
        TrendingManager.fetchCategoryCounts(),
      ]);

      // Gallery: pull from ALL photo sources across the platform
      setGalleryLoading(true);
      try {
        const twoWeeksAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const [galleryRes, momentsRes, reelsRes, eventMediaRes] = await Promise.allSettled([
          // 1. Event gallery uploads
          supabase.from('event_gallery')
            .select('id, media_url, media_type, caption, event_id, created_at, events(title, category)')
            .eq('media_type', 'image')
            .order('created_at', { ascending: false })
            .limit(30),
          // 2. 24hr event moments (stories)
          supabase.from('event_moments')
            .select('id, media_url, media_type, caption, event_id, created_at, events(title, category)')
            .gte('created_at', twoWeeksAgo)
            .eq('media_type', 'image')
            .order('created_at', { ascending: false })
            .limit(30),
          // 3. Reels thumbnails / cover frames
          supabase.from('reels')
            .select('id, thumbnail_url, cover_url, event_id, created_at, events(title, category)')
            .order('created_at', { ascending: false })
            .limit(20),
          // 4. Events with cover photos (recent events)
          supabase.from('events')
            .select('id, cover_url, image_url, media_urls, title, category, created_at')
            .not('cover_url', 'is', null)
            .neq('is_deleted', true)
            .order('created_at', { ascending: false })
            .limit(30),
        ]);

        const gallery = galleryRes.status === 'fulfilled' ? (galleryRes.value.data || []) : [];
        const moments = momentsRes.status === 'fulfilled' ? (momentsRes.value.data || []) : [];
        const reels   = reelsRes.status === 'fulfilled'   ? (reelsRes.value.data || []).map(r => ({
          id: `reel_${r.id}`, media_url: r.thumbnail_url || r.cover_url,
          event_id: r.event_id, created_at: r.created_at, events: r.events,
        })).filter(r => r.media_url) : [];
        const eventMedia = eventMediaRes.status === 'fulfilled' ? (eventMediaRes.value.data || []).flatMap(ev => {
          const urls = [];
          if (ev.cover_url) urls.push({ id: `ev_cover_${ev.id}`, media_url: ev.cover_url, event_id: ev.id, created_at: ev.created_at, events: { title: ev.title, category: ev.category } });
          // Unpack media_urls array if present
          let mu = ev.media_urls;
          if (typeof mu === 'string') { try { mu = JSON.parse(mu); } catch { mu = null; } }
          if (Array.isArray(mu)) mu.slice(0, 2).forEach((u, i) => {
            if (u && !/\.(mp4|mov|webm)/i.test(u)) urls.push({ id: `ev_media_${ev.id}_${i}`, media_url: u, event_id: ev.id, created_at: ev.created_at, events: { title: ev.title, category: ev.category } });
          });
          return urls;
        }) : [];

        const combined = [...gallery, ...moments, ...reels, ...eventMedia]
          .filter(p => p?.media_url && typeof p.media_url === 'string' && p.media_url.startsWith('http'))
          .reduce((acc, p) => { // dedupe by url
            if (!acc.seen.has(p.media_url)) { acc.seen.add(p.media_url); acc.list.push(p); }
            return acc;
          }, { seen: new Set(), list: [] }).list
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 60);

        setGalleryPhotos(combined);
      } catch { setGalleryPhotos([]); }
      finally { setGalleryLoading(false); }

      const trending = trendingRes.status === 'fulfilled' ? trendingRes.value : [];
      const happening = happeningRes.status === 'fulfilled' ? happeningRes.value : [];
      const counts = countsRes.status === 'fulfilled' ? countsRes.value : {};
      setTrendingEvents(trending);
      setHappeningNow(happening);
      setCategoryCounts(counts);

      try {
        const { data: routeData } = await supabase
          .from('routes')
          .select('*, profiles(username, avatar_url)')
          .eq('active', true)
          .order('join_count', { ascending: false })
          .limit(5);
        setRoutes(routeData || []);
      } catch { setRoutes([]); }

      const featured = happening.reduce((best, e) =>
        (e.vibe_count || e.going || 0) > (best.vibe_count || best.going || 0) ? e : best,
        happening[0] || null
      );
      setFeaturedEvent(featured || null);

      // Mine trending hashtags from recent reels
      try {
        const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: reelCaps } = await supabase
          .from('reels')
          .select('caption')
          .neq('is_deleted', true)
          .gte('created_at', cutoff)
          .limit(200);
        const tagCounts = {};
        (reelCaps || []).forEach(r => {
          (r.caption?.match(/#\w+/g) || []).forEach(tag => {
            const t = tag.toLowerCase();
            tagCounts[t] = (tagCounts[t] || 0) + 1;
          });
        });
        setTrendingHashtags(
          Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([tag, count]) => ({ tag, count }))
        );
      } catch { setTrendingHashtags([]); }

      setLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
          const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
          setUserCoords(coords);

          if (user) {
            const privateCoords = applyLocationPrivacy(coords.lat, coords.lon);
            if (privateCoords) LocationService.saveToProfile(user.id, privateCoords.lat, privateCoords.lon);
            await loadNearbyVibers(user.id);
            try {
              const matches = await DiscoveryManager.findNearbyVibers(user.id, 10);
              setVibeMatches(matches.map(v => ({ ...v, matchScore: Math.min(99, Math.round((v.vibe_score || 0) / 10)), overlap: v.interests?.slice(0, 3) || [] })));
            } catch { setVibeMatches([]); }
          }
          const eventsNear = await DiscoveryManager.findNearbyEvents(coords.lat, coords.lon, 50);
          setNearbyEvents(eventsNear);
        } else if (user) {
          await loadNearbyVibers(user.id);
          const profile = await UserManager.getProfile(user.id);
          if (profile?.lat && profile?.lon) {
            const eventsNear = await DiscoveryManager.findNearbyEvents(profile.lat, profile.lon, 50);
            setNearbyEvents(eventsNear);
          }
        }
      } catch { } finally { setLocationLoading(false); }
    } catch { } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, applyLocationPrivacy, loadNearbyVibers]);

  // App Upgrades — real feature changelog (updated with each release)
  useEffect(() => {
    const CHANGELOG = [
      { id: '20', type: 'FEAT', version: '2.0.5', released_at: '2026-05-29', title: 'Event Management Platform', description: 'Full organizer control panel — lineup builder, stage manager, session schedule, vendor map, live updates for 47+ event types. Sport events get dedicated teams, fixtures, live scoring & league table.' },
      { id: '19', type: 'FIX', version: '2.0.4', released_at: '2026-05-29', title: 'Filter Engine Overhaul', description: 'Category & date filters now correctly match all 1000+ subcategories. Cache invalidation fixed. Scout and Explore now use deep subcategory tree matching.' },
      { id: '18', type: 'FEAT', version: '2.0.4', released_at: '2026-05-28', title: 'Journey Map Persistence', description: 'Pinned events in your Journey now survive app restarts. No more losing your night plan. Unlimited journey pins.' },
      { id: '17', type: 'FIX', version: '2.0.3', released_at: '2026-05-28', title: 'Web Bundle Fixes', description: 'Fixed "module unavailable" errors for Vibe Planner, Tickets, and Wallet on web. QR codes now show a text fallback on web builds.' },
      { id: '16', type: 'FEAT', version: '2.0.2', released_at: '2026-05-26', title: 'Tutorial Center Expanded', description: 'New tutorials: Build Your Journey, Manage Your Event (5-step organizer guide), Event Management category added.' },
      { id: '15', type: 'FEAT', version: '2.0.1', released_at: '2026-05-25', title: 'Universal Sports Platform', description: 'Live scoreboard, match log, league table, player stats, photo/video gallery, commentary for 17 sport types.' },
      { id: '14', type: 'FEAT', version: '2.0.0', released_at: '2026-05-24', title: 'Royal Vibe Events + AI Personalisation', description: 'Recurring Royal Vibe events engine. 12-signal personalisation — your Drop now learns from check-ins, searches, dwell time and crew activity.' },
      { id: '13', type: 'FEAT', version: '1.9.8', released_at: '2026-05-23', title: 'Comprehensive Mobile UX', description: 'Gesture navigation, FAB quick actions, swipe-to-dismiss modals, pull-to-refresh haptics across all screens.' },
      { id: '12', type: 'FEAT', version: '1.9.5', released_at: '2026-05-20', title: 'Social Media & Reels', description: 'Short-form video Reels feed, For You / Following tabs, create & link Reels to events.' },
      { id: '11', type: 'FEAT', version: '1.9.0', released_at: '2026-05-15', title: 'Biz Hub + Store Builder', description: 'Business dashboard, drag-and-drop store builder, campaign/mission system with 3000+ targeting signals.' },
      { id: '10', type: 'FEAT', version: '1.8.5', released_at: '2026-05-10', title: 'Event Chat & Polls', description: 'Live event chat room, host-only announcements, attendee polls, and collaborative playlist.' },
      { id: '9',  type: 'FEAT', version: '1.8.0', released_at: '2026-05-05', title: 'VIP Tier System', description: 'Multi-tier ticket pricing (General, VIP, VVIP), waitlist management, QR ticket generation.' },
      { id: '8',  type: 'FEAT', version: '1.7.5', released_at: '2026-04-28', title: 'Royal Routes', description: 'Community travel groups — squad up with Vibers heading to the same event, split transport costs.' },
      { id: '7',  type: 'FEAT', version: '1.7.0', released_at: '2026-04-20', title: 'Path Map & Crossings', description: 'Digital Footprint visualiser — see everywhere you\'ve been, where paths cross with other Vibers.' },
      { id: '6',  type: 'FEAT', version: '1.6.0', released_at: '2026-04-10', title: 'Scout Map', description: 'Full city event map, radius filter, crew toggle, real-time pins for events near you.' },
    ];
    setAppUpdates(CHANGELOG);

    // Also try to load any additional updates from DB (non-blocking)
    supabase.from('app_updates')
      .select('id, title, description, version, released_at, type')
      .order('released_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data?.length) {
          setAppUpdates(prev => {
            const existing = new Set(prev.map(u => u.id));
            const newOnes = data.filter(u => !existing.has(String(u.id)));
            return [...newOnes, ...prev].slice(0, 20);
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();

    // Real-time: auto-update feed without manual refresh
    const unsub = RealtimeManager.subscribeToFeed(
      (newEvent) => {
        // Prepend new Gruv to the top of "Happening Now"
        setHappeningNow(prev => {
          const already = prev.some(e => e.id === newEvent.id);
          if (already) return prev;
          return [newEvent, ...prev].slice(0, 8);
        });
        // Also set as featured if it has the highest vibe count
        setFeaturedEvent(prev => {
          if (!prev) return newEvent;
          return (newEvent.vibe_count || 0) > (prev.vibe_count || 0) ? newEvent : prev;
        });
      },
      (updatedEvent) => {
        // Update vibe_count / going count in all lists in-place
        const patch = (list) => list.map(e => e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e);
        setHappeningNow(patch);
        setTrendingEvents(patch);
        setNearbyEvents(patch);
        setFeaturedEvent(prev => prev?.id === updatedEvent.id ? { ...prev, ...updatedEvent } : prev);
      }
    );
    return () => unsub();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); setUserResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { events, users } = await FeedManager.searchAll(query);
        setSearchResults(events || []);
        setUserResults(users || []);
      } catch { setSearchResults([]); setUserResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const [catFilteredEvents, setCatFilteredEvents] = useState([]);
  const [catFilterLoading, setCatFilterLoading] = useState(false);

  const onMoodSelect = useCallback((key) => {
    setActiveMoods(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    setActiveCat(null);
  }, []);

  // When a category is selected, fetch ALL events from the DB for that category
  useEffect(() => {
    if (!activeCat) { setCatFilteredEvents([]); return; }
    setCatFilterLoading(true);
    const subCats = CAT_KEY_TO_SUBCATS[activeCat] || new Set([activeCat]);
    const catList = [...subCats];
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('events')
      .select('id, title, category, event_date, event_time, venue_name, city, cover_url, image_url, media_urls, vibe_count, price, lat, lon, profiles!author_id(username, avatar_url)')
      .in('category', catList)
      .gte('event_date', today)
      .neq('is_deleted', true)
      .neq('is_cancelled', true)
      .order('vibe_count', { ascending: false })
      .limit(40)
      .then(({ data, error }) => {
        if (!error && data?.length) { setCatFilteredEvents(data); }
        else {
          // Fallback: filter from already-loaded events
          const matchesCatSet = (e) => {
            const eCat = e.category?.toLowerCase();
            return (eCat && subCats.has(eCat)) || (Array.isArray(e.categories) && e.categories.some(c => subCats.has(c?.toLowerCase())));
          };
          setCatFilteredEvents([...happeningNow, ...trendingEvents].filter(matchesCatSet));
        }
        setCatFilterLoading(false);
      })
      .catch(() => { setCatFilterLoading(false); });
  }, [activeCat, happeningNow, trendingEvents]);

  const filteredEvents = useMemo(() => {
    const matchesCatSet = (e, catSet) => {
      if (!catSet) return true;
      const eCat = e.category?.toLowerCase();
      if (eCat && catSet.has(eCat)) return true;
      if (Array.isArray(e.categories) && e.categories.some(c => catSet.has(c?.toLowerCase()))) return true;
      return false;
    };
    if (activeCat) {
      // Use DB-fetched results if available, otherwise filter in-memory
      return catFilteredEvents.length > 0 ? catFilteredEvents :
        happeningNow.filter(e => matchesCatSet(e, CAT_KEY_TO_SUBCATS[activeCat] || new Set([activeCat])));
    }
    if (activeMoods.size > 0) {
      const allCats = new Set(MOODS.filter(m => activeMoods.has(m.key)).flatMap(m => m.cats));
      const moodFiltered = happeningNow.filter(e => matchesCatSet(e, allCats));
      return activeSport ? moodFiltered.filter(e => e.sport_type === activeSport) : moodFiltered;
    }
    if (activeSport) {
      return happeningNow.filter(e => e.sport_type === activeSport || e.category === 'sport');
    }
    return happeningNow;
  }, [happeningNow, trendingEvents, activeCat, activeMoods, catFilteredEvents, activeSport]);

  const isSearching = query.trim().length > 0;
  const renderWelcome = () => {
    if (!user || !user.created_at) return null;
    const isNew = new Date() - new Date(user.created_at) < 86400000; // 24 hours
    if (!isNew) return null;

    return (
      <FadeInView delay={300} direction="up">
        <View style={[styles.welcomeCard, { backgroundColor: `${primary}10`, borderColor: `${primary}30` }]}>
          <View style={styles.welcomeInfo}>
            <Text style={[styles.welcomeTitle, { color: textColor }]}>Welcome, {user.user_metadata?.display_name || 'Viber'}! 👑</Text>
            <Text style={[styles.welcomeSub, { color: muted }]}>You've unlocked the vibe economy. Find your first gruv or hire a crew today.</Text>
          </View>
          <TouchableOpacity 
            style={[styles.welcomeCta, { backgroundColor: primary }]}
            onPress={() => setMarketplaceVisible(true)}
          >
            <Text style={styles.welcomeCtaText}>Start Discovery</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>
    );
  };

  return (
    <ErrorBoundary label="Explore">
    <View style={[styles.root, { backgroundColor: bg }]}>
      <LiquidBackground intensity={0.8} />
      <AuraEffect />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        onScroll={Platform.OS === 'web' ? (e) => setScrollY(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={Platform.OS === 'web' ? 100 : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadAll}
            tintColor={primary}
            colors={[primary]}
          />
        }
      >
        {renderWelcome()}

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
            accessibilityLabel="Search events, artists, and venues"
            accessibilityHint="Results appear below as you type"
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
                          {u.avatar_url
                            ? <Image source={{ uri: u.avatar_url }} style={[src.thumb, { borderRadius: 30 }]} />
                            : <View style={[src.thumb, { borderRadius: 30, backgroundColor: ['#0891b2','#7c3aed','#059669'][(u.username?.charCodeAt(0)||0)%3], alignItems:'center', justifyContent:'center' }]}>
                                <Text style={{ color:'#fff', fontWeight:'900', fontSize:12 }}>{(u.username||'V')[0].toUpperCase()}</Text>
                              </View>
                          }
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
            {/* ── GRUV SERVICES: Advanced Premium Banner ─────────────────────── */}
            <TouchableOpacity
              onPress={() => setMarketplaceVisible(true)}
              activeOpacity={0.88}
              style={[styles.servBanner, { borderColor: `${primary}45`, backgroundColor: `${primary}08`, marginTop: 10, marginBottom: 20, padding: 18, overflow: 'hidden' }]}
            >
              {/* Decorative background aura for the banner */}
              <View style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: `${primary}15`, blurRadius: 20 }} />
              
              <View style={[styles.servIconWrap, { backgroundColor: `${primary}25`, width: 54, height: 54, borderRadius: 18 }]}>
                <Feather name="truck" size={28} color={primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[styles.servTitle, { color: primary, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }]}>GRUV SERVICES</Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                  <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>LIVE</Text>
                </View>
                <Text style={[styles.servSub, { color: muted, fontSize: 11, lineHeight: 15 }]}>Bakkie hire · Muscle · Event logistics{'\n'}Reliable Vibers active near you.</Text>
              </View>
              <View style={[styles.servCta, { backgroundColor: primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, shadowColor: primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }]}>
                <Text style={[styles.servCtaText, { fontWeight: '900', color: '#000' }]}>Hire</Text>
                <Feather name="arrow-right" size={14} color="#000" />
              </View>
            </TouchableOpacity>

            {/* ── Find Vibers + Who Was There ────────────────────────────── */}
            <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => setDiscoverVisible(true)}
                activeOpacity={0.85}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: `${primary}35`, backgroundColor: `${primary}08` }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="users" size={18} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 }}>Find Vibers</Text>
                  <Text style={{ color: muted, fontSize: 10, marginTop: 1 }}>Search & connect</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setWhoWasThereVisible(true)}
                activeOpacity={0.85}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.35)', backgroundColor: 'rgba(249,115,22,0.06)' }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="clock" size={18} color="#f97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f97316', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 }}>Who Was There</Text>
                  <Text style={{ color: muted, fontSize: 10, marginTop: 1 }}>Find by time & place</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* ── Mood selector ──────────────────────────────────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader title="What's your mood?" textColor={textColor} primary={primary} />
              <MoodRow activeMoods={activeMoods} onSelect={onMoodSelect} primary={primary} />
            </View>

            {/* ── Sport type filter (shown when Sport mood or Sport category active) */}
            {(activeMoods.has('sport') || activeCat === 'sport') && (
              <View style={{ marginBottom: 20 }}>
                <SectionHeader title="Pick a Sport" textColor={textColor} primary={primary} />
                <SportFilterRow activeSport={activeSport} onSelect={setActiveSport} primary={primary} />
              </View>
            )}

            {/* ── Trending hashtags ──────────────────────────────────────── */}
            {trendingHashtags.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <SectionHeader title="Trending Tags" textColor={textColor} primary={primary} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                  {trendingHashtags.map(({ tag, count }) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.hashChip, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}
                      onPress={() => setQuery(tag)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.hashChipText, { color: primary }]}>{tag}</Text>
                      <Text style={[styles.hashChipCount, { color: muted }]}>{count}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Hero card ──────────────────────────────────────────────── */}
            {featuredEvent ? (
              <FadeInView direction="up" delay={0}>
                <HeroCard event={featuredEvent} primary={primary} onPress={() => onNavigateToEvent && onNavigateToEvent(featuredEvent)} />
              </FadeInView>
            ) : loading ? (
              <View style={[styles.heroSkeleton, { backgroundColor: `${primary}12` }]} />
            ) : null}

            {/* ── Nearby vibers (Prominent discovery) ───────────────────── */}
            {nearbyVibers.length > 0 && (
              <View style={{ marginBottom: 20, marginTop: 10 }}>
                <SectionHeader title="Vibers Near You" actionLabel="Find Them" onAction={() => setDiscoverVisible(true)} textColor={textColor} primary={primary} />
                <NearbyVibers vibers={nearbyVibers} primary={primary} textColor={textColor} onPress={(v) => { setSelectedViber(v); setViberModalVisible(true); }} />
              </View>
            )}

            {/* ── Happening Now ───────────────────────────────────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader
                title={activeMoods.size > 0 || activeCat ? `${activeMoods.size > 0 ? MOODS.filter(m => activeMoods.has(m.key)).map(m => m.label).join(' & ') : (CATEGORY_CONFIG[activeCat]?.label || '')} Gruvs` : 'Happening Now'}
                actionLabel="See all"
                onAction={() => { setActiveMoods(new Set()); setActiveCat(null); }}
                textColor={textColor}
                primary={primary}
              />
              {catFilterLoading ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {[1,2,3].map(i => <View key={i} style={[et.wrap, { backgroundColor: `${primary}10` }]} />)}
                </ScrollView>
              ) : filteredEvents.length === 0 && activeCat ? (
                <View style={{ paddingHorizontal: 20, paddingVertical: 18, alignItems: 'center' }}>
                  <Text style={{ fontSize: 28 }}>{CATEGORY_CONFIG[activeCat]?.icon || '🔍'}</Text>
                  <Text style={{ color: muted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                    No {CATEGORY_CONFIG[activeCat]?.label || activeCat} events right now.
                  </Text>
                  <Text style={{ color: `${primary}80`, fontSize: 12, marginTop: 4 }}>Check back soon or post one!</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {(loading ? [{id:'s1'},{id:'s2'},{id:'s3'}] : filteredEvents).map((ev, i) => (
                    loading ? (
                      <View key={ev.id} style={[et.wrap, { backgroundColor: `${primary}10` }]} />
                    ) : (
                      <FadeInView key={ev.id} delay={i * 40} direction="right">
                        <EventTile event={ev} primary={primary} textColor={textColor} muted={muted} onPress={() => onNavigateToEvent && onNavigateToEvent(ev)} />
                      </FadeInView>
                    )
                  ))}
                </ScrollView>
              )}
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
                ) : nearbyEvents.length === 0 ? (
                  <View style={{ paddingHorizontal: 16 }}>
                    <TouchableOpacity 
                      style={[styles.emptyNearby, { borderColor: `${primary}25`, backgroundColor: `${primary}05` }]}
                      onPress={() => onNavigateToEvent && onNavigateToEvent({ id: 'create' })} // Hint to create one
                    >
                      <Feather name="map" size={24} color={primary} />
                      <Text style={[styles.emptyNearbyText, { color: textColor }]}>No gruvs within 50km yet.</Text>
                      <Text style={[styles.emptyNearbySub, { color: muted }]}>Be the first to host one in your area! 🚀</Text>
                    </TouchableOpacity>
                  </View>
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

            {/* ── Vibe Matches (Advanced Matching) ───────────────────────── */}
            {vibeMatches.length > 0 && (
              <View style={{ marginBottom: 25 }}>
                <SectionHeader 
                  title="Vibe Matches" 
                  actionLabel="Discover" 
                  onAction={() => setMarketplaceVisible(true)} 
                  textColor={textColor} 
                  primary={primary} 
                />
                <Text style={{ color: muted, fontSize: 12, paddingHorizontal: 16, marginBottom: 12, marginTop: -8 }}>
                  People near you with matching careers and interests.
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                  {vibeMatches.map((m, i) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => { setSelectedViber(m); setViberModalVisible(true); }}
                      style={{ width: 140, borderRadius: 20, backgroundColor: `${primary}08`, borderWidth: 1, borderColor: `${primary}18`, padding: 12, alignItems: 'center' }}
                    >
                      <View style={{ position: 'relative', marginBottom: 10 }}>
                        {m.avatar_url ? (
                          <Image source={{ uri: m.avatar_url }} style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: primary }} />
                        ) : (
                          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: primary }}>
                            <Text style={{ color: primary, fontWeight: '900', fontSize: 20 }}>{(m.username || 'V')[0].toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 2, borderColor: bg }}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{Math.round(m.matchScore)}%</Text>
                        </View>
                      </View>
                      <Text style={{ color: textColor, fontWeight: '900', fontSize: 13 }} numberOfLines={1}>@{m.username}</Text>
                      <Text style={{ color: primary, fontSize: 10, fontWeight: '700', marginTop: 2 }}>{m.career_title || 'Viber'}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8, justifyContent: 'center' }}>
                        {m.overlap?.slice(0, 2).map(tag => (
                          <View key={tag} style={{ backgroundColor: `${primary}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: primary, fontSize: 8, fontWeight: '800' }}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Happening Now ───────────────────────────────────────────── */}

            {/* ── Trending ────────────────────────────────────────────────── */}
            {trendingEvents.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <SectionHeader title="Trending" textColor={textColor} primary={primary} />
                <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                  {trendingEvents.slice(0, 6).map((spot, i) => (
                    <TrendTile key={spot.event_id || i} spot={spot} rank={i} primary={primary} onPress={() => onNavigateToEvent && onNavigateToEvent(spot)} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Royal Routes (curated multi-stop journeys) ──────────────── */}
            {routes.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <SectionHeader title="Royal Routes" textColor={textColor} primary={primary} />
                {routes.map((route, i) => (
                  <RouteJourneyCard key={route.id || i} route={route} />
                ))}
              </View>
            )}

            {/* ── Scout Map ───────────────────────────────────────────────── */}
            <TouchableOpacity
              onPress={() => setScoutVisible(true)}
              activeOpacity={0.88}
              style={[styles.scoutBanner, { borderColor: `${primary}35`, backgroundColor: `${primary}07` }]}
            >
              <View style={[styles.scoutIconWrap, { backgroundColor: `${primary}20`, borderColor: `${primary}35` }]}>
                <Feather name="map" size={26} color={primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.scoutTitle, { color: primary }]}>SCOUT THE MAP</Text>
                <Text style={[styles.scoutSub, { color: muted }]}>Browse events on a live map · Find Gruvs near you</Text>
              </View>
              <View style={[styles.scoutCta, { backgroundColor: primary }]}>
                <Feather name="navigation" size={14} color="#000" />
              </View>
            </TouchableOpacity>

            {/* ── Category discovery ──────────────────────────────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader title="Browse by Category" textColor={textColor} primary={primary} />
              <CategoryGrid
                onSelect={(key) => { setActiveCat(key); setActiveMoods(new Set()); }}
                primary={primary}
                textColor={textColor}
                muted={muted}
                categoryCounts={categoryCounts}
              />
            </View>

            {/* ── Photo Gallery ───────────────────────────────────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader title="📸 Photos from Gruvs" textColor={textColor} primary={primary} />
              {galleryLoading ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator color={primary} />
                </View>
              ) : galleryPhotos.length === 0 ? (
                <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
                  <Text style={{ color: muted, fontSize: 13 }}>No photos yet — attend events and upload your shots!</Text>
                </View>
              ) : (
                <>
                  {/* 3-column masonry-style grid */}
                  <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 3 }}>
                    {[0, 1, 2].map(col => (
                      <View key={col} style={{ flex: 1, gap: 3 }}>
                        {galleryPhotos
                          .filter((_, i) => i % 3 === col)
                          .map((photo, idx) => {
                            const isLarge = idx === 0 && col === 0;
                            return (
                              <TouchableOpacity
                                key={photo.id}
                                activeOpacity={0.88}
                                style={{ borderRadius: 8, overflow: 'hidden', aspectRatio: isLarge ? 1 : (idx % 2 === 0 ? 1 : 0.75) }}
                              >
                                <Image
                                  source={{ uri: photo.media_url }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                                {/* Overlay with event title */}
                                {photo.events?.title && (
                                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 4, backgroundColor: 'rgba(0,0,0,0.55)' }}>
                                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }} numberOfLines={1}>
                                      {photo.events.title}
                                    </Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    ))}
                  </View>
                  {galleryPhotos.length >= 18 && (
                    <TouchableOpacity style={{ marginHorizontal: 20, marginTop: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: `${primary}30`, alignItems: 'center' }}>
                      <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>View all photos →</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* ── App Updates (Upgrades) ──────────────────────────────────── */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader title="App Upgrades" textColor={textColor} primary={primary} />
              {appUpdates.length === 0 ? (
                <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
                  <Text style={{ color: muted, fontSize: 13 }}>No updates recorded yet.</Text>
                </View>
              ) : (
                appUpdates.map((u) => (
                  <View key={u.id} style={{ marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 14, backgroundColor: `${primary}08`, borderWidth: 1, borderColor: `${primary}20` }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: `${primary}25` }}>
                        <Text style={{ color: primary, fontSize: 10, fontWeight: '800' }}>{u.type?.toUpperCase() || 'UPDATE'}</Text>
                      </View>
                      {u.version ? <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>v{u.version}</Text> : null}
                      <Text style={{ color: muted, fontSize: 10, marginLeft: 'auto' }}>
                        {u.released_at ? new Date(u.released_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </Text>
                    </View>
                    <Text style={{ color: textColor, fontSize: 13, fontWeight: '800', marginBottom: 2 }}>{u.title}</Text>
                    {!!u.description && <Text style={{ color: muted, fontSize: 12, lineHeight: 17 }}>{u.description}</Text>}
                  </View>
                ))
              )}
            </View>

            {/* ── Tutorials ───────────────────────────────────────────────── */}
            <TouchableOpacity
              onPress={() => setTutorialVisible(true)}
              activeOpacity={0.88}
              style={{ marginHorizontal: 20, marginBottom: 20, padding: 18, borderRadius: 16, borderWidth: 1.5, borderColor: `${primary}35`, backgroundColor: `${primary}07`, flexDirection: 'row', alignItems: 'center', gap: 14 }}
            >
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: `${primary}20`, borderWidth: 1, borderColor: `${primary}35`, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="book-open" size={22} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: primary, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>APP TUTORIALS</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>Learn every feature · Master The Gruvs</Text>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: primary, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="chevron-right" size={16} color="#000" />
              </View>
            </TouchableOpacity>

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
        userId={selectedViber?.id || selectedViber?.profile_id}
        onClose={() => setViberModalVisible(false)}
        onNavigateToEvent={(ev) => { setViberModalVisible(false); onNavigateToEvent?.(ev); }}
      />
      <Modal
        visible={marketplaceVisible}
        animationType="slide"
        onRequestClose={() => setMarketplaceVisible(false)}
        statusBarTranslucent
      >
        <ServiceMarketplace
          onAuthRequired={onAuthRequired}
          onClose={() => setMarketplaceVisible(false)}
        />
      </Modal>

      <TutorialCenter
        visible={tutorialVisible}
        onClose={() => setTutorialVisible(false)}
      />
      <Modal
        visible={scoutVisible}
        animationType="slide"
        onRequestClose={() => setScoutVisible(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: bg }}>
          <ScoutScreen
            onNavigateToEvent={(ev) => { setScoutVisible(false); onNavigateToEvent?.(ev); }}
            onAuthRequired={onAuthRequired}
          />
          <TouchableOpacity
            onPress={() => setScoutVisible(false)}
            style={{
              position: 'absolute',
              top: Platform.OS === 'ios' ? 54 : 16,
              left: 16,
              zIndex: 999,
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: `${primary}40`,
            }}
          >
            <Feather name="x" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal
        visible={discoverVisible}
        animationType="slide"
        onRequestClose={() => setDiscoverVisible(false)}
        statusBarTranslucent
      >
        <DiscoverPeopleScreen
          onClose={() => setDiscoverVisible(false)}
          onAuthRequired={onAuthRequired}
        />
      </Modal>

      <WhoWasThereModal
        visible={whoWasThereVisible}
        onClose={() => setWhoWasThereVisible(false)}
        onAuthRequired={onAuthRequired}
      />

      {Platform.OS === 'web' && scrollY > 400 && (
        <TouchableOpacity
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          accessibilityRole="button"
          accessibilityLabel="Scroll to top"
          style={{
            position: 'absolute',
            bottom: 100,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: primary,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 600,
            shadowColor: primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
          }}
        >
          <Feather name="chevron-up" size={22} color="#000" />
        </TouchableOpacity>
      )}
    </View>

    </ErrorBoundary>
  );
};

// ── Search result row ─────────────────────────────────────────────────────────
const SearchResultCard = ({ ev, primary, textColor, muted, catColor, onPress }) => (
  <TouchableOpacity style={[src.wrap, { borderColor: `${catColor}25` }]} onPress={onPress} activeOpacity={0.8}>
    <Image
      source={ev.media?.[0]?.url || (typeof ev.media?.[0] === 'string' ? ev.media[0] : null) ? { uri: ev.media?.[0]?.url || ev.media?.[0] } : {}}
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
const TrendTile = ({ spot, rank, primary, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[tt.wrap, { backgroundColor: rank < 3 ? `${primary}10` : 'rgba(255,255,255,0.04)' }]} activeOpacity={0.85}>
    {spot.image ? <Image source={{ uri: spot.image }} style={tt.img} /> : <View style={[tt.img, { backgroundColor: '#111a1c' }]} />}
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
  </TouchableOpacity>
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
  heroSkeleton: { height: Math.min(320, Math.max(240, width * 0.75)), borderRadius: 24, marginHorizontal: 16, marginBottom: 20 },
  noResults: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noResultsText: { fontSize: 14 },
  resultCount: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  guestCta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, padding: 18, borderRadius: 20, borderWidth: 1 },
  ctaTitle: { fontSize: 15, fontWeight: '900' },
  ctaSub: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  // Services banner
  servBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 20, borderWidth: 1.5 },
  servIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  servTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  servSub: { fontSize: 11, lineHeight: 16 },
  servCta: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  servCtaText: { color: '#000', fontSize: 11, fontWeight: '900' },
  hashChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  hashChipText: { fontSize: 12, fontWeight: '800' },
  hashChipCount: { fontSize: 10, fontWeight: '600' },
  emptyNearby: { padding: 24, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', gap: 8 },
  emptyNearbyText: { fontSize: 14, fontWeight: '800' },
  emptyNearbySub: { fontSize: 12, textAlign: 'center' },
  // Welcome Card
  welcomeCard: { marginHorizontal: 16, marginTop: 10, marginBottom: 20, padding: 20, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  welcomeInfo: { flex: 1, gap: 4 },
  welcomeTitle: { fontSize: 16, fontWeight: '900' },
  welcomeSub: { fontSize: 12, lineHeight: 18 },
  welcomeCta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  welcomeCtaText: { color: '#000', fontSize: 11, fontWeight: '900' },
  // Scout banner
  scoutBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 20, borderWidth: 1.5 },
  scoutIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  scoutTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 3 },
  scoutSub: { fontSize: 11, lineHeight: 16 },
  scoutCta: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
