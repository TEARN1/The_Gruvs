import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Easing, Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { REACTION_LIST } from '../constants/CategoryConfig';

const IS_WEB = Platform.OS === 'web';
const reducedMotion = () =>
  IS_WEB && typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Curated "signature" reactions — the distinctive, out-of-this-world ones,
// not the full 30-emoji grid. Keys all exist in REACTION_LIST so counts/displays
// elsewhere keep mapping correctly.
const SIGNATURE = ['fire', 'heart', 'hype', 'crown', 'gem', 'rocket', 'wave', 'star', 'goat', '100', 'magic', 'drip'];
const SIGNATURE_LIST = SIGNATURE
  .map(key => REACTION_LIST.find(r => r.key === key))
  .filter(Boolean);

// ── A single floating, glowing reaction orb ──────────────────────────────────
const ReactionOrb = ({ reaction, index, isActive, primary, onPress }) => {
  const enter = useRef(new Animated.Value(0)).current;   // entrance pop
  const float = useRef(new Animated.Value(0)).current;   // idle hover
  const pop = useRef(new Animated.Value(1)).current;     // press/active bounce

  useEffect(() => {
    // Staggered entrance
    Animated.spring(enter, {
      toValue: 1, delay: index * 45, useNativeDriver: true, tension: 140, friction: 9,
    }).start();

    if (reducedMotion()) return;
    // Continuous gentle float — each orb out of phase so the row feels alive
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1300 + index * 80, delay: index * 90, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1300 + index * 80, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [enter, float, index]);

  useEffect(() => {
    Animated.spring(pop, { toValue: isActive ? 1.18 : 1, useNativeDriver: true, tension: 200, friction: 7 }).start();
  }, [isActive, pop]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const scale = Animated.multiply(enter, pop);

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity
        onPress={() => onPress(reaction.key)}
        activeOpacity={0.8}
        style={[
          styles.orb,
          {
            borderColor: isActive ? primary : `${primary}22`,
            backgroundColor: isActive ? `${primary}26` : 'rgba(255,255,255,0.05)',
          },
          isActive && (IS_WEB
            ? { boxShadow: `0 0 16px ${primary}aa` }
            : { shadowColor: primary, shadowOpacity: 0.9, shadowRadius: 12, elevation: 8 }),
        ]}
      >
        <Text style={styles.emoji}>{reaction.emoji}</Text>
        <Text style={[styles.label, { color: isActive ? primary : 'rgba(255,255,255,0.6)' }]}>{reaction.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ReactPicker = ({ visible, onReact, userReaction }) => {
  const { currentTheme } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const primary = currentTheme?.primary || '#00f2ff';
  const surface = currentTheme?.surface || '#1a1a1a';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0, useNativeDriver: true, tension: 80, friction: 12,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.container,
      { backgroundColor: surface, borderColor: `${primary}30` },
      { opacity: slideAnim, transform: [{ scaleY: slideAnim }, { translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
    ]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {SIGNATURE_LIST.map((r, i) => (
          <ReactionOrb
            key={r.key}
            reaction={r}
            index={i}
            isActive={userReaction === r.key}
            primary={primary}
            onPress={onReact}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10 },
  scroll: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  orb: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 18, borderWidth: 1, minWidth: 58,
  },
  emoji: { fontSize: 22 },
  label: { fontSize: 9, fontWeight: '800', marginTop: 3, letterSpacing: 0.2 },
});
