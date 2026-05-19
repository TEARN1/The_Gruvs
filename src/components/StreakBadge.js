import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const getStreakColor = (streak) => {
  if (streak >= 7) return '#f5c518'; // gold
  if (streak >= 3) return '#f97316'; // orange
  return '#6b7280'; // grey
};

// ── StreakBadge component ────────────────────────────────────────────────────
export const StreakBadge = ({ streak = 0 }) => {
  const { currentTheme } = useTheme();
  const color = getStreakColor(streak);
  const bg = currentTheme?.surface || '#1a1f21';

  return (
    <View style={[sb.badge, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Text style={sb.flame}>🔥</Text>
      <Text style={[sb.count, { color }]}>{streak}</Text>
      <Text style={[sb.label, { color }]}>
        {streak === 1 ? 'day' : 'days'}
      </Text>
    </View>
  );
};

// ── useStreak hook ───────────────────────────────────────────────────────────
export const useStreak = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [streak, setStreak] = useState(profile?.current_streak || 0);

  const computeAndSave = useCallback(async () => {
    if (!user) return;

    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_streak, last_active')
        .eq('id', user.id)
        .single();

      if (!prof) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayStr = today.toISOString().split('T')[0];
      const lastActive = prof.last_active ? prof.last_active.split('T')[0] : null;

      if (lastActive === todayStr) {
        // Already updated today, just sync state
        setStreak(prof.current_streak || 0);
        return;
      }

      let newStreak = 1;
      if (lastActive) {
        const lastDate = new Date(lastActive);
        lastDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          // Consecutive day — extend streak
          newStreak = (prof.current_streak || 0) + 1;
        } else {
          // Gap — reset streak
          newStreak = 1;
        }
      }

      await supabase
        .from('profiles')
        .update({ current_streak: newStreak, last_active: todayStr })
        .eq('id', user.id);

      setStreak(newStreak);
      if (refreshProfile) refreshProfile();
    } catch (e) {
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    computeAndSave();
  }, [computeAndSave]);

  // Sync from profile when it changes externally
  useEffect(() => {
    if (profile?.current_streak !== undefined) {
      setStreak(profile.current_streak);
    }
  }, [profile?.current_streak]);

  return streak;
};

const sb = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  flame: { fontSize: 14 },
  count: { fontSize: 13, fontWeight: '900' },
  label: { fontSize: 11, fontWeight: '700' },
});
