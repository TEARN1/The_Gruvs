/**
 * NightlifeTimeDial — 4D Temporal Nightlife Time-Scrubber.
 *
 * Nightlife changes hour by hour:
 *   • 8:00 PM:  Lounges, dining & sunset warmups 🌅
 *   • 10:00 PM: Doors open, pre-drinks, early DJs 🍸
 *   • 11:30 PM: Peak headliners, live performances ⚡
 *   • 1:30 AM:  Peak dancefloors & energy 🔥
 *   • 3:00 AM:  Underground after-hours & warehouse raves 🌙
 *   • 5:00 AM:  Sunrise recovery & late night food ☀️
 *
 * Allows the viber to drag forward in time and watch the city pulse evolve.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

export const NIGHT_PHASES = [
  { hour: null, label: 'All Hours', desc: 'Full city pulse', icon: 'compass' },
  { hour: 20, label: '8:00 PM', desc: 'Warmup & Lounges', icon: 'sunset' },
  { hour: 22, label: '10:00 PM', desc: 'Doors & Pre-Drinks', icon: 'music' },
  { hour: 23, label: '11:30 PM', desc: 'Headliners Peak', icon: 'zap' },
  { hour: 1,  label: '1:30 AM', desc: 'Peak Dancefloors', icon: 'activity' },
  { hour: 3,  label: '3:00 AM', desc: 'Afters & Underground', icon: 'moon' },
  { hour: 5,  label: '5:00 AM', desc: 'Sunrise Recovery', icon: 'sun' },
];

export function NightlifeTimeDial({
  selectedHour = null,
  onSelectHour,
  onClose,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
}) {
  return (
    <View style={styles.dialCard}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="clock" size={15} color={primary} />
          <Text style={[styles.title, { color: textColor }]}>Nightlife Timeline Scrubber</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={16} color={muted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.slotsRow}
      >
        {NIGHT_PHASES.map((phase, idx) => {
          const isActive = selectedHour === phase.hour;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => onSelectHour(phase.hour)}
              style={[
                styles.slotBtn,
                {
                  borderColor: isActive ? primary : 'rgba(255,255,255,0.12)',
                  backgroundColor: isActive ? 'rgba(0,242,255,0.18)' : 'rgba(255,255,255,0.04)',
                },
              ]}
              activeOpacity={0.8}
            >
              <Feather
                name={phase.icon}
                size={14}
                color={isActive ? primary : muted}
              />
              <Text style={[styles.slotLabel, { color: isActive ? primary : textColor }]}>
                {phase.label}
              </Text>
              <Text style={[styles.slotDesc, { color: muted }]}>
                {phase.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dialCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10,14,16,0.95)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    zIndex: 36,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  slotsRow: {
    gap: 8,
    paddingRight: 6,
  },
  slotBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 3,
    minWidth: 96,
  },
  slotLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  slotDesc: {
    fontSize: 9,
    fontWeight: '600',
  },
});
