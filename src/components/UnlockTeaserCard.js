/**
 * UnlockTeaserCard — Drop rule 40: the unlock-ladder teaser.
 *
 * One card, once per feed, showing a signed-in Viber how close they are to
 * their NEXT tier and the best thing it unlocks — the leveling system is the
 * retention engine, but it was invisible unless you dug into your profile.
 * Renders nothing for guests or Legends (nothing left to tease).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '../context/AuthContext';
import { getVibeLevel } from '../utils/vibeLevel';
import { unlocksForLevel } from '../utils/levelUnlocks';

export const UnlockTeaserCard = ({ primary = '#00f2ff', surface = '#131a1c', textColor = '#fff', muted = 'rgba(255,255,255,0.55)' }) => {
  const { user, profile } = useAuth();
  if (!user) return null;

  const level = getVibeLevel(profile?.vibe_score || 0);
  if (!level.next) return null; // Legend — nothing left to tease

  const nextUnlocks = unlocksForLevel(level.next).slice(0, 2);

  return (
    <View style={[ut.card, { backgroundColor: surface, borderColor: `${primary}25` }]}>
      <View style={ut.headRow}>
        <Feather name="unlock" size={13} color={primary} />
        <Text style={[ut.head, { color: textColor }]}>
          {level.toNext} points to <Text style={{ color: primary }}>{level.next}</Text>
        </Text>
      </View>

      {/* Progress toward the next tier */}
      <View style={ut.track}>
        <View style={[ut.fill, { width: `${Math.max(4, Math.round(level.progress))}%`, backgroundColor: primary }]} />
      </View>

      {nextUnlocks.map(u => (
        <View key={u.key} style={ut.unlockRow}>
          <Feather name={u.icon} size={11} color={muted} />
          <Text style={[ut.unlockText, { color: muted }]} numberOfLines={1}>{u.label}</Text>
        </View>
      ))}

      <Text style={[ut.hint, { color: `${primary}cc` }]}>
        Touch Down at real Gruvs — presence earns the most.
      </Text>
    </View>
  );
};

const ut = StyleSheet.create({
  card:      { borderRadius: 14, borderWidth: 1, padding: 14, marginHorizontal: 16, marginBottom: 14, gap: 7 },
  headRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  head:      { fontSize: 13, fontWeight: '900' },
  track:     { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill:      { height: '100%', borderRadius: 3 },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  unlockText:{ fontSize: 11, fontWeight: '600', flex: 1 },
  hint:      { fontSize: 10, fontWeight: '700', marginTop: 2 },
});
