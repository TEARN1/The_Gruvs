import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ── Put your logo file at:  assets/logo.png  ──────────────────────────────────
// That's the metallic H-crown you shared. Once placed there it auto-loads.
let LOCAL_LOGO = null;
try {
  LOCAL_LOGO = require('../../assets/logo.png');
} catch {
  // File not found — styled text fallback renders instead
}

export const BrandLogo = ({ size = 42, showGlow = false, style }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const accent  = currentTheme?.accent  || '#b8c1c2';
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showGlow) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2400, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2400, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showGlow]);

  const shadowOpacity = showGlow
    ? glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] })
    : 0.45;

  if (LOCAL_LOGO) {
    return (
      <Animated.View style={[{ shadowColor: primary, shadowOpacity, shadowRadius: showGlow ? 18 : 8, shadowOffset: { width: 0, height: 0 }, elevation: 8 }, style]}>
        <Image source={LOCAL_LOGO} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
    );
  }

  // ── Styled fallback: metallic H + crown ───────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          borderColor: primary,
          backgroundColor: `${primary}10`,
          shadowColor: primary,
          shadowOpacity,
          shadowRadius: showGlow ? 20 : 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        },
        style,
      ]}
    >
      {/* Crown tip */}
      <View style={[styles.crownBar, { bottom: size * 0.62, borderBottomColor: primary }]} />
      <View style={[styles.crownLeft,  { bottom: size * 0.58, left: size * 0.22, borderColor: primary }]} />
      <View style={[styles.crownRight, { bottom: size * 0.58, right: size * 0.22, borderColor: primary }]} />
      {/* H letter */}
      <Text style={[styles.letter, { fontSize: size * 0.52, color: accent }]}>H</Text>
      {/* Lightning stripe */}
      <View style={[styles.stripe, { backgroundColor: primary, width: size * 0.62, top: size * 0.45 }]} />
    </Animated.View>
  );
};

// ── Wordmark (header text beside logo) ────────────────────────────────────────
export const BrandWordmark = ({ primary, muted }) => (
  <View style={styles.wordmark}>
    <Text style={[styles.wordTitle, { color: primary || '#00f2ff' }]}>THE GRUVS</Text>
    <Text style={[styles.wordSub, { color: muted || 'rgba(255,255,255,0.45)' }]}>I got you</Text>
  </View>
);

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crownBar: {
    position: 'absolute',
    width: '60%',
    height: 0,
    borderBottomWidth: 3,
    alignSelf: 'center',
  },
  crownLeft: {
    position: 'absolute',
    width: 5,
    height: 8,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  crownRight: {
    position: 'absolute',
    width: 5,
    height: 8,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  letter: {
    fontWeight: '900',
    letterSpacing: -2,
    color: '#c8d4d6',
    zIndex: 2,
  },
  stripe: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    opacity: 0.8,
    transform: [{ rotate: '-8deg' }],
    zIndex: 3,
  },
  wordmark: { justifyContent: 'center' },
  wordTitle: { fontSize: 19, fontWeight: '900', letterSpacing: 2.5 },
  wordSub: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 1, textTransform: 'uppercase' },
});
