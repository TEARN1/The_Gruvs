/**
 * ControlledGlitterBurst — Tight, localized micro-glitter sparkle effect.
 *
 * Designed specifically for reaction buttons, emoji chips, and action badges.
 * Strictly contained to the immediate perimeter (~24–36px radius) around the
 * button so it feels crisp, luminous, and tactile.
 *
 * Features:
 * - 100% Vector particle shapes (glowing discs, diamonds, and sparkle crosses).
 *   Zero raw font glyphs — eliminates font rendering glitches and stuck text.
 * - Self-cleaning lifecycle: unmounts cleanly from DOM / tree after 600ms.
 * - Expanding neon micro-shockwave ring on trigger.
 * - Smooth native / web hardware-accelerated transforms.
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { haptics } from '../utils/haptics';

const IS_WEB = Platform.OS === 'web';
const NEON_PALETTE = ['#00f2ff', '#fde047', '#ff007a', '#10b981', '#a855f7', '#ffffff'];
const SHAPES = ['diamond', 'dot', 'sparkle', 'diamond', 'dot'];

export function ControlledGlitterBurst({
  trigger = 0,
  count = 10,
  radius = 28,
  colors = NEON_PALETTE,
  enableHaptics = true,
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);

  // Generate deterministic, balanced radial trajectories around the button perimeter
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const spread = (Math.PI * 2 * i) / count;
      const angleJitter = ((i * 17) % 5 - 2) * 0.08;
      const angle = spread + angleJitter;
      const dist = radius * 0.7 + (((i * 23) % 7) / 6) * (radius * 0.45);
      const color = colors[i % colors.length];
      const shape = SHAPES[i % SHAPES.length];
      const size = 6 + ((i * 13) % 5);
      const spin = (i % 2 === 0 ? 1 : -1) * (140 + ((i * 31) % 120));

      return {
        id: i,
        angle,
        dist,
        color,
        shape,
        size,
        spin,
      };
    });
  }, [count, radius, colors]);

  useEffect(() => {
    if (!trigger) return;

    setActive(true);
    anim.setValue(0);

    if (enableHaptics) {
      try { haptics.light(); } catch {}
    }

    Animated.timing(anim, {
      toValue: 1,
      duration: 540,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: !IS_WEB,
    }).start();

    // Auto-cleanup: remove all elements from DOM / tree once animation finishes
    const timer = setTimeout(() => {
      setActive(false);
    }, 580);

    return () => clearTimeout(timer);
  }, [trigger, anim, enableHaptics]);

  if (!trigger || !active) return null;

  // Expanding micro-glow ring
  const ringScale = anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.35, 1.1, 1.7],
  });
  const ringOpacity = anim.interpolate({
    inputRange: [0, 0.15, 0.65, 1],
    outputRange: [0.8, 0.6, 0.25, 0],
  });
  const ringColor = colors[0] || '#00f2ff';

  return (
    <View pointerEvents="none" style={styles.anchor}>
      {/* Shockwave ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: radius * 1.5,
            height: radius * 1.5,
            borderRadius: (radius * 1.5) / 2,
            borderColor: ringColor,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
            ...(IS_WEB
              ? { boxShadow: `0 0 10px ${ringColor}` }
              : { shadowColor: ringColor, shadowRadius: 5 }),
          },
        ]}
      />

      {/* Radiant particle bursts */}
      {particles.map((p) => {
        const translateX = anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, Math.cos(p.angle) * (p.dist * 0.75), Math.cos(p.angle) * p.dist],
        });
        const translateY = anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, Math.sin(p.angle) * (p.dist * 0.75), Math.sin(p.angle) * p.dist],
        });
        const opacity = anim.interpolate({
          inputRange: [0, 0.15, 0.7, 1],
          outputRange: [0, 1, 0.85, 0],
        });
        const scale = anim.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [0.2, 1.3, 0],
        });
        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spin}deg`],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.sparkleWrap,
              {
                opacity,
                transform: [{ translateX }, { translateY }, { scale }, { rotate }],
              },
            ]}
          >
            {p.shape === 'dot' ? (
              <View
                style={{
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  backgroundColor: p.color,
                  ...(IS_WEB
                    ? { boxShadow: `0 0 8px ${p.color}, 0 0 3px #ffffff` }
                    : { shadowColor: p.color, shadowRadius: 4, shadowOpacity: 0.9 }),
                }}
              />
            ) : p.shape === 'sparkle' ? (
              <View
                style={{
                  width: p.size + 4,
                  height: p.size + 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    width: 2,
                    height: p.size + 4,
                    borderRadius: 1,
                    backgroundColor: p.color,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    width: p.size + 4,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: p.color,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#ffffff',
                  }}
                />
              </View>
            ) : (
              // diamond
              <View
                style={{
                  width: p.size,
                  height: p.size,
                  borderRadius: 1.5,
                  backgroundColor: p.color,
                  transform: [{ rotate: '45deg' }],
                  ...(IS_WEB
                    ? { boxShadow: `0 0 7px ${p.color}` }
                    : { shadowColor: p.color, shadowRadius: 4, shadowOpacity: 0.9 }),
                }}
              />
            )}
          </Animated.View>
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
    zIndex: 999,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  sparkleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ControlledGlitterBurst;
