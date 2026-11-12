/**
 * LiquidBackground — slow-drifting ambient "water" behind a screen.
 *
 * Two or three large, soft colour blobs gently rise, fall and breathe to give
 * the UI a living, liquid feel. Pure-JS and cross-platform:
 *   • web    — CSS radial-gradient blobs drifting on a compositor CSS animation
 *   • native — large translucent circles, held still (an endless native loop kept
 *              the phone redrawing every frame while idle)
 *
 * Respects prefers-reduced-motion (web) and renders a static wash instead.
 * Cheap: 2–3 Views; no per-frame work on native.
 */

import { View, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { MOTION } from '../constants/DesignTokens';
import { cssLoop } from '../utils/cssLoop';

const IS_WEB = Platform.OS === 'web';
const reducedMotion = () =>
  IS_WEB && typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const hexA = (hex, a) => {
  const h = (hex || "#00f2ff").replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
};

const Blob = ({ color, size, from, to, duration, delay = 0, style }) => {
  if (IS_WEB) {
    if (reducedMotion()) {
      return (
        <View
          pointerEvents="none"
          style={[{
            position: 'absolute', width: size, height: size, borderRadius: size / 2,
            backgroundImage: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            transform: `translateX(${from.x}px) translateY(${from.y}px)`,
          }, style]}
        />
      );
    }
    const at = (p, s) => ({ transform: `translateX(${p.x}px) translateY(${p.y}px) scale(${s})` });
    return (
      <View
        pointerEvents="none"
        style={[
          {
            position: 'absolute', width: size, height: size, borderRadius: size / 2,
            backgroundImage: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            transform: `translateX(${from.x}px) translateY(${from.y}px)`,
            ...cssLoop({ '0%': at(from, 1), '50%': at({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, 1.12), '100%': at(to, 1) }, duration, { delay }),
          },
          style,
        ]}
      />
    );
  }

  // Native: a still circle at its starting spot. An endless native drift on big
  // translucent layers (on up to 5 kept-alive screens at once) made the phone
  // redraw ~80 frames/s while idle, 28% of them late. Colour and placement are
  // unchanged; only the slow drift is web-only now.
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ translateX: from.x }, { translateY: from.y }],
        },
        style,
      ]}
    />
  );
};

export const LiquidBackground = ({ intensity = 1, secondary }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || "#00f2ff";
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
