/**
 * SceneLevelUpCard — "you leveled the scene up" (#115). When a venue you're a
 * verified regular at is trending right now, celebrate it: you helped build that.
 * Crosses your Passport regulars with what's hot (heatScore). Hidden when none of
 * your spots are hot, or if reads are RLS-gated.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { buildVibePassport } from '../utils/vibePassport';
import { rankByHeat } from '../utils/heatScore';
import { detectSceneLevelUp } from '../utils/sceneLevelUp';

export function SceneLevelUpCard({ userId }) {
  const { currentTheme } = useTheme();
  const textColor = currentTheme?.text || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [matches, setMatches] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!userId) return undefined;
    (async () => {
      try {
        const cutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 10);
        const [ci, ev] = await Promise.all([
          supabase.from('live_checkins')
            .select('checked_in_at, events(venue_name, city, category)')
            .eq('user_id', userId).limit(2000),
          supabase.from('events')
            .select('title, venue_name, event_date, event_time, going')
            .gte('event_date', cutoff).limit(100),
        ]);
        const tds = (ci.data || []).map((r) => ({
          venue_name: r.events?.venue_name, city: r.events?.city,
          category: r.events?.category, checked_in_at: r.checked_in_at,
        }));
        const regulars = buildVibePassport(tds).regulars;
        const hot = rankByHeat(ev.data || []).slice(0, 12).map((e) => e.venue_name).filter(Boolean);
        if (alive) setMatches(detectSceneLevelUp(regulars, hot));
      } catch { /* RLS-gated or offline — stay hidden */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (!matches.length) return null;
  const top = matches[0];

  return (
    <GlassView style={[s.wrap, { borderColor: 'rgba(249,115,22,0.35)' }]}>
      <View style={s.header}>
        <Feather name="trending-up" size={15} color="#f97316" />
        <Text style={[s.title, { color: textColor }]}>You leveled the scene up</Text>
      </View>
      <Text style={[s.body, { color: muted }]}>
        <Text style={{ color: textColor, fontWeight: '900' }}>{top.venue}</Text> is trending right now
        {top.visits ? ` — and you've Touched Down there ${top.visits}×.` : ' — a spot you helped build.'}
      </Text>
      {matches.length > 1 && (
        <Text style={[s.more, { color: muted }]}>
          +{matches.length - 1} more of your spots {matches.length - 1 === 1 ? 'is' : 'are'} heating up
        </Text>
      )}
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  title: { fontSize: 14, fontWeight: '900' },
  body: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  more: { fontSize: 11, fontWeight: '700', marginTop: 6 },
});
