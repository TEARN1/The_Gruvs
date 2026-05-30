/**
 * LiquidBackground — slow-drifting ambient "water" behind a screen.
 *
 * Two or three large, soft colour blobs gently rise, fall and breathe to give
 * the UI a living, liquid feel. Pure-JS and cross-platform:
 *   • web   — CSS radial-gradient blobs, animated via Animated transforms
 *   • native — large translucent circles (big borderRadius + low opacity) drifting
 *
 * Respects prefers-reduced-motion (web) and renders a static wash instead.
 * Cheap: 2–3 Views, all transforms on the native driver.
 */
import { useEffect, useRef } from 'react';
import { View, Animated, Platform, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { MOTION } from '../constants/DesignTokens';

const IS_WEB = Platform.OS === 'web';
const reducedMotion = () =>
  IS_WEB && typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const hexA = (hex, a) => {
  const h = (hex || '#00f2ff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
};

const Blob = ({ color, size, from, to, duration, delay = 0, style }) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ translateX }, { translateY }, { scale }],
          ...(IS_WEB
            ? { background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }
            : { backgroundColor: color }),
        },
        style,
      ]}
    />
  );
};

export const LiquidBackground = ({ intensity = 1, secondary }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const accent = secondary || currentTheme?.secondary || primary;
  const a = Math.min(0.22 * intensity, 0.3);

  // Native blobs are solid-ish low-opacity circles; web blobs are gradients.
  const c1 = IS_WEB ? hexA(primary, a) : hexA(primary, a * 0.55);
  const c2 = IS_WEB ? hexA(accent, a * 0.8) : hexA(accent, a * 0.4);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 }}>
      <Blob color={c1} size={460} from={{ x: -120, y: -90 }} to={{ x: -60, y: 30 }} duration={MOTION.drift} style={{ top: 0, left: 0 }} />
      <Blob color={c2} size={400} from={{ x: 80, y: 40 }} to={{ x: 10, y: -50 }} duration={MOTION.drift * 1.3} delay={1200} style={{ bottom: 40, right: -40 }} />
      <Blob color={hexA(accent, a * 0.5)} size={300} from={{ x: -30, y: 60 }} to={{ x: 40, y: -20 }} duration={MOTION.drift * 0.85} delay={600} style={{ top: '40%', left: '30%' }} />
    </View>
  );
};
