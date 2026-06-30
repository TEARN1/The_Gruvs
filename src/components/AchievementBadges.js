import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated, Dimensions, Easing,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { GlitterBurst } from './GlitterBurst';

const BADGE_DEFS = [
  { id: 'first_gruv',       icon: 'party-popper',    name: 'First Gruv',       description: 'Created your first event' },
  { id: '100_vibes',        icon: 'lightning-bolt',  name: '100 Vibes',        description: 'Reached 100 vibe score' },
  { id: '500_vibes',        icon: 'fire',            name: 'Vibe Force',       description: 'Reached 500 vibe score' },
  { id: '1000_vibes',       icon: 'crown',           name: 'Royal Viber',      description: 'Reached 1,000 vibe score' },
  { id: 'social_butterfly', icon: 'butterfly',       name: 'Social Butterfly', description: 'Following 50+ people' },
  { id: 'night_owl',        icon: 'owl',             name: 'Night Owl',        description: '5+ RSVPs to late-night events (after 10pm)' },
  { id: 'explorer',         icon: 'map-search',      name: 'Explorer',         description: 'RSVPd to events in 3+ different cities' },
  { id: 'echo_chamber',     icon: 'volume-high',     name: 'Echo Chamber',     description: 'Posted 20+ echoes' },
  { id: 'gruv_master',      icon: 'trophy',          name: 'Gruv Master',      description: 'Posted 5+ events' },
  { id: 'popular_host',     icon: 'star',            name: 'Popular Host',     description: 'An event you posted got 50+ vibes' },
  { id: 'connector',        icon: 'handshake',       name: 'Connector',        description: 'Referred 3+ friends who joined' },
  { id: 'verified_citizen', icon: 'check-decagram',  name: 'Verified',         description: 'Profile fully completed' },
  { id: 'early_adopter',    icon: 'rocket-launch',   name: 'Early Adopter',    description: 'One of the first 500 Vibers' },
  { id: 'super_saver',      icon: 'bookmark',        name: 'Super Saver',      description: 'Saved 20+ events' },
  { id: 'rsvp_king',        icon: 'mailbox',         name: 'RSVP King',        description: 'RSVPd to 10+ events' },
  { id: 'vibe_scout',       icon: 'compass',         name: 'Vibe Scout',       description: 'Checked in 5+ times at local venues' },
  // ── Progression tiers + extra milestones ──────────────────────────────────
  { id: 'event_machine',    icon: 'rocket',                       name: 'Event Machine',  description: 'Posted 10+ events' },
  { id: 'impresario',       icon: 'crown-outline',                name: 'Impresario',     description: 'Posted 25+ events' },
  { id: 'headliner',        icon: 'star-circle',                  name: 'Headliner',      description: 'An event you posted hit 100+ vibes' },
  { id: 'vibe_legend',      icon: 'shield-star',                  name: 'Vibe Legend',    description: 'Reached 2,500 vibe score' },
  { id: 'vibe_deity',       icon: 'flare',                        name: 'Vibe Deity',     description: 'Reached 5,000 vibe score' },
  { id: 'networker',        icon: 'account-multiple',             name: 'Networker',      description: 'Following 10+ people' },
  { id: 'influencer',       icon: 'account-star',                 name: 'Influencer',     description: 'Following 100+ people' },
  { id: 'first_voice',      icon: 'comment-text',                 name: 'First Voice',    description: 'Posted your first echo' },
  { id: 'town_crier',       icon: 'bullhorn',                     name: 'Town Crier',     description: 'Posted 100+ echoes' },
  { id: 'collector',        icon: 'bookmark-multiple',            name: 'Collector',      description: 'Saved 5+ events' },
  { id: 'recruiter',        icon: 'account-plus',                 name: 'Recruiter',      description: 'Referred a friend who joined' },
  { id: 'kingmaker',        icon: 'account-supervisor-circle',    name: 'Kingmaker',      description: 'Referred 10+ friends who joined' },
  { id: 'touched_down',     icon: 'map-marker-check',             name: 'Touched Down',   description: 'Logged your first check-in' },
  { id: 'local_legend',     icon: 'medal',                        name: 'Local Legend',   description: 'Checked in 25+ times' },
  { id: 'committed',        icon: 'calendar-check',               name: 'Committed',      description: 'RSVPd to your first event' },
  { id: 'always_out',       icon: 'calendar-star',                name: 'Always Out',     description: 'RSVPd to 25+ events' },
  { id: 'globetrotter',     icon: 'earth',                        name: 'Globetrotter',   description: 'RSVPd to events in 5+ cities' },
  { id: 'early_bird',       icon: 'weather-sunset-up',            name: 'Early Bird',     description: '5+ RSVPs to daytime events (before noon)' },
];

const checkBadges = async (userId) => {
  const earned = new Set();
  try {
    const [eventsRes, profileRes, followsRes, rsvpsRes, echoesRes, savedRes, referralRes, checkinsRes] =
      await Promise.allSettled([
        supabase.from('events').select('id, vibe_count', { count: 'exact' }).eq('author_id', userId),
        supabase.from('profiles').select('vibe_score, username, bio, avatar_url, city, referral_count').eq('id', userId).single(),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('event_rsvps').select('event_id, events(event_date, event_time, city)').eq('user_id', userId),
        supabase.from('echoes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('saved_events').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('profiles').select('referral_count').eq('id', userId).single(),
        supabase.from('event_checkins').select('event_id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

    const eventCount  = eventsRes.status  === 'fulfilled' ? (eventsRes.value.count   || 0) : 0;
    const vibeScore   = profileRes.status === 'fulfilled' ? (profileRes.value.data?.vibe_score   || 0) : 0;
    const followCount = followsRes.status === 'fulfilled' ? (followsRes.value.count  || 0) : 0;
    const echoCount   = echoesRes.status  === 'fulfilled' ? (echoesRes.value.count   || 0) : 0;
    const savedCount  = savedRes.status   === 'fulfilled' ? (savedRes.value.count    || 0) : 0;
    const refCount    = referralRes.status=== 'fulfilled' ? (referralRes.value.data?.referral_count || 0) : 0;
    const checkinCount = checkinsRes.status === 'fulfilled' ? (checkinsRes.value.count || 0) : 0;
    const profile     = profileRes.status === 'fulfilled' ? profileRes.value.data    : null;

    if (eventCount >= 1)  earned.add('first_gruv');
    if (eventCount >= 5)  earned.add('gruv_master');
    if (eventCount >= 10) earned.add('event_machine');
    if (eventCount >= 25) earned.add('impresario');
    if (vibeScore >= 100)  earned.add('100_vibes');
    if (vibeScore >= 500)  earned.add('500_vibes');
    if (vibeScore >= 1000) earned.add('1000_vibes');
    if (vibeScore >= 2500) earned.add('vibe_legend');
    if (vibeScore >= 5000) earned.add('vibe_deity');
    if (followCount >= 10) earned.add('networker');
    if (followCount >= 50) earned.add('social_butterfly');
    if (followCount >= 100) earned.add('influencer');
    if (echoCount >= 1)    earned.add('first_voice');
    if (echoCount >= 20)   earned.add('echo_chamber');
    if (echoCount >= 100)  earned.add('town_crier');
    if (savedCount >= 5)   earned.add('collector');
    if (savedCount >= 20)  earned.add('super_saver');
    if (refCount >= 1)     earned.add('recruiter');
    if (refCount >= 3)     earned.add('connector');
    if (refCount >= 10)    earned.add('kingmaker');
    if (checkinCount >= 1)  earned.add('touched_down');
    if (checkinCount >= 5)  earned.add('vibe_scout');
    if (checkinCount >= 25) earned.add('local_legend');

    if (profile?.username && profile?.bio && profile?.avatar_url && profile?.city) {
      earned.add('verified_citizen');
    }

    if (eventsRes.status === 'fulfilled') {
      const events = eventsRes.value.data || [];
      if (events.some(e => (e.vibe_count || 0) >= 50))  earned.add('popular_host');
      if (events.some(e => (e.vibe_count || 0) >= 100)) earned.add('headliner');
    }

    if (rsvpsRes.status === 'fulfilled') {
      const rsvps = rsvpsRes.value.data || [];
      if (rsvps.length >= 1)  earned.add('committed');
      if (rsvps.length >= 10) earned.add('rsvp_king');
      if (rsvps.length >= 25) earned.add('always_out');
      let nightCount = 0, morningCount = 0;
      const cities = new Set();
      rsvps.forEach(r => {
        const ev = Array.isArray(r.events) ? r.events[0] : r.events;
        if (ev?.event_time) {
          const hour = parseInt(ev.event_time.split(':')[0], 10);
          if (!isNaN(hour) && (hour >= 22 || hour < 4)) nightCount++;
          if (!isNaN(hour) && hour < 12) morningCount++;
        }
        if (ev?.city) cities.add(ev.city.trim().toLowerCase());
      });
      if (nightCount >= 5) earned.add('night_owl');
      if (morningCount >= 5) earned.add('early_bird');
      if (cities.size >= 3) earned.add('explorer');
      if (cities.size >= 5) earned.add('globetrotter');
    }
  } catch (e) {}
  return earned;
};

const saveEarnedBadges = async (userId, earnedIds) => {
  try {
    await supabase
      .from('profiles')
      .update({ badges: earnedIds })
      .eq('id', userId);
  } catch {}
};

export const AchievementBadges = ({ userId }) => {
  const { currentTheme } = useTheme();
  const [earned, setEarned] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [unlockedBadge, setUnlockedBadge] = useState(null);
  const [confettiActive, setConfettiActive] = useState(false);

  const toastY = useRef(new Animated.Value(-100)).current;

  const primary   = currentTheme?.primary    || "#00f2ff";
  const textColor = currentTheme?.text       || "#ffffff";
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || "#1a1f21";

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Fetch current stored badges to check for fresh unlocks
      const { data: p } = await supabase.from('profiles').select('badges').eq('id', userId).single();
      const prevBadges = new Set(p?.badges || []);

      // 2. Scan earned badges
      const earnedSet = await checkBadges(userId);
      setEarned(earnedSet);
      await saveEarnedBadges(userId, Array.from(earnedSet));

      // 3. Find newly unlocked badge
      const newlyEarned = Array.from(earnedSet).filter(b => !prevBadges.has(b));
      if (newlyEarned.length > 0) {
        const badgeDef = BADGE_DEFS.find(b => b.id === newlyEarned[0]);
        if (badgeDef) {
          setUnlockedBadge(badgeDef);
          setConfettiActive(true);

          // Slide down toast notification
          Animated.sequence([
            Animated.timing(toastY, { toValue: 20, duration: 450, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
            Animated.delay(4000),
            Animated.timing(toastY, { toValue: -120, duration: 400, useNativeDriver: true })
          ]).start(() => {
            setUnlockedBadge(null);
            setConfettiActive(false);
          });
        }
      }
    } catch { }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={ab.loadWrap}>
        <ActivityIndicator color={primary} size="small" />
      </View>
    );
  }

  return (
    <View style={ab.container}>
      <Text style={[ab.sectionTitle, { color: textColor }]}>ACHIEVEMENTS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ab.scrollContent}
      >
        {BADGE_DEFS.map(badge => {
          const isEarned = earned.has(badge.id);
          return (
            <View
              key={badge.id}
              style={[
                ab.badge,
                {
                  backgroundColor: isEarned ? `${primary}12` : `${surface}99`,
                  borderColor: isEarned ? primary : 'rgba(255,255,255,0.1)',
                },
              ]}
            >
              <View style={ab.emojiWrap}>
                <MaterialCommunityIcons name={badge.icon} size={28} color={isEarned ? primary : 'rgba(255,255,255,0.25)'} />
                {!isEarned && (
                  <View style={ab.lockOverlay}>
                    <Feather name="lock" size={10} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
              </View>
              <Text
                style={[
                  ab.badgeName,
                  { color: isEarned ? textColor : muted },
                ]}
                numberOfLines={1}
              >
                {badge.name}
              </Text>
              <Text
                style={[ab.badgeDesc, { color: muted }]}
                numberOfLines={2}
              >
                {badge.description}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Floating Badge Unlock Slide Toast */}
      {unlockedBadge && (
        <Animated.View style={[ab.toast, { backgroundColor: surface, borderColor: primary, transform: [{ translateY: toastY }] }]}>
          <MaterialCommunityIcons name={unlockedBadge.icon} size={24} color={primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: primary, fontSize: 10, fontWeight: '950', letterSpacing: 1 }}>NEW ACHIEVEMENT UNLOCKED!</Text>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 1 }}>{unlockedBadge.name}</Text>
            <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>{unlockedBadge.description}</Text>
          </View>
          {confettiActive && <GlitterBurst />}
        </Animated.View>
      )}
    </View>
  );
};

const ab = StyleSheet.create({
  container: { marginVertical: 8, position: 'relative' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  scrollContent: { paddingHorizontal: 16, gap: 12 },
  badge: {
    width: 110,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  emojiWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  emojiGrey: { opacity: 0.25 },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 2,
  },
  badgeName: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  badgeDesc: { fontSize: 10, textAlign: 'center', lineHeight: 14 },
  loadWrap: { paddingVertical: 20, alignItems: 'center' },
  
  toast: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
