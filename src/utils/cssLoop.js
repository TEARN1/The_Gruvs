// Endless decorative loops (pulse, glow, drift) as CSS animations on web.
//
// react-native-web has no native driver: an Animated.loop there runs in JS and
// re-renders its component on every frame, forever. A handful of them on the
// feed kept the main thread busy at 60 fps from the moment the app opened,
// slowing first load and every scroll on mid-range phones. The browser runs
// CSS animations off the JS thread for free.
//
// cssLoop(keyframes, ms) → a style to spread onto a View on web. It plays the
// keyframes forward then backward (like an Animated.sequence of there-and-back),
// and returns {} when the user asked for reduced motion.
import { Platform } from 'react-native';

export const IS_WEB = Platform.OS === 'web';

const reducedMotion = () =>
  IS_WEB && typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function cssLoop(keyframes, ms, { delay = 0, easing = 'ease-in-out' } = {}) {
  if (!IS_WEB || reducedMotion()) return {};
  return {
    animationKeyframes: [keyframes],
    animationDuration: `${ms}ms`,
    animationDelay: `${delay}ms`,
    animationTimingFunction: easing,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
  };
}
