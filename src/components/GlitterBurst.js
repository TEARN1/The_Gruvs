/**
 * GlitterBurst — a lightweight sparkle/particle burst for "wow" moments.
 *
 * Drop it inside a `position: relative` parent (a button, an avatar, a card) and
 * change the `trigger` prop (e.g. to `Date.now()`) whenever you want it to fire.
 * It emits a ring of glittering glyphs that fan out, spin, twinkle and fade — the
 * signature "anime" feel, reusable anywhere. Fully non-interactive + self-cleaning.
 *
 *   const [fx, setFx] = useState(0);
 *   <View style={{ position: 'relative' }}>
 *     <Heart />
 *     <GlitterBurst trigger={fx} />
 *   </View>
 *   // ...on tap: setFx(Date.now())
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet, Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';
const GLYPHS = ['✦', '✧', '⋆', '✨', '★', '❉', '·'];
const COLORS = ['#fde047', '#f0abfc', '#67e8f9', '#ffffff', '#a78bfa', '#fca5a5', '#fcd34d'];

export const GlitterBurst = ({ trigger = 0, count = 14, size = 120, colors = COLORS }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [run, setRun] = useState(0);

  // Re-roll the particle field each fire so no two bursts look identical.
  const particles = useMemo(() => Array.from({ length: count }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    return {
      angle,
      dist: size * 0.26 + Math.random() * size * 0.22,
      glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      color: colors[i % colors.length],
      rot: (Math.random() * 2 - 1) * 300,
      fontSize: 9 + Math.random() * 11,
    };
  }), [run, count, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!trigger) return;
    setRun((r) => r + 1);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trigger) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}>
      {particles.map((p, i) => {
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.dist] });
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * p.dist] });
        const opacity = progress.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] });
        const scale = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.15, 0.55] });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] });
        return (
          <Animated.Text
            key={i}
            style={[
              styles.particle,
              {
                color: p.color,
                fontSize: p.fontSize,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }, { rotate }],
                ...(IS_WEB ? { textShadow: `0 0 6px ${p.color}` } : { textShadowColor: p.color, textShadowRadius: 6 }),
              },
            ]}
          >
            {p.glyph}
          </Animated.Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: '50%', top: '50%', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  particle: { position: 'absolute', fontWeight: '900' },
});

export default GlitterBurst;