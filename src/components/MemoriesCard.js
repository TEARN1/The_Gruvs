/**
 * MemoriesCard — "On this day." Resurfaces real anniversaries from the user's
 * Touch Down history (a year ago today you were at X). Self-contained; renders
 * nothing on days with no memories, or if reads are RLS-gated. Only true
 * memories — never fabricated.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { findMemories } from '../utils/memories';

export function MemoriesCard({ userId }) {
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary   || '#00f2ff';
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [memories, setMemories] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!userId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('live_checkins')
          .select('checked_in_at, events(title, venue_name, city)')
          .eq('user_id', userId)
          .limit(1000);
        const tds = (data || []).map((r) => ({ ...(r.events || {}), checked_in_at: r.checked_in_at }));
        if (alive) setMemories(findMemories(tds));
      } catch { /* RLS-gated or offline — stay hidden */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (!memories.length) return null;

  return (
    <GlassView style={[s.wrap, { borderColor: `${primary}18` }]}>
      <View style={s.header}>
        <Feather name="clock" size={15} color="#f59e0b" />
        <Text style={[s.title, { color: textColor }]}>On this day</Text>
      </View>
      {memories.slice(0, 3).map((m, i) => (
        <View key={`${m.date}-${i}`} style={s.row}>
          <Text style={[s.when, { color: '#f59e0b' }]}>{m.when}</Text>
          <Text style={[s.body, { color: muted }]} numberOfLines={1}>
            you Touched Down at <Text style={{ color: textColor, fontWeight: '800' }}>{m.title}</Text>
            {m.city ? ` · ${m.city}` : ''}
          </Text>
        </View>
      ))}
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '900' },
  row: { marginTop: 6 },
  when: { fontSize: 11, fontWeight: '800' },
  body: { fontSize: 12, marginTop: 1 },
});
