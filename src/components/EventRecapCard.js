/**
 * EventRecapCard — the post-event truth. After a Gruv ends, it weighs intent
 * (who RSVP'd) against reality (verified Touch Downs) and renders the verdict
 * organizers can't spin: show rate, no-shows, overflow. Reads the live_checkins
 * count for the event; uses the tested buildEventRecap util. Hidden when there's
 * nothing to recap or reads are RLS-gated. Verified presence only.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { buildEventRecap } from '../utils/eventRecap';

const TONE = {
  real:  { color: '#10b981', icon: 'check-circle' },
  solid: { color: '#00f2ff', icon: 'users' },
  soft:  { color: '#f59e0b', icon: 'trending-down' },
  none:  { color: '#9ca3af', icon: 'moon' },
};

export function EventRecapCard({ eventId, rsvpd = 0, vibes = 0 }) {
  const { currentTheme } = useTheme();
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [showed, setShowed] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!eventId) return undefined;
    (async () => {
      try {
        const { count } = await supabase
          .from('live_checkins')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId);
        if (alive) setShowed(count || 0);
      } catch { if (alive) setShowed(0); }
    })();
    return () => { alive = false; };
  }, [eventId]);

  if (showed === null) return null;                 // still loading
  if (showed === 0 && (Number(rsvpd) || 0) === 0) return null; // nothing to recap

  const recap = buildEventRecap({ rsvpd, showed, vibes });
  const tone = TONE[recap.tone] || TONE.solid;

  return (
    <GlassView style={[s.wrap, { borderColor: `${tone.color}33` }]}>
      <View style={s.header}>
        <Feather name={tone.icon} size={15} color={tone.color} />
        <Text style={[s.title, { color: textColor }]}>{recap.verdict}</Text>
        {recap.showRate != null && (
          <Text style={[s.rate, { color: tone.color }]}>{recap.showRate}%</Text>
        )}
      </View>

      <View style={s.stats}>
        <Stat n={recap.showed} label="Touched down" color={tone.color} textColor={textColor} muted={muted} />
        <Stat n={recap.rsvpd} label="Locked in" color={muted} textColor={textColor} muted={muted} />
        {recap.noShows > 0
          ? <Stat n={recap.noShows} label="No-shows" color={muted} textColor={textColor} muted={muted} />
          : recap.overflow > 0
            ? <Stat n={`+${recap.overflow}`} label="Walked in" color={tone.color} textColor={textColor} muted={muted} />
            : <Stat n={recap.vibes} label="Vibes" color={muted} textColor={textColor} muted={muted} />}
      </View>

      {recap.showRate != null && (
        <Text style={[s.foot, { color: muted }]}>
          {recap.showRate}% of the people who locked in actually showed — verified, not claimed.
        </Text>
      )}
    </GlassView>
  );
}

function Stat({ n, label, color, textColor, muted }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statN, { color: color === muted ? textColor : color }]}>{n}</Text>
      <Text style={[s.statLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '900', flex: 1 },
  rate: { fontSize: 16, fontWeight: '900' },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1 },
  statN: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  foot: { fontSize: 11, fontWeight: '600', marginTop: 12, lineHeight: 15 },
});
