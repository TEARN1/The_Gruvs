/**
 * WrappedCard — your Nightlife Wrapped: a verified year in review (#103). Every
 * stat is a real Touch Down, never inflated. Reads the user's check-ins, recaps
 * them with the tested buildWrapped util. Hidden until there's a night to show,
 * or if reads are RLS-gated.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { buildWrapped } from '../utils/nightlifeWrapped';

export function WrappedCard({ userId }) {
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary   || '#00f2ff';
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [w, setW] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!userId) return undefined;
    (async () => {
      try {
        const { data } = await supabase
          .from('live_checkins')
          .select('checked_in_at, events(title, venue_name, city, category)')
          .eq('user_id', userId)
          .limit(2000);
        const tds = (data || []).map((r) => ({
          checked_in_at: r.checked_in_at,
          venue: r.events?.venue_name,
          title: r.events?.title,
          city: r.events?.city,
          scene: r.events?.category,
        }));
        if (alive) setW(buildWrapped(tds));
      } catch { /* RLS-gated or offline — stay hidden */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (!w || w.total === 0) return null; // nothing to recap yet

  const stats = [
    { n: w.total, label: 'nights out' },
    { n: w.venueCount, label: 'venues' },
    { n: w.cityCount, label: 'cities' },
  ];

  return (
    <GlassView style={[s.wrap, { borderColor: `${primary}22` }]}>
      <View style={s.header}>
        <Feather name="award" size={15} color={primary} />
        <Text style={[s.title, { color: textColor }]}>{w.year} Wrapped</Text>
      </View>
      <Text style={[s.headline, { color: primary }]}>{w.headline}</Text>

      <View style={s.stats}>
        {stats.map((st) => (
          <View key={st.label} style={s.stat}>
            <Text style={[s.statN, { color: textColor }]}>{st.n}</Text>
            <Text style={[s.statLabel, { color: muted }]}>{st.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.lines}>
        {w.topVenue && <Line muted={muted} textColor={textColor} label="Home base" value={`${w.topVenue.name} ·${w.topVenue.count}×`} />}
        {w.topScene && <Line muted={muted} textColor={textColor} label="Your scene" value={w.topScene.name} />}
        {w.busiestMonth && w.busiestMonth.count > 0 && (
          <Line muted={muted} textColor={textColor} label="Biggest month" value={`${w.busiestMonth.name} ·${w.busiestMonth.count}`} />
        )}
      </View>
    </GlassView>
  );
}

function Line({ label, value, muted, textColor }) {
  return (
    <View style={s.line}>
      <Text style={[s.lineLabel, { color: muted }]}>{label}</Text>
      <Text style={[s.lineValue, { color: textColor }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '900' },
  headline: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  stat: { alignItems: 'center', flex: 1 },
  statN: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  lines: { marginTop: 14, gap: 7 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  lineLabel: { fontSize: 11, fontWeight: '700' },
  lineValue: { fontSize: 12, fontWeight: '800', flex: 1, textAlign: 'right' },
});
