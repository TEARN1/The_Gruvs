import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ── Drop your logo at:  assets/logo.png  ──────────────────────────────────────
// The metallic H-crown image will auto-load from there.
let LOCAL_LOGO = null;
try {
  LOCAL_LOGO = require('../../assets/logo.png');
} catch {
  // File not present — styled fallback below renders instead
}

export const BrandLogo = ({ size = 42, showGlow = false, style }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
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
    : 0.55;

  const glowStyle = {
    shadowColor: primary,
    shadowOpacity,
    shadowRadius: showGlow ? 22 : 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  };

  if (LOCAL_LOGO) {
    return (
      <Animated.View
        style={[
          glowStyle,
          { borderRadius: size * 0.2, overflow: 'hidden' },
          style,
        ]}
      >
        <Image
          source={LOCAL_LOGO}
          style={{ width: size, height: size, borderRadius: size * 0.2 }}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  // ── Fallback: metallic H + crown ──────────────────────────────────────────
  return (
    <Animated.View
      style={[
        s.box,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          borderColor: `${primary}80`,
          backgroundColor: `${primary}0A`,
          ...glowStyle,
        },
        style,
      ]}
    >
      {/* Crown top */}
      <View style={[s.crown, { top: size * 0.05 }]}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[
              s.crownPoint,
              {
                backgroundColor: primary,
                height: i === 1 ? size * 0.18 : size * 0.13,
                width: size * 0.04,
                marginHorizontal: size * 0.03,
              },
            ]}
          />
        ))}
      </View>
      {/* H legs */}
      <View style={[s.hWrap, { width: size * 0.55, height: size * 0.52, top: size * 0.28 }]}>
        <View style={[s.leg, { backgroundColor: `${primary}CC`, width: size * 0.07 }]} />
        <View style={[s.leg, { backgroundColor: `${primary}CC`, width: size * 0.07 }]} />
        {/* Electric crossbar */}
        <View style={[s.bar, { backgroundColor: primary, height: size * 0.06, top: '42%', opacity: 0.95 }]} />
      </View>
    </Animated.View>
  );
};

// ── Wordmark ───────────────────────────────────────────────────────────────────
export const BrandWordmark = ({ primary, muted }) => (
  <View style={s.wordmark}>
    <Text style={[s.wordTitle, { color: primary || '#00f2ff' }]}>THE GRUVS</Text>
    <Text style={[s.wordSub, { color: muted || 'rgba(255,255,255,0.45)' }]}>I got you</Text>
  </View>
);

const s = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  crown: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
  },
  crownPoint: { borderRadius: 2 },
  hWrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  leg: { height: '100%', borderRadius: 3 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 3,
    transform: [{ rotate: '-8deg' }],
  },
  wordmark: { justifyContent: 'center' },
  wordTitle: { fontSize: 19, fontWeight: '900', letterSpacing: 2.5 },
  wordSub: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 1, textTransform: 'uppercase' },
});
