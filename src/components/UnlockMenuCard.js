/**
 * UnlockMenuCard — what a Viber has unlocked and what's next, straight from their
 * vibe_score. Pure presentational over the tested vibeLevel + levelUnlocks utils
 * (no fetch). Trust powers are flagged "earned" (never buyable).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { getVibeLevel } from '../utils/vibeLevel';
import { unlockedSoFar, nextUnlocks } from '../utils/levelUnlocks';

export function UnlockMenuCard({ score = 0 }) {
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary   || '#00f2ff';
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const { name, next } = getVibeLevel(score);
  const have = unlockedSoFar(score);
  const upcoming = nextUnlocks(score);

  if (!have.length && !upcoming.length) return null;

  return (
    <GlassView style={[s.wrap, { borderColor: `${primary}18` }]}>
      <View style={s.header}>
        <Feather name="unlock" size={15} color={primary} />
        <Text style={[s.title, { color: primary }]}>Your Powers</Text>
        <Text style={[s.level, { color: muted }]}>{name}</Text>
      </View>

      {have.map((u) => (
        <View key={u.key} style={s.row}>
          <Feather name={u.icon || 'check'} size={13} color="#10b981" />
          <Text style={[s.label, { color: textColor }]} numberOfLines={1}>{u.label}</Text>
          {u.earned && <Feather name="shield" size={10} color="#10b981" />}
        </View>
      ))}

      {next && upcoming.length > 0 && (
        <>
          <Text style={[s.nextHead, { color: muted }]}>UNLOCK AT {next.toUpperCase()}</Text>
          {upcoming.slice(0, 6).map((u) => (
            <View key={u.key} style={[s.row, { opacity: 0.55 }]}>
              <Feather name="lock" size={13} color={muted} />
              <Text style={[s.label, { color: muted }]} numberOfLines={1}>{u.label}</Text>
            </View>
          ))}
        </>
      )}
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 14, fontWeight: '900', flex: 1 },
  level: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  label: { fontSize: 12, fontWeight: '700', flex: 1 },
  nextHead: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 14, marginBottom: 2 },
});
