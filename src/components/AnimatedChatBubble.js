/**
 * AnimatedChatBubble — Playful, highly animated futuristic chat bubble.
 *
 * Features:
 *   • Elastic pop-in entrance animation with spring physics
 *   • Tactile squish/bounce micro-interaction on touch with haptics
 *   • Double-tap cyber energy wave (neon aura ripple)
 *   • Ambient neon breathing pulse for live messages
 *   • Cyber reticle targeting corners on selection
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { cyberAudio } from '../utils/cyberAudio';

export function AnimatedChatBubble({
  children,
  isMine = false,
  isSelected = false,
  isRecent = false,
  onPress,
  onDoubleTap,
  onLongPress,
  primary = '#00f2ff',
  style,
  bubbleStyle,
}) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const touchScaleAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const waveOpacity = useRef(new Animated.Value(0)).current;
  const breathAnim = useRef(new Animated.Value(0.4)).current;
  const lastTapRef = useRef(0);

  // Pop-in entrance on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 90,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, slideAnim]);

  // Ambient breathing pulse for fresh messages
  useEffect(() => {
    if (!isRecent) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 0.9, duration: 1400, useNativeDriver: false }),
        Animated.timing(breathAnim, { toValue: 0.35, duration: 1400, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isRecent, breathAnim]);

  // Trigger double-tap energy wave
  const triggerEnergyWave = () => {
    cyberAudio.play('lockVibe');
    waveAnim.setValue(1);
    waveOpacity.setValue(0.9);
    Animated.parallel([
      Animated.timing(waveAnim, {
        toValue: 1.45,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(waveOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressIn = () => {
    cyberAudio.play('bubbleSquish');
    Animated.spring(touchScaleAnim, {
      toValue: 0.96,
      tension: 120,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(touchScaleAnim, {
      toValue: 1,
      tension: 90,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      triggerEnergyWave();
      onDoubleTap?.();
    } else {
      onPress?.(triggerEnergyWave);
    }
    lastTapRef.current = now;
  };

  return (
    <Animated.View
      style={[
        styles.root,
        style,
        {
          opacity: opacityAnim,
          transform: [
            { scale: Animated.multiply(scaleAnim, touchScaleAnim) },
            { translateY: slideAnim },
          ],
        },
      ]}
    >
      {/* Radiating Neon Energy Wave on Double-Tap */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.energyWave,
          {
            borderColor: primary,
            opacity: waveOpacity,
            transform: [{ scale: waveAnim }],
          },
        ]}
      />

      <TouchableOpacity
        activeOpacity={0.92}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        onLongPress={onLongPress}
        style={[styles.touchWrap]}
      >
        <Animated.View
          style={[
            styles.bubbleContainer,
            {
              borderTopRightRadius: isMine ? 6 : 20,
              borderTopLeftRadius: isMine ? 20 : 6,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
            },
            bubbleStyle,
            isSelected && {
              borderColor: primary,
              shadowColor: primary,
              shadowOpacity: 0.7,
              shadowRadius: 10,
            },
          ]}
        >
          {/* Cyber Targeting Reticles on Selection */}
          {isSelected && (
            <View pointerEvents="none" style={styles.reticleOverlay}>
              <View style={[styles.reticle, styles.tl, { borderColor: primary }]} />
              <View style={[styles.reticle, styles.tr, { borderColor: primary }]} />
              <View style={[styles.reticle, styles.bl, { borderColor: primary }]} />
              <View style={[styles.reticle, styles.br, { borderColor: primary }]} />
            </View>
          )}

          {children}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    maxWidth: '85%',
  },
  touchWrap: {
    position: 'relative',
  },
  bubbleContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  energyWave: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 2,
    zIndex: 1,
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
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
