/**
 * ControlledGlitterBurst — Tight, localized micro-glitter sparkle effect.
 *
 * Designed specifically for reaction buttons, emoji chips, and action badges.
 * Unlike full-screen confetti, this burst is strictly contained to the immediate
 * boundary (~28–36px radius) around the button so it feels crisp, tactile,
 * and high-end ("controlled glitters").
 *
 * Usage:
 *   const [glitterFx, setGlitterFx] = useState(0);
 *   <TouchableOpacity onPress={() => setGlitterFx(Date.now())} style={{ position: 'relative' }}>
 *     <Text style={{ fontSize: 20 }}>🔥</Text>
 *     <ControlledGlitterBurst trigger={glitterFx} />
 *   </TouchableOpacity>
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { haptics } from '../utils/haptics';

const IS_WEB = Platform.OS === 'web';
const GLITTER_GLYPHS = ['✦', '✨', '⋆', '•', '✧', '★'];
const NEON_PALETTE = ['#00f2ff', '#fde047', '#ff007a', '#10b981', '#a855f7', '#ffffff'];

export function ControlledGlitterBurst({
  trigger = 0,
  count = 10,
  radius = 32,
  colors = NEON_PALETTE,
  enableHaptics = true,
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [cycle, setCycle] = useState(0);

  // Generate tightly controlled particle trajectories around the button perimeter
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const dist = radius * 0.65 + Math.random() * (radius * 0.45);
      return {
        angle,
        dist,
        glyph: GLITTER_GLYPHS[i % GLITTER_GLYPHS.length],
        color: colors[i % colors.length],
        spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 180),
        size: 8 + Math.random() * 6,
      };
    });
  }, [cycle, count, radius, colors]);

  useEffect(() => {
    if (!trigger) return;
    if (enableHaptics) {
      try { haptics.light(); } catch {}
    }
    setCycle((c) => c + 1);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 580,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
  }, [trigger, anim, enableHaptics]);

  if (!trigger) return null;

  return (
    <View pointerEvents="none" style={styles.anchor}>
      {particles.map((p, i) => {
        const translateX = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * p.dist],
        });
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.dist],
        });
        const opacity = anim.interpolate({
          inputRange: [0, 0.15, 0.65, 1],
          outputRange: [0, 1, 0.9, 0],
        });
        const scale = anim.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [0.3, 1.25, 0.4],
        });
        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spin}deg`],
        });

        return (
          <Animated.Text
            key={i}
            style={[
              styles.sparkle,
              {
                color: p.color,
                fontSize: p.size,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }, { rotate }],
                ...(IS_WEB
                  ? { textShadow: `0 0 5px ${p.color}` }
                  : { textShadowColor: p.color, textShadowRadius: 4 }),
              },
            ]}
          >
            {p.glyph}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  sparkle: {
    position: 'absolute',
    fontWeight: '900',
  },
});

export default ControlledGlitterBurst;
