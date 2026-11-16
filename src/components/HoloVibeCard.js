/**
 * HoloVibeCard — 3D Holographic Parallax Card Container.
 *
 * Implements:
 *   • True 3D perspective rotation (rotateX, rotateY) driven by touch tilt
 *   • Sliding holographic light-band shimmer reflection
 *   • Cybernetic corner telemetry reticles
 *   • Spring reset on touch release
 */
import React, { useRef } from 'react';
import { View, StyleSheet, Animated, PanResponder, Platform } from 'react-native';
import { cyberAudio } from '../utils/cyberAudio';

export function HoloVibeCard({
  children,
  primary = '#00f2ff',
  glowColor = '#00f2ff',
  style,
  onPress,
}) {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-120)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        cyberAudio.play('telemetryTick');
        Animated.spring(scaleAnim, {
          toValue: 0.98,
          friction: 6,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (e, gesture) => {
        const clampX = Math.max(-12, Math.min(12, -gesture.dy / 3));
        const clampY = Math.max(-12, Math.min(12, gesture.dx / 3));
        rotateX.setValue(clampX);
        rotateY.setValue(clampY);
        shimmerX.setValue(gesture.dx * 1.5);
      },
      onPanResponderRelease: () => {
        Animated.parallel([
          Animated.spring(rotateX, { toValue: 0, tension: 70, friction: 6, useNativeDriver: true }),
          Animated.spring(rotateY, { toValue: 0, tension: 70, friction: 6, useNativeDriver: true }),
          Animated.spring(shimmerX, { toValue: -120, tension: 60, friction: 7, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        ]).start();
        onPress?.();
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(rotateX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(rotateY, { toValue: 0, useNativeDriver: true }),
          Animated.spring(shimmerX, { toValue: -120, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        ]).start();
      },
    })
  ).current;

  const rotXStr = rotateX.interpolate({
    inputRange: [-12, 12],
    outputRange: ['-12deg', '12deg'],
  });
  const rotYStr = rotateY.interpolate({
    inputRange: [-12, 12],
    outputRange: ['-12deg', '12deg'],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.cardContainer,
        style,
        {
          transform: [
            { perspective: 900 },
            { rotateX: rotXStr },
            { rotateY: rotYStr },
            { scale: scaleAnim },
          ],
          shadowColor: glowColor,
          shadowOpacity: 0.45,
          shadowRadius: 14,
        },
      ]}
    >
      {/* Holographic Specular Light Reflection Band */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerBand,
          {
            transform: [{ translateX: shimmerX }, { rotate: '25deg' }],
            backgroundColor: `${primary}18`,
          },
        ]}
      />

      {/* Cyber Reticles */}
      <View pointerEvents="none" style={styles.reticleFrame}>
        <View style={[styles.corner, styles.tl, { borderColor: primary }]} />
        <View style={[styles.corner, styles.tr, { borderColor: primary }]} />
        <View style={[styles.corner, styles.bl, { borderColor: primary }]} />
        <View style={[styles.corner, styles.br, { borderColor: primary }]} />
      </View>

      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1.5,
  },
  shimmerBand: {
    position: 'absolute',
    top: -50,
    bottom: -50,
    width: 65,
    zIndex: 5,
    borderRadius: 30,
  },
  reticleFrame: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  corner: {
    position: 'absolute',
    width: 8,
    height: 8,
  },
  tl: { top: 3, left: 3, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  tr: { top: 3, right: 3, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  bl: { bottom: 3, left: 3, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  br: { bottom: 3, right: 3, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
});
