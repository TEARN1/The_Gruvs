import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';

const BADGE_DEFS = [
  {
    id: 'first_gruv',
    emoji: '🎉',
    name: 'First Gruv',
    description: 'Created your first event',
  },
  {
    id: '100_vibes',
    emoji: '⚡',
    name: '100 Vibes',
    description: 'Reached 100 vibe score',
  },
  {
    id: 'social_butterfly',
    emoji: '🦋',
    name: 'Social Butterfly',
    description: 'Following 50+ people',
  },
  {
    id: 'night_owl',
    emoji: '🦉',
    name: 'Night Owl',
    description: '5+ RSVPs to late-night events (after 10pm)',
  },
  {
    id: 'explorer',
    emoji: '🗺️',
    name: 'Explorer',
    description: 'RSVPd to events in 3+ different cities',
  },
  {
    id: 'echo_chamber',
    emoji: '🔊',
    name: 'Echo Chamber',
    description: 'Posted 20+ echoes',
  },
];

const checkBadges = async (userId) => {
  const earned = new Set();

  try {
    const [
      eventsRes,
      profileRes,
      followsRes,
      rsvpsRes,
      echoesRes,
    ] = await Promise.allSettled([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('profiles').select('vibe_score').eq('id', userId).single(),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
      supabase.from('event_rsvps')
        .select('event_id, events(start_time, city)')
        .eq('user_id', userId),
      supabase.from('echoes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    // First Gruv
    if (eventsRes.status === 'fulfilled' && (eventsRes.value.count || 0) >= 1) {
      earned.add('first_gruv');
    }

    // 100 Vibes
    if (profileRes.status === 'fulfilled' && (profileRes.value.data?.vibe_score || 0) >= 100) {
      earned.add('100_vibes');
    }

    // Social Butterfly
    if (followsRes.status === 'fulfilled' && (followsRes.value.count || 0) >= 50) {
      earned.add('social_butterfly');
    }

    // Night Owl + Explorer
    if (rsvpsRes.status === 'fulfilled') {
      const rsvps = rsvpsRes.value.data || [];
      let nightCount = 0;
      const cities = new Set();

      rsvps.forEach(r => {
        const ev = Array.isArray(r.events) ? r.events[0] : r.events;
        if (ev) {
          if (ev.start_time) {
            const hour = new Date(ev.start_time).getHours();
            if (hour >= 22 || hour < 4) nightCount++;
          }
          if (ev.city) cities.add(ev.city.trim().toLowerCase());
        }
      });

      if (nightCount >= 5) earned.add('night_owl');
      if (cities.size >= 3) earned.add('explorer');
    }

    // Echo Chamber
    if (echoesRes.status === 'fulfilled' && (echoesRes.value.count || 0) >= 20) {
      earned.add('echo_chamber');
    }
  } catch (e) {
    console.log('Badge check error:', e.message);
  }

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

  const primary   = currentTheme?.primary    || '#00f2ff';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const earnedSet = await checkBadges(userId);
      setEarned(earnedSet);
      await saveEarnedBadges(userId, Array.from(earnedSet));
    } catch {}
    setLoading(false);
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
                  backgroundColor: isEarned ? `${primary}18` : `${surface}99`,
                  borderColor: isEarned ? primary : 'rgba(255,255,255,0.1)',
                },
              ]}
            >
              <View style={ab.emojiWrap}>
                <Text style={[ab.emoji, !isEarned && ab.emojiGrey]}>
                  {badge.emoji}
                </Text>
                {!isEarned && (
                  <View style={ab.lockOverlay}>
                    <Feather name="lock" size={11} color="rgba(255,255,255,0.4)" />
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
    </View>
  );
};

const ab = StyleSheet.create({
  container: { marginVertical: 8 },
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
});
