/**
 * LineupRail — the honest heat leaderboard. Ranks the Gruvs it's handed by
 * verified heat (presence > momentum > imminence) via the tested heatScore util,
 * NOT by personal taste. Presentational: pass it `events`, it ranks + renders.
 * Renders nothing if there's nothing live. Tap a row to open the Gruv.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { StatusDot } from './StatusDot';
import { rankByHeat } from '../utils/heatScore';

const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold / silver / bronze

export function LineupRail({ events = [], onEventPress, limit = 5 }) {
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary   || '#00f2ff';
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const ranked = useMemo(() => rankByHeat(events).slice(0, limit), [events, limit]);
  if (!ranked.length) return null;

  return (
    <GlassView style={[s.wrap, { borderColor: `${primary}18` }]}>
      <View style={s.header}>
        <Feather name="trending-up" size={15} color="#ef4444" />
        <Text style={[s.title, { color: textColor }]}>The Lineup</Text>
        <Text style={[s.sub, { color: muted }]}>hottest right now</Text>
      </View>

      {ranked.map((e, i) => {
        const here = Number(e.here_count ?? e.touchdown_count ?? 0);
        const buzz = (Number(e.vibe_count) || 0) + (Number(e.going) || 0);
        const signal = here > 0 ? `${here} here now` : buzz > 0 ? `${buzz} vibing` : 'fresh';
        return (
          <TouchableOpacity
            key={e.id ?? `${e.title}-${i}`}
            style={s.row}
            activeOpacity={0.7}
            onPress={() => onEventPress && onEventPress(e)}
          >
            <Text style={[s.rank, { color: MEDAL[i] || muted }]}>{i + 1}</Text>
            <Text style={[s.name, { color: textColor }]} numberOfLines={1}>
              {e.title || 'Untitled Gruv'}
            </Text>
            <View style={s.signalWrap}>
              {here > 0 && <StatusDot status="live" size={6} />}
              <Text style={[s.signal, { color: here > 0 ? '#10b981' : muted }]} numberOfLines={1}>
                {signal}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 11, fontWeight: '700', flex: 1, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9 },
  rank: { fontSize: 15, fontWeight: '900', width: 18, textAlign: 'center' },
  name: { fontSize: 13, fontWeight: '700', flex: 1 },
  signalWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 96 },
  signal: { fontSize: 11, fontWeight: '800' },
});
