/**
 * NightlifeTimeDial — 4D Temporal Nightlife Time-Scrubber & City Pulse Telemetry.
 *
 * Nightlife changes hour by hour:
 *   • 8:00 PM:  Lounges, dining & sunset warmups 🌅
 *   • 10:00 PM: Doors open, pre-drinks, early DJs 🍸
 *   • 11:30 PM: Peak headliners, live performances ⚡
 *   • 1:30 AM:  Peak dancefloors & energy 🔥
 *   • 3:00 AM:  Underground after-hours & warehouse raves 🌙
 *   • 5:00 AM:  Sunrise recovery & late night food ☀️
 *
 * Automatically detects the city's current real-time nightlife tempo and
 * gives vibers a tactile, acoustic scrubbing experience.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { cyberAudio } from '../utils/cyberAudio';

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
  // Real-time city tempo detection
  const currentTempo = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 18 && h < 21) return { phase: 'SUNSET WARMUP', color: '#f59e0b', tag: 'PRE-GAME ACTIVE' };
    if (h >= 21 && h < 23) return { phase: 'DOORS & EARLY SETS', color: '#10b981', tag: 'SURGE BUILDING' };
    if (h >= 23 || h < 2) return { phase: 'PEAK HEADLINERS', color: '#00f2ff', tag: 'MAXIMUM ENERGY // 🔥' };
    if (h >= 2 && h < 4) return { phase: 'UNDERGROUND AFTERS', color: '#a855f7', tag: 'WAREHOUSE PULSE' };
    return { phase: 'RECOVERY & RETURN', color: '#38bdf8', tag: 'SAFE RETURN ACTIVE' };
  }, []);

  return (
    <View style={[styles.dialCard, { borderColor: `${primary}35` }]}>
      {/* Outer Cyber Reticles */}
      <View style={[styles.reticle, styles.tl, { borderColor: primary }]} />
      <View style={[styles.reticle, styles.tr, { borderColor: primary }]} />
      <View style={[styles.reticle, styles.bl, { borderColor: primary }]} />
      <View style={[styles.reticle, styles.br, { borderColor: primary }]} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="clock" size={14} color={primary} />
          <Text style={[styles.title, { color: textColor }]}>TEMPORAL NIGHT SCRUBBER</Text>
          <View style={[styles.tempoBadge, { borderColor: `${currentTempo.color}55`, backgroundColor: `${currentTempo.color}15` }]}>
            <View style={[styles.liveDot, { backgroundColor: currentTempo.color }]} />
            <Text style={[styles.tempoText, { color: currentTempo.color }]}>{currentTempo.phase}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            cyberAudio.play('telemetryTick');
            onClose?.();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
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
              onPress={() => {
                cyberAudio.play('telemetryTick');
                onSelectHour(phase.hour);
              }}
              style={[
                styles.slotBtn,
                {
                  borderColor: isActive ? primary : 'rgba(255,255,255,0.12)',
                  backgroundColor: isActive ? 'rgba(0,242,255,0.18)' : 'rgba(255,255,255,0.04)',
                  shadowColor: isActive ? primary : 'transparent',
                  shadowOpacity: isActive ? 0.6 : 0,
                  shadowRadius: 8,
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
    borderWidth: 1.5,
    backgroundColor: 'rgba(10,14,16,0.95)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    zIndex: 36,
    position: 'relative',
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
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tempoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tempoText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
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
  reticle: {
    position: 'absolute',
    width: 6,
    height: 6,
  },
  tl: { top: 2, left: 2, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  tr: { top: 2, right: 2, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  bl: { bottom: 2, left: 2, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  br: { bottom: 2, right: 2, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
});
