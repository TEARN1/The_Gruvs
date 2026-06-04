/**
 * HotBadge — "HOT / TURNING UP" pill for events whose engagement is spiking
 * right now (see TrendingManager.fetchHotIds + get_hot_event_ids SQL).
 *
 * Purely presentational: the parent decides whether to render it. Gently
 * pulses so it reads as "live" without being noisy. Zero cost.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';

export const HotBadge = ({ compact = false, style }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        hb.badge,
        compact && hb.badgeCompact,
        Platform.OS === 'web' ? { boxShadow: '0 0 12px rgba(239,68,68,0.7)' } : null,
        { transform: [{ scale: pulse }] },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Turning up right now"
    >
      <Text style={[hb.text, compact && hb.textCompact]}>🔥 {compact ? 'HOT' : 'TURNING UP'}</Text>
    </Animated.View>
  );
};

const hb = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeCompact: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 14 },
  text: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  textCompact: { fontSize: 8, letterSpacing: 0.5 },
});

export default HotBadge;
