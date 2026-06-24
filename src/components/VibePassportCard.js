/**
 * VibePassportCard — "what you've collected by showing up."
 * Reads the user's real Touch Downs (live_checkins → events) and renders the
 * Vibe Passport: regulars, cities, top scenes, and earned badges. Self-contained
 * — degrades to an empty/hidden state if there's no data (or reads are RLS-gated
 * until schema_part_4 runs). Stamps are unfakeable — earned only by being there.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { buildVibePassport } from '../utils/vibePassport';

const Chip = ({ icon, label, count, color, muted }) => (
  <View style={[s.chip, { borderColor: `${color}30`, backgroundColor: `${color}10` }]}>
    {icon ? <Feather name={icon} size={10} color={color} /> : null}
    <Text style={[s.chipText, { color }]} numberOfLines={1}>{label}</Text>
    {count != null && <Text style={[s.chipCount, { color: muted }]}>×{count}</Text>}
  </View>
);

const Row = ({ title, children, muted }) => (
  <View style={{ marginTop: 12 }}>
    <Text style={[s.rowTitle, { color: muted }]}>{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {children}
    </ScrollView>
  </View>
);

export function VibePassportCard({ userId }) {
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary   || '#00f2ff';
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [passport, setPassport] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!userId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('live_checkins')
          .select('checked_in_at, events(venue_name, city, category)')
          .eq('user_id', userId)
          .order('checked_in_at', { ascending: false })
          .limit(500);
        const touchDowns = (data || []).map((r) => ({ ...(r.events || {}), checked_in_at: r.checked_in_at }));
        if (alive) setPassport(buildVibePassport(touchDowns));
      } catch { /* RLS-gated or offline — stay hidden */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Hidden until there's something real to show.
  if (!passport || passport.totalTouchDowns === 0) return null;

  const { totalTouchDowns, regulars, cities, scenes, badges } = passport;

  return (
    <GlassView style={[s.wrap, { borderColor: `${primary}18` }]}>
      <View style={s.header}>
        <Feather name="map-pin" size={15} color={primary} />
        <Text style={[s.title, { color: primary }]}>Vibe Passport</Text>
        <Text style={[s.total, { color: muted }]}>{totalTouchDowns} Touch Down{totalTouchDowns !== 1 ? 's' : ''}</Text>
      </View>

      {badges.length > 0 && (
        <Row title="BADGES" muted={muted}>
          {badges.map((b) => <Chip key={b.key} icon="award" label={b.label} color="#f59e0b" muted={muted} />)}
        </Row>
      )}
      {regulars.length > 0 && (
        <Row title="YOUR REGULARS" muted={muted}>
          {regulars.slice(0, 8).map((v) => <Chip key={v.name} icon="star" label={v.name} count={v.count} color="#10b981" muted={muted} />)}
        </Row>
      )}
      {cities.length > 0 && (
        <Row title="CITIES" muted={muted}>
          {cities.slice(0, 10).map((c) => <Chip key={c.name} icon="map" label={c.name} count={c.count} color={primary} muted={muted} />)}
        </Row>
      )}
      {scenes.length > 0 && (
        <Row title="YOUR SCENES" muted={muted}>
          {scenes.slice(0, 10).map((sc) => <Chip key={sc.name} label={sc.name} count={sc.count} color="#8b5cf6" muted={muted} />)}
        </Row>
      )}
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '900', flex: 1 },
  total: { fontSize: 11, fontWeight: '700' },
  rowTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 11, fontWeight: '800', maxWidth: 160 },
  chipCount: { fontSize: 10, fontWeight: '700' },
});
