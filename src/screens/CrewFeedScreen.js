import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, RefreshControl, Platform, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { FadeInView } from '../components/FadeInView';
import { AuraEffect } from '../components/AuraEffect';
import { BrandLogo } from '../components/BrandLogo';
import { SkeletonCard } from '../components/SkeletonCard';
import { FollowingFeedManager, ActivityFeedManager, TrendingManager } from '../services/dataFlow';
import { SPACING, RADIUS, FONT } from '../constants/DesignTokens';
import { DiscoverPeopleScreen } from './DiscoverPeopleScreen';

// ── Relative time helper ───────────────────────────────────────────────────────
const fmtAge = (ts) => {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── Action verb by activity type ──────────────────────────────────────────────
const VERB = {
  rsvp: 'is going to',
  checkin: 'just touched down at',
  vibe: 'vibed at',
};

const ACTION_ICON = {
  rsvp: 'check-circle',
  checkin: 'map-pin',
  vibe: 'zap',
};

const ACTION_COLOR = {
  rsvp: '#10b981',
  checkin: '#f97316',
  vibe: '#00f2ff',
};

// ── Avatar fallback color ──────────────────────────────────────────────────────
const avatarBg = (username) =>
  ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777'][
    (username?.charCodeAt(0) || 0) % 5
  ];

// ── LiveBubble ────────────────────────────────────────────────────────────────
const LiveBubble = ({ item, primary, textColor, muted, onPress }) => {
  const { actor, event } = item;
  return (
    <TouchableOpacity style={lb.wrap} onPress={onPress} activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${actor?.username} is live at ${event?.title}`}
    >
      <View style={lb.avatarWrap}>
        {actor?.avatar_url
          ? <Image source={{ uri: actor.avatar_url }} style={lb.avatar} />
          : <View style={[lb.avatar, { backgroundColor: avatarBg(actor?.username), alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                {(actor?.username || '?')[0].toUpperCase()}
              </Text>
            </View>
        }
        <View style={[lb.dot, { backgroundColor: '#10b981' }]} />
      </View>
      <Text style={[lb.username, { color: textColor }]} numberOfLines={1}>@{actor?.username}</Text>
      <Text style={[lb.venue, { color: muted }]} numberOfLines={1}>{event?.venue_name || event?.title}</Text>
    </TouchableOpacity>
  );
};

const lb = StyleSheet.create({
  wrap: { width: 72, alignItems: 'center', marginRight: 14 },
  avatarWrap: { position: 'relative', marginBottom: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  dot: { position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#0d1112' },
  username: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  venue: { fontSize: 10, textAlign: 'center', marginTop: 1 },
});

// ── CrewEventCard ─────────────────────────────────────────────────────────────
const CrewEventCard = ({ ev, primary, textColor, muted, onPress }) => {
  const imgUri = ev.media?.[0]?.url || ev.media?.[0] || null;
  const dateStr = ev.event_date
    ? new Date(ev.event_date).toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <TouchableOpacity
      style={[ec.wrap, { borderColor: `${primary}20` }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${ev.title}${dateStr ? `, ${dateStr}` : ''}${ev.venue_name ? `, at ${ev.venue_name}` : ''}`}
      {...(Platform.OS === 'web' ? { className: 'event-card', style: [ec.wrap, { borderColor: `${primary}20`, cursor: 'pointer' }] } : {})}
    >
      {imgUri
        ? <Image source={{ uri: imgUri }} style={ec.img} />
        : <View style={[ec.img, { backgroundColor: `${primary}18`, alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="music" size={22} color={primary} />
          </View>
      }
      <View style={{ flex: 1 }}>
        <Text style={[ec.title, { color: textColor }]} numberOfLines={2}>{ev.title}</Text>
        {dateStr ? <Text style={[ec.meta, { color: muted }]}>{dateStr}{ev.venue_name ? ` · ${ev.venue_name}` : ''}</Text> : null}
        {ev.going > 0 && (
          <View style={ec.badge}>
            <Feather name="zap" size={10} color={primary} />
            <Text style={[ec.badgeText, { color: primary }]}>{ev.going} going</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const ec = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.card, padding: 12, marginBottom: 10 },
  img: { width: 72, height: 72, borderRadius: 14 },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 4, lineHeight: 19 },
  meta: { fontSize: 11, marginBottom: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});

// ── ActivityRow ───────────────────────────────────────────────────────────────
const ActivityRow = ({ item, primary, textColor, muted, onPress }) => {
  const { actor, event, type, timestamp } = item;
  const color = ACTION_COLOR[type] || primary;
  return (
    <TouchableOpacity
      style={[ar.wrap, { borderBottomColor: `${primary}12` }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`@${actor?.username} ${VERB[type]} ${event?.title}, ${fmtAge(timestamp)}`}
    >
      <View style={{ position: 'relative' }}>
        {actor?.avatar_url
          ? <Image source={{ uri: actor.avatar_url }} style={ar.avatar} />
          : <View style={[ar.avatar, { backgroundColor: avatarBg(actor?.username), alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>
                {(actor?.username || '?')[0].toUpperCase()}
              </Text>
            </View>
        }
        <View style={[ar.typeIcon, { backgroundColor: color }]}>
          <Feather name={ACTION_ICON[type] || 'zap'} size={8} color="#fff" />
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[ar.line, { color: textColor }]} numberOfLines={2}>
          <Text style={{ fontWeight: '900' }}>@{actor?.username}</Text>
          <Text style={{ fontWeight: '500', color: muted }}> {VERB[type]} </Text>
          <Text style={{ fontWeight: '800' }}>{event?.title}</Text>
        </Text>
        <Text style={[ar.time, { color: muted }]}>{fmtAge(timestamp)}</Text>
      </View>
      <Feather name="chevron-right" size={14} color={muted} />
    </TouchableOpacity>
  );
};

const ar = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  typeIcon: { position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#0d1112' },
  line: { fontSize: 13, lineHeight: 18, marginBottom: 3 },
  time: { fontSize: 11 },
});

// ── Section header ────────────────────────────────────────────────────────────
const SectionLabel = ({ label, color }) => (
  <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
);

// ── VisitorBanner (auth gate) ─────────────────────────────────────────────────
const VisitorBanner = ({ primary, onPress }) => (
  <TouchableOpacity
    style={[styles.visitorBanner, { borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel="Sign in to see your crew's activity"
  >
    <Feather name="users" size={18} color={primary} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={[styles.visitorTitle, { color: primary }]}>See your Crew's activity</Text>
      <Text style={[styles.visitorSub, { color: 'rgba(255,255,255,0.5)' }]}>Sign in to follow Vibers and track what they're on</Text>
    </View>
    <Feather name="chevron-right" size={16} color={primary} />
  </TouchableOpacity>
);

// ── Skeleton activity row ─────────────────────────────────────────────────────
const ActivitySkeleton = ({ muted }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)' }} />
    <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
      <View style={{ width: '70%', height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <View style={{ width: '40%', height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)' }} />
    </View>
  </View>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = ({ icon, message, muted }) => (
  <View style={styles.emptyState}>
    <Feather name={icon} size={32} color={muted} style={{ marginBottom: 10 }} />
    <Text style={[styles.emptyText, { color: muted }]}>{message}</Text>
  </View>
);

// ── Main screen ───────────────────────────────────────────────────────────────
export const CrewFeedScreen = ({ onAuthRequired, onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const [followingEvents,  setFollowingEvents]  = useState([]);
  const [trendingEvents,   setTrendingEvents]   = useState([]);
  const [liveNow,          setLiveNow]          = useState([]);
  const [activity,         setActivity]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [discoverVisible,  setDiscoverVisible]  = useState(false);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#131a1c';

  const loadAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const [feedResult, activityResult, trendingResult] = await Promise.all([
      FollowingFeedManager.fetch(user.id, 0),
      ActivityFeedManager.fetchActivity(user.id),
      TrendingManager.fetch(10),
    ]);
    setFollowingEvents(feedResult.events || []);
    setTrendingEvents(trendingResult || []);
    setLiveNow(activityResult.liveNow);
    setActivity(activityResult.activity);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  const goToEvent = (event) => { if (event) onNavigateToEvent?.(event); };

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <AuraEffect color={primary} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: `${primary}18` }]}>
          <BrandLogo size={34} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={[styles.headerTitle, { color: primary }]}>Crew Feed</Text>
            <Text style={[styles.headerSub, { color: muted }]}>See what your crew's on</Text>
          </View>
          <TouchableOpacity
            onPress={() => setDiscoverVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: primary, backgroundColor: `${primary}18` }}
          >
            <Feather name="users" size={13} color={primary} />
            <Text style={{ color: primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }}>FIND</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {/* Auth gate */}
          {!user && (
            <FadeInView direction="up" delay={50}>
              <VisitorBanner primary={primary} onPress={onAuthRequired} />
            </FadeInView>
          )}

          {/* Live Now */}
          {liveNow.length > 0 && (
            <FadeInView direction="up" delay={80}>
              <SectionLabel label="LIVE NOW" color={muted} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                {liveNow.map((item, i) => (
                  <LiveBubble
                    key={`live-${item.actor?.username}-${i}`}
                    item={item}
                    primary={primary}
                    textColor={textColor}
                    muted={muted}
                    onPress={() => goToEvent(item.event)}
                  />
                ))}
              </ScrollView>
            </FadeInView>
          )}

          {/* Their Gruvs */}
          <SectionLabel label="THEIR GRUVS" color={muted} />
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : followingEvents.length === 0 ? (
            <EmptyState
              icon="users"
              message={user ? "Follow some Vibers to see their upcoming Gruvs" : "Sign in to see events from your crew"}
              muted={muted}
            />
          ) : (
            followingEvents.map((ev, i) => (
              <FadeInView key={ev.id} delay={Math.min(i, 5) * 50} direction="up">
                <CrewEventCard
                  ev={ev}
                  primary={primary}
                  textColor={textColor}
                  muted={muted}
                  onPress={() => goToEvent(ev)}
                />
              </FadeInView>
            )))}
          {trendingEvents.length > 0 && (
            <FadeInView direction="up" delay={120}>
              <SectionLabel label="TRENDING" color={muted} style={{ marginTop: 8 }} />
              {trendingEvents.map((ev, i) => (
                <FadeInView key={`trend-${ev.id}`} delay={Math.min(i, 3) * 50} direction="up">
                  <CrewEventCard
                    ev={ev}
                    primary={primary}
                    textColor={textColor}
                    muted={muted}
                    onPress={() => goToEvent(ev)}
                  />
                </FadeInView>
              ))}
            </FadeInView>
          )}

          <SectionLabel label="ACTIVITY" color={muted} style={{ marginTop: 8 }} />
          {loading ? (
            <>
              <ActivitySkeleton muted={muted} />
              <ActivitySkeleton muted={muted} />
              <ActivitySkeleton muted={muted} />
            </>
          ) : activity.length === 0 ? (
            <EmptyState
              icon="activity"
              message={user ? "No recent activity from your crew" : "Sign in to track what your crew is doing"}
              muted={muted}
            />
          ) : (
            activity.map((item, i) => (
              <FadeInView key={item.id} delay={Math.min(i, 8) * 40} direction="up">
                <ActivityRow
                  item={item}
                  primary={primary}
                  textColor={textColor}
                  muted={muted}
                  onPress={() => goToEvent(item.event)}
                />
              </FadeInView>
            ))
          )}
        </View>
      </ScrollView>

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
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 4,
  },
  visitorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 24,
  },
  visitorTitle: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  visitorSub: { fontSize: 12, lineHeight: 17 },
  emptyState: { alignItems: 'center', paddingVertical: 28, marginBottom: 24 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
