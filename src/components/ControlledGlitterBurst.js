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
import { View, Text, Animated, Easing, StyleSheet, Platform } from 'react-native';
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
      // Web uses fixed (pseudo-random) trajectories: each becomes a CSS
      // @keyframes rule, and fixed values let the same few rules be reused.
      const r1 = IS_WEB ? ((i * 37) % 11) / 10 : Math.random();
      const r2 = IS_WEB ? ((i * 53) % 7) / 6 : Math.random();
      const angle = (Math.PI * 2 * i) / count + (r1 - 0.5) * 0.45;
      const dist = radius * 0.65 + r2 * (radius * 0.45);
      return {
        angle,
        dist,
        glyph: GLITTER_GLYPHS[i % GLITTER_GLYPHS.length],
        color: colors[i % colors.length],
        spin: (i % 2 ? 1 : -1) * Math.round(180 + r1 * 180),
        size: Math.round(8 + r2 * 6),
      };
    });
  }, [cycle, count, radius, colors]);

  useEffect(() => {
    if (!trigger) return;
    if (enableHaptics) {
      try { haptics.light(); } catch {}
    }
    setCycle((c) => c + 1);
    if (IS_WEB) return;   // web: CSS keyframes below
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 580,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
  }, [trigger, anim, enableHaptics]);

  if (!trigger) return null;

  // Web: one CSS animation per particle (Animated would re-render all of them
  // in JavaScript every frame, right as the panel they open is mounting).
  if (IS_WEB) {
    return (
      <View pointerEvents="none" style={styles.anchor}>
        {particles.map((p, i) => {
          const dx = Math.round(Math.cos(p.angle) * p.dist);
          const dy = Math.round(Math.sin(p.angle) * p.dist);
          return (
            <Text
              key={`${cycle}-${i}`}
              style={[styles.sparkle, {
                color: p.color,
                fontSize: p.size,
                textShadow: `0 0 5px ${p.color}`,
                animationKeyframes: [{
                  '0%': { opacity: 0, transform: 'translate(0px,0px) scale(0.3) rotate(0deg)' },
                  '15%': { opacity: 1 },
                  '35%': { transform: `translate(${Math.round(dx * 0.7)}px,${Math.round(dy * 0.7)}px) scale(1.25) rotate(${Math.round(p.spin * 0.35)}deg)` },
                  '65%': { opacity: 0.9 },
                  '100%': { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(0.4) rotate(${p.spin}deg)` },
                }],
                animationDuration: '580ms',
                animationTimingFunction: 'cubic-bezier(.2,.8,.2,1)',
                animationFillMode: 'both',
              }]}
            >
              {p.glyph}
            </Text>
          );
        })}
      </View>
    );
  }

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
