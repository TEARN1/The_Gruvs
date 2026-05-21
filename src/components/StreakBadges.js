/**
 * StreakBadges — displays a user's check-in streak and earned badges on their profile.
 * Streak = consecutive weeks with at least one event check-in.
 * Badges are milestone unlocks shown as glowing chips.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

const BADGES = [
  { id: 'first_gruv',    icon: '🎉', label: 'First Gruv',    desc: 'Attended your first event',          threshold: 1  },
  { id: 'three_streak',  icon: '🔥', label: 'On Fire',       desc: '3-week check-in streak',             streak: 3    },
  { id: 'night_owl',     icon: '🦉', label: 'Night Owl',     desc: 'Checked in after midnight 5 times',  special: 'late_checkins', threshold: 5 },
  { id: 'social_magnet', icon: '🧲', label: 'Social Magnet', desc: 'At 10 different events',             threshold: 10 },
  { id: 'royal_viber',   icon: '👑', label: 'Royal Viber',   desc: '5-week check-in streak',             streak: 5    },
  { id: 'explorer',      icon: '🗺️', label: 'Explorer',      desc: 'Events in 3 different cities',       special: 'cities', threshold: 3 },
  { id: 'gruv_master',   icon: '💎', label: 'Gruv Master',   desc: '25 events attended',                 threshold: 25 },
  { id: 'legendary',     icon: '⚡', label: 'Legendary',     desc: '10-week streak — absolute legend',   streak: 10   },
];

const computeStreak = (checkins) => {
  if (!checkins?.length) return 0;
  // Get unique week numbers from check-in dates
  const weeks = new Set(
    checkins.map(c => {
      const d = new Date(c.created_at);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      return `${d.getFullYear()}-${Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)}`;
    })
  );
  const sorted = [...weeks].sort().reverse();
  let streak = 0;
  for (let i = 0; i < sorted.length; i++) {
    const [y, w] = sorted[i].split('-').map(Number);
    if (i === 0) { streak = 1; continue; }
    const [py, pw] = sorted[i - 1].split('-').map(Number);
    const gap = (py * 52 + pw) - (y * 52 + w);
    if (gap === 1) streak++;
    else break;
  }
  return streak;
};

const computeUnlocked = (checkins, streak) => {
  const total = checkins?.length || 0;
  const lateCheckins = checkins?.filter(c => new Date(c.created_at).getHours() >= 0 && new Date(c.created_at).getHours() < 4).length || 0;
  const cities = new Set(checkins?.map(c => c.city).filter(Boolean)).size;

  return BADGES.map(b => {
    let unlocked = false;
    if (b.streak)     unlocked = streak >= b.streak;
    else if (b.special === 'late_checkins') unlocked = lateCheckins >= b.threshold;
    else if (b.special === 'cities')        unlocked = cities >= b.threshold;
    else                                    unlocked = total >= b.threshold;
    return { ...b, unlocked };
  });
};

export const StreakBadges = ({ userId, primary, textColor, muted, surface }) => {
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCheckins = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('event_checkins')
        .select('id, created_at, city')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setCheckins(data || []);
    } catch {}
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchCheckins(); }, [fetchCheckins]);

  if (loading) return <ActivityIndicator size="small" color={primary} style={{ marginVertical: 8 }} />;
  if (checkins.length === 0) return null;

  const streak = computeStreak(checkins);
  const badges = computeUnlocked(checkins, streak);
  const unlockedBadges = badges.filter(b => b.unlocked);
  const nextBadge = badges.find(b => !b.unlocked);

  return (
    <View style={sb.container}>
      {/* Streak header */}
      <View style={[sb.streakCard, { backgroundColor: streak >= 3 ? `${primary}15` : `${primary}08`, borderColor: `${primary}25` }]}>
        <View style={[sb.streakIcon, { backgroundColor: streak >= 3 ? `${primary}25` : `${primary}12` }]}>
          <Text style={{ fontSize: 22 }}>{streak >= 10 ? '⚡' : streak >= 5 ? '👑' : streak >= 3 ? '🔥' : '📅'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[sb.streakNum, { color: primary }]}>{streak}-week streak</Text>
          <Text style={[sb.streakSub, { color: muted }]}>
            {checkins.length} event{checkins.length !== 1 ? 's' : ''} attended total
          </Text>
        </View>
        {nextBadge && (
          <View style={[sb.nextBadge, { borderColor: `${primary}30` }]}>
            <Text style={{ fontSize: 16 }}>{nextBadge.icon}</Text>
            <Text style={[sb.nextLabel, { color: muted }]}>Next</Text>
          </View>
        )}
      </View>

      {/* Badges */}
      {unlockedBadges.length > 0 && (
        <>
          <Text style={[sb.sectionLabel, { color: muted }]}>BADGES EARNED</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {unlockedBadges.map(badge => (
              <View
                key={badge.id}
                style={[sb.badge, { backgroundColor: `${primary}12`, borderColor: `${primary}35` }]}
              >
                <Text style={sb.badgeEmoji}>{badge.icon}</Text>
                <Text style={[sb.badgeLabel, { color: primary }]}>{badge.label}</Text>
                <Text style={[sb.badgeDesc, { color: muted }]} numberOfLines={2}>{badge.desc}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
};

const sb = StyleSheet.create({
  container: { marginBottom: 16, gap: 10 },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  streakIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  streakNum: { fontSize: 16, fontWeight: '900' },
  streakSub: { fontSize: 11, marginTop: 2 },
  nextBadge: { alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 10, padding: 6 },
  nextLabel: { fontSize: 9, fontWeight: '700' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  badge: { width: 90, borderRadius: 14, borderWidth: 1, padding: 10, alignItems: 'center', gap: 4 },
  badgeEmoji: { fontSize: 24 },
  badgeLabel: { fontSize: 11, fontWeight: '900', textAlign: 'center' },
  badgeDesc: { fontSize: 9, textAlign: 'center', lineHeight: 13 },
});
