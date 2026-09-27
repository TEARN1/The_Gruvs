/**
 * Motion — small, reusable animation primitives (pure Animated, cross-platform).
 *
 *   <Shimmer />          — sweeping highlight for skeleton/loading surfaces
 *   <AnimatedCounter />  — counts a number up when it changes (vibe counts etc.)
 *   <PressableScale />   — springy press-down + haptic tap (feels tactile)
 *   <LiquidRefresh />    — a watery droplet spinner for pull-to-refresh states
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View, Text, StyleSheet } from 'react-native';
import { MOTION } from '../constants/DesignTokens';
import { haptics } from '../utils/haptics';

const IS_WEB = Platform.OS === 'web';
const reducedMotion = () =>
  IS_WEB && typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── Shimmer ──────────────────────────────────────────────────────────────────
export const Shimmer = ({ style, color = 'rgba(255,255,255,0.10)', highlight = 'rgba(255,255,255,0.22)' }) => {
  const x = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: MOTION.shimmer, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [-1, 1], outputRange: ['-60%', '160%'] });
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: color, borderRadius: 12 }, style]}>
      <Animated.View
        style={{
          position: 'absolute', top: 0, bottom: 0, width: '50%',
          transform: [{ translateX }, { skewX: '-18deg' }],
          ...(IS_WEB
            ? { backgroundImage: `linear-gradient(90deg, transparent, ${highlight}, transparent)` }
            : { backgroundColor: highlight, opacity: 0.5 }),
        }}
      />
    </View>
  );
};

// ── AnimatedCounter ──────────────────────────────────────────────────────────
export const AnimatedCounter = ({ value = 0, style, format = (n) => `${n}` }) => {
  const [display, setDisplay] = useState(value);
  const anim = useRef(new Animated.Value(value)).current;
  const prev = useRef(value);

  useEffect(() => {
    if (reducedMotion()) { setDisplay(value); prev.current = value; return; }
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value, duration: MOTION.countUp, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    prev.current = value;
    return () => anim.removeListener(id);
  }, [value, anim]);

  return <Text style={style}>{format(display)}</Text>;
};

// ── PressableScale ───────────────────────────────────────────────────────────
export const PressableScale = ({ children, onPress, style, scaleTo = 0.95, haptic = 'light', disabled, ...rest }) => {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v, cfg) => Animated.spring(s, { toValue: v, useNativeDriver: true, ...cfg }).start();
  return (
    <Pressable
      onPressIn={() => to(scaleTo, MOTION.spring)}
      onPressOut={() => to(1, MOTION.bounce)}
      onPress={(e) => { if (disabled) return; if (haptic) haptics[haptic]?.(); onPress?.(e); }}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
};

// ── LiquidRefresh ────────────────────────────────────────────────────────────
// A small water-droplet pulse for custom loading states.
export const LiquidRefresh = ({ color = "#00f2ff", size = 26 }) => {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [p]);
  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] });
  const opacity = p.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.5, 0] });
  return (
    <View style={[mt.center, { width: size, height: size }]}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, transform: [{ scale }], opacity }} />
      <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, backgroundColor: color }} />
    </View>
  );
};

const mt = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
