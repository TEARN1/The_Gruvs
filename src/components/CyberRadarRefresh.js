/**
 * CyberRadarRefresh — Futuristic Holographic Radar Sonar Pull-to-Refresh.
 *
 * Replaces the generic circular loading spinner with a high-tech tactical radar
 * with rotating scanner beams, concentric pulse rings, and coordinate telemetry.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { cyberAudio } from '../utils/cyberAudio';

export function CyberRadarRefresh({
  refreshing = false,
  pullDist = 0,
  threshold = 80,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.6)',
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const triggeredRef = useRef(false);

  // Sound and haptic on reaching release threshold
  useEffect(() => {
    if (pullDist >= threshold && !triggeredRef.current) {
      triggeredRef.current = true;
      cyberAudio.play('sonarPing');
    } else if (pullDist < threshold) {
      triggeredRef.current = false;
    }
  }, [pullDist, threshold]);

  // Continuous radar scan while refreshing
  useEffect(() => {
    let spinLoop = null;
    let pulseLoop = null;

    if (refreshing) {
      cyberAudio.play('radarSweep');
      spinLoop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      );
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      spinLoop.start();
      pulseLoop.start();
    } else {
      spinAnim.setValue(0);
      pulseAnim.setValue(1);
    }

    return () => {
      spinLoop?.stop();
      pulseLoop?.stop();
    };
  }, [refreshing, spinAnim, pulseAnim]);

  if (!refreshing && pullDist <= 5) return null;

  // Spin interpolation
  const spinDeg = refreshing
    ? spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
    : `${Math.min(360, (pullDist / threshold) * 240)}deg`;

  const scale = refreshing
    ? pulseAnim
    : Math.min(1.15, 0.4 + (pullDist / threshold) * 0.65);

  const isLocked = pullDist >= threshold || refreshing;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.radarBox,
          {
            borderColor: isLocked ? primary : `${primary}45`,
            backgroundColor: 'rgba(8, 12, 14, 0.92)',
            transform: [{ scale }],
            shadowColor: primary,
            shadowOpacity: isLocked ? 0.6 : 0.2,
            shadowRadius: isLocked ? 12 : 4,
          },
        ]}
      >
        {/* Outer Tech Reticles */}
        <View style={[styles.corner, styles.tl, { borderColor: primary }]} />
        <View style={[styles.corner, styles.tr, { borderColor: primary }]} />
        <View style={[styles.corner, styles.bl, { borderColor: primary }]} />
        <View style={[styles.corner, styles.br, { borderColor: primary }]} />

        {/* Concentric Radar Rings */}
        <View style={[styles.ring, styles.outerRing, { borderColor: `${primary}30` }]}>
          <View style={[styles.ring, styles.innerRing, { borderColor: `${primary}50` }]} />
          <View style={[styles.centerPoint, { backgroundColor: primary }]} />
        </View>

        {/* 360-Degree Rotating Radar Beam */}
        <Animated.View
          style={[
            styles.beamWrap,
            {
              transform: [{ rotate: spinDeg }],
            },
          ]}
        >
          <View style={[styles.beamLine, { backgroundColor: primary }]} />
        </Animated.View>

        {/* Status Telemetry Text */}
        <View style={styles.telemetry}>
          <View style={styles.telemetryDotRow}>
            <View style={[styles.liveDot, { backgroundColor: isLocked ? '#10b981' : '#f59e0b' }]} />
            <Text style={[styles.telemetryTitle, { color: primary }]}>
              {refreshing
                ? 'CALIBRATING GRID NODES...'
                : isLocked
                ? 'RELEASE TO SCAN // SYNC READY'
                : 'PULL DOWN TO SCAN RADAR'}
            </Text>
          </View>
          <Text style={[styles.telemetryCoords, { color: muted }]}>
            {refreshing ? 'FREQ 432.8 MHZ · RE-INDEXING FEED' : 'LOCAL MESH // LOW-LATENCY'}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  radarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    position: 'relative',
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
      : {}),
  },
  ring: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 38,
    height: 38,
    position: 'relative',
  },
  innerRing: {
    width: 22,
    height: 22,
  },
  centerPoint: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  beamWrap: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  beamLine: {
    width: 2,
    height: 19,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  telemetry: {
    gap: 2,
  },
  telemetryDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  telemetryTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  telemetryCoords: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  corner: {
    position: 'absolute',
    width: 7,
    height: 7,
  },
  tl: { top: -2, left: -2, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  tr: { top: -2, right: -2, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  br: { bottom: -2, right: -2, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
});
