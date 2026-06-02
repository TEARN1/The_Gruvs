/**
 * ReactionFX — The Gruvs' signature reaction burst. The "opposite of the real
 * world": gravity runs UP, fire is cold black-violet, snow rises, rain falls
 * upward. When you react, a 3D particle plume erupts from the reaction bar and
 * drifts up onto the card with perspective, rotation and a glow shockwave.
 *
 * Driven by `trigger` (bump it — e.g. Date.now() — on each react) + `reactionKey`.
 * Renders nothing until triggered. pointerEvents: none, so it never blocks taps.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';
const reducedMotion = () =>
  IS_WEB && typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── "Opposite-world" themes ───────────────────────────────────────────────────
// Emoji colour is fixed, so signature looks (black fire, inverted snow) use tinted
// geometric glyphs that we CAN colour; a couple of emoji ride along for read.
const THEMES = {
  blackfire: { name: 'BLACK FIRE',     glyphs: ['▲', '✦', '❖', '🔥'], colors: ['#2e1065', '#7c3aed', '#c4b5fd', '#f59e0b'], ring: '#7c3aed' },
  frost:     { name: 'INVERTED SNOW',  glyphs: ['❄', '✦', '◆', '•'],  colors: ['#67e8f9', '#bae6fd', '#ffffff', '#22d3ee'], ring: '#67e8f9' },
  reverserain:{ name: 'REVERSE RAIN',  glyphs: ['💧', '◦', '•', '╱'], colors: ['#38bdf8', '#7dd3fc', '#e0f2fe', '#0ea5e9'], ring: '#38bdf8' },
  royal:     { name: 'ANTIGRAVITY GOLD', glyphs: ['✦', '★', '◆', '•'], colors: ['#fde047', '#facc15', '#fff7cd', '#fbbf24'], ring: '#fde047' },
  love:      { name: 'RISING HEARTS',  glyphs: ['♥', '✦', '•', '❤️'],  colors: ['#fb7185', '#f43f5e', '#fecdd3', '#ffffff'], ring: '#fb7185' },
  surge:     { name: 'SURGE',          glyphs: ['⚡', '✦', '▲', '•'],  colors: ['#00f2ff', '#67e8f9', '#ffffff', '#22d3ee'], ring: '#00f2ff' },
  cosmic:    { name: 'COSMIC',         glyphs: ['✦', '★', '🌌', '•'],  colors: ['#a78bfa', '#7c3aed', '#f0abfc', '#22d3ee'], ring: '#a78bfa' },
  spooky:    { name: 'SPOOKY',         glyphs: ['✦', '☁', '•', '◦'],  colors: ['#86efac', '#a78bfa', '#e5e7eb', '#34d399'], ring: '#86efac' },
  erupt:     { name: 'ERUPT',          glyphs: ['▲', '✦', '✧', '•'],  colors: ['#f97316', '#ef4444', '#fbbf24', '#fde68a'], ring: '#f97316' },
  laugh:     { name: 'TEARS',          glyphs: ['😂', '✦', '•', '◦'],  colors: ['#fde047', '#38bdf8', '#ffffff', '#facc15'], ring: '#fde047' },
};

// Each signature reaction → an opposite-world theme.
const KEY_THEME = {
  fire: 'blackfire',
  gem: 'frost', wave: 'frost', drip: 'reverserain',
  crown: 'royal', star: 'royal', goat: 'royal', '100': 'royal', magic: 'royal',
  heart: 'love',
  hype: 'surge', rocket: 'surge', electric: 'surge', pulse: 'surge', wave: 'frost',
  laugh: 'laugh', wow: 'cosmic', mind: 'cosmic', eyes: 'cosmic', alien: 'cosmic',
  unicorn: 'cosmic', comet: 'cosmic', cosmic: 'cosmic', mystic: 'cosmic', dragon: 'cosmic', galaxy: 'cosmic',
  skull: 'spooky', spooky: 'spooky', devilish: 'spooky', sad: 'frost', peace: 'frost', frost: 'frost', drip: 'reverserain',
  erupt: 'erupt', storm: 'erupt', boom: 'erupt', rock: 'erupt', heat: 'erupt', confetti: 'erupt', drop: 'erupt',
  legend: 'royal', gold: 'royal', bag: 'royal', genius: 'royal', respect: 'royal', clap: 'royal', muscle: 'royal',
  '100': 'royal', vibe: 'love', real: 'love', gang: 'love', growth: 'royal', angel: 'royal', rainbow: 'cosmic', growth2: 'royal',
};

export const themeForReaction = (key) => THEMES[KEY_THEME[key] || 'surge'];

const COUNT = 18;

export const ReactionFX = ({ reactionKey, trigger }) => {
  const theme = useMemo(() => themeForReaction(reactionKey), [reactionKey]);
  const ring = useRef(new Animated.Value(0)).current;

  // Fresh particle field per trigger — random spread, rise, spin, depth.
  const particles = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({
    id: `${trigger}_${i}`,
    av: new Animated.Value(0),
    x0: (Math.random() - 0.5) * 210,
    drift: (Math.random() - 0.5) * 90,
    rise: 130 + Math.random() * 190,
    size: 11 + Math.random() * 17,
    rot: (Math.random() - 0.5) * 760,
    delay: Math.random() * 150,
    glyph: theme.glyphs[i % theme.glyphs.length],
    color: theme.colors[i % theme.colors.length],
  })), [trigger, theme]);

  useEffect(() => {
    if (!trigger) return;
    ring.setValue(0);
    Animated.timing(ring, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (reducedMotion()) return;
    const anims = particles.map(p =>
      Animated.timing(p.av, {
        toValue: 1,
        duration: 1050 + Math.random() * 750,
        delay: p.delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    Animated.stagger(8, anims).start();
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trigger) return null;

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.6] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.55, 0.3, 0] });

  return (
    <View pointerEvents="none" style={fx.layer}>
      {/* Glow shockwave */}
      <Animated.View
        style={[
          fx.ring,
          { borderColor: theme.ring, opacity: ringOpacity, transform: [{ scale: ringScale }] },
          IS_WEB ? { boxShadow: `0 0 22px ${theme.ring}` } : { shadowColor: theme.ring, shadowOpacity: 0.9, shadowRadius: 16 },
        ]}
      />
      {/* Rising 3D plume */}
      {particles.map(p => {
        const ty = p.av.interpolate({ inputRange: [0, 1], outputRange: [0, -p.rise] });      // gravity → UP
        const tx = p.av.interpolate({ inputRange: [0, 1], outputRange: [p.x0, p.x0 + p.drift] });
        const scale = p.av.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0.2, 1.15, 0.45] });
        const opacity = p.av.interpolate({ inputRange: [0, 0.14, 0.78, 1], outputRange: [0, 1, 0.92, 0] });
        const rotate = p.av.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] });
        return (
          <Animated.Text
            key={p.id}
            style={[
              fx.particle,
              {
                color: p.color,
                fontSize: p.size,
                opacity,
                transform: [{ perspective: 600 }, { translateX: tx }, { translateY: ty }, { rotate }, { scale }],
                ...(IS_WEB
                  ? { textShadow: `0 0 9px ${p.color}` }
                  : { textShadowColor: p.color, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } }),
              },
            ]}
          >
            {p.glyph}
          </Animated.Text>
        );
      })}
    </View>
  );
};

const fx = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 8,
    height: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 60,
  },
  ring: {
    position: 'absolute',
    bottom: 0,
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2,
  },
  particle: {
    position: 'absolute',
    bottom: 0,
    fontWeight: '900',
    includeFontPadding: false,
  },
});

// ── ReactedBadge — your chosen reaction, glowing forever ──────────────────────
// Shown on the card's React button after you react: the emoji keeps pulsing in
// its theme colour ("shouldn't stop flaming / glittering").
export const ReactedBadge = ({ emoji, reactionKey, size = 19 }) => {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!reactionKey || reducedMotion()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reactionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const ring = themeForReaction(reactionKey).ring;
  const haloScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.5] });
  const haloOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const emojiScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size + 8, height: size + 8 }}>
      <Animated.View
        style={{
          position: 'absolute', width: size + 6, height: size + 6, borderRadius: (size + 6) / 2,
          backgroundColor: ring, opacity: haloOpacity, transform: [{ scale: haloScale }],
          ...(IS_WEB ? { boxShadow: `0 0 10px ${ring}` } : { shadowColor: ring, shadowOpacity: 0.9, shadowRadius: 8 }),
        }}
      />
      <Animated.Text style={{ fontSize: size, transform: [{ scale: emojiScale }] }}>{emoji}</Animated.Text>
    </View>
  );
};

export default ReactionFX;
