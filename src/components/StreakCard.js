/**
 * StreakCard — your Touch Down streak: consecutive weekends out, celebrated.
 * Reads the user's verified check-ins, computes the streak with the tested
 * touchDownStreak util, and high-fives — never guilt-trips. Hidden until there's
 * a real streak to show, or if reads are RLS-gated. Verified presence only.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { buildTouchDownStreak } from '../utils/touchDownStreak';

export function StreakCard({ userId }) {
  const { currentTheme } = useTheme();
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [streak, setStreak] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!userId) return undefined;
    (async () => {
      try {
        const { data } = await supabase
          .from('live_checkins')
          .select('checked_in_at')
          .eq('user_id', userId)
          .limit(2000);
        const dates = (data || []).map((r) => r.checked_in_at).filter(Boolean);
        if (alive) setStreak(buildTouchDownStreak(dates));
      } catch { /* RLS-gated or offline — stay hidden */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (!streak || streak.longest === 0) return null; // nothing earned yet

  const flame = streak.current >= 2 ? '#f97316' : muted;

  return (
    <GlassView style={[s.wrap, { borderColor: `${flame}33` }]}>
      <View style={s.left}>
        <Feather name="zap" size={20} color={flame} />
        <Text style={[s.big, { color: textColor }]}>{streak.current}</Text>
        <Text style={[s.unit, { color: muted }]}>wknd{streak.current === 1 ? '' : 's'}</Text>
      </View>
      <View style={s.right}>
        <Text style={[s.msg, { color: textColor }]}>{streak.message}</Text>
        <Text style={[s.best, { color: muted }]}>Personal best: {streak.longest} weekend{streak.longest === 1 ? '' : 's'}</Text>
      </View>
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  left: { alignItems: 'center', minWidth: 56 },
  big: { fontSize: 26, fontWeight: '900', lineHeight: 28 },
  unit: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  right: { flex: 1 },
  msg: { fontSize: 14, fontWeight: '800' },
  best: { fontSize: 11, fontWeight: '600', marginTop: 3 },
});
