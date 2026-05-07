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
          backgroundColor: `${primary}08`,
          shadowColor: primary,
          shadowOpacity,
          shadowRadius: showGlow ? 25 : 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 10,
        },
        style,
      ]}
    >
      {/* Crown */}
      <View style={[styles.crownContainer, { width: size * 0.4, height: size * 0.2, top: size * 0.1 }]}>
        <View style={[styles.crownPoint, { backgroundColor: primary, left: 0 }]} />
        <View style={[styles.crownPoint, { backgroundColor: primary, alignSelf: 'center', height: '100%' }]} />
        <View style={[styles.crownPoint, { backgroundColor: primary, right: 0 }]} />
        <View style={[styles.crownBase, { backgroundColor: primary }]} />
      </View>

      {/* H letter with metallic effect */}
      <View style={[styles.hContainer, { width: size * 0.6, height: size * 0.6, top: size * 0.15 }]}>
        <View style={[styles.hLeg, { backgroundColor: accent, left: 0 }]} />
        <View style={[styles.hLeg, { backgroundColor: accent, right: 0 }]} />
        {/* Lightning / Energy stripe */}
        <View style={[styles.hBar, { backgroundColor: primary, top: '45%', opacity: 0.9, height: 3, transform: [{ rotate: '-10deg' }] }]} />
      </View>
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
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  crownContainer: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  crownPoint: {
    width: 3,
    height: '70%',
    borderRadius: 2,
    position: 'absolute',
  },
  crownBase: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  hContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hLeg: {
    width: 6,
    height: '100%',
    borderRadius: 2,
    position: 'absolute',
  },
  hBar: {
    width: '110%',
    borderRadius: 2,
    position: 'absolute',
    zIndex: 5,
  },
  wordmark: { justifyContent: 'center' },
  wordTitle: { fontSize: 19, fontWeight: '900', letterSpacing: 2.5 },
  wordSub: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 1, textTransform: 'uppercase' },
});
