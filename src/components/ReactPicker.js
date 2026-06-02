import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Easing, Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { REACTION_LIST } from '../constants/CategoryConfig';
import { ReactionFX, themeForReaction } from './ReactionFX';

const IS_WEB = Platform.OS === 'web';
const reducedMotion = () =>
  IS_WEB && typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Curated "signature" reactions — the distinctive, out-of-this-world ones,
// not the full 30-emoji grid. Keys all exist in REACTION_LIST so counts/displays
// elsewhere keep mapping correctly.
// The full signature set — all 50 reactions (REACTION_LIST is already curated).
const SIGNATURE_LIST = REACTION_LIST;

// ── A single floating, glowing reaction orb ──────────────────────────────────
const ReactionOrb = ({ reaction, index, isActive, primary, onPress, idle = true }) => {
  const enter = useRef(new Animated.Value(0)).current;   // entrance pop
  const float = useRef(new Animated.Value(0)).current;   // idle hover
  const pop = useRef(new Animated.Value(1)).current;     // press/active bounce
  const flip = useRef(new Animated.Value(0)).current;    // 3D card-flip on press

  // Each reaction carries its own signature colour (its opposite-world theme).
  const accent = themeForReaction(reaction.key).ring;

  useEffect(() => {
    // Staggered entrance (delay capped so 50 orbs don't trickle in forever)
    Animated.spring(enter, {
      toValue: 1, delay: Math.min(index, 16) * 35, useNativeDriver: true, tension: 140, friction: 9,
    }).start();

    // Idle float is opt-out: the always-on card bar passes idle={false} so 50
    // orbs x N cards don't each run a forever-loop (the press burst is the wow).
    if (idle === false || reducedMotion()) return;
    const ph = index % 8;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1300 + ph * 80, delay: ph * 90, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1300 + ph * 80, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [enter, float, index, idle]);

  useEffect(() => {
    Animated.spring(pop, { toValue: isActive ? 1.18 : 1, useNativeDriver: true, tension: 200, friction: 7 }).start();
  }, [isActive, pop]);

  const handlePress = () => {
    // Quick 3D flip — the orb tips toward you and snaps back.
    flip.setValue(0);
    Animated.sequence([
      Animated.timing(flip, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(flip, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }),
    ]).start();
    onPress(reaction.key);
  };

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rotateX = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-55deg'] });
  const scale = Animated.multiply(enter, pop);

  return (
    <Animated.View style={{ opacity: enter, transform: [{ perspective: 500 }, { translateY }, { rotateX }, { scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.orb,
          {
            borderColor: isActive ? accent : `${primary}22`,
            backgroundColor: isActive ? `${accent}26` : 'rgba(255,255,255,0.05)',
          },
          isActive && (IS_WEB
            ? { boxShadow: `0 0 18px ${accent}` }
            : { shadowColor: accent, shadowOpacity: 0.9, shadowRadius: 12, elevation: 8 }),
        ]}
      >
        <Text style={styles.emoji}>{reaction.emoji}</Text>
        <Text style={[styles.label, { color: isActive ? accent : 'rgba(255,255,255,0.6)' }]}>{reaction.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ReactPicker = ({ visible, onReact, userReaction, idle = true }) => {
  const { currentTheme } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const primary = currentTheme?.primary || "#00f2ff";
  const surface = currentTheme?.surface || "#1a1a1a";

  // Signature FX: erupts the opposite-world plume from the bar onto the card.
  const [fx, setFx] = useState({ key: null, trigger: 0 });
  const handleReact = (key) => {
    setFx({ key, trigger: Date.now() });
    onReact(key);
  };

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
            onPress={handleReact}
            idle={idle}
          />
        ))}
      </ScrollView>
      <ReactionFX reactionKey={fx.key} trigger={fx.trigger} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10, overflow: 'visible', position: 'relative' },
  scroll: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  orb: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 18, borderWidth: 1, minWidth: 58,
  },
  emoji: { fontSize: 22 },
  label: { fontSize: 9, fontWeight: '800', marginTop: 3, letterSpacing: 0.2 },
});
