import React, { useRef, useEffect } from 'react';
import { Animated, Platform, View } from 'react-native';
import { DURATION } from '../constants/DesignTokens';

// Item 82: check prefers-reduced-motion before animating
const reducedMotion = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const IS_WEB = Platform.OS === 'web';

// Web: a CSS animation instead of Animated. react-native-web steps Animated in
// JavaScript and re-renders every frame; with dozens of these on a screen that
// was real jank. CSS runs on the compositor. `reveal` plays it as the element
// scrolls into view (feed cards mount ~600 px early, so on mount you'd miss it).
// Scroll reveal, fail-safe: the element renders VISIBLE. Only once mounted, and
// only if it really sits below the screen, is it hidden (data-gx-wait) and then
// shown again by an IntersectionObserver as it scrolls in. If anything in that
// chain is missing (no observer, odd layout), it simply stays visible. (The
// earlier CSS scroll-timeline version could leave cards invisible.)
const WebReveal = ({ children, style }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || typeof el.getBoundingClientRect !== 'function') return undefined;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return undefined; // already on screen
    el.setAttribute('data-gx-wait', '');
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { el.removeAttribute('data-gx-wait'); io.disconnect(); }
    }, { threshold: 0.06 });
    io.observe(el);
    return () => { io.disconnect(); el.removeAttribute('data-gx-wait'); };
  }, []);
  return <View ref={ref} style={style} dataSet={{ fx: 'reveal' }}>{children}</View>;
};

const WebFadeIn = ({ children, delay = 0, duration = DURATION.slow, direction = 'up', style, reveal }) => {
  if (reducedMotion()) return <View style={style}>{children}</View>;
  if (reveal) return <WebReveal style={style}>{children}</WebReveal>;
  const offset = getInitialSlide(direction);
  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  return (
    <View
      style={[style, {
        animationKeyframes: [{
          from: { opacity: 0, transform: `translate${axis}(${offset}px)` },
          to: { opacity: 1, transform: 'none' },
        }],
        animationDuration: `${duration}ms`,
        animationDelay: `${delay}ms`,
        animationTimingFunction: 'cubic-bezier(.2,.8,.2,1)',
        animationFillMode: 'backwards',
      }]}
    >
      {children}
    </View>
  );
};

// direction: 'up' | 'down' | 'left' | 'right' | 'none'
export const FadeInView = (props) => (IS_WEB ? <WebFadeIn {...props} /> : <NativeFadeIn {...props} />);

const NativeFadeIn = ({ children, delay = 0, duration = DURATION.slow, direction = 'up', style }) => {
  const fadeAnim  = useRef(new Animated.Value(reducedMotion() ? 1 : 0)).current;
  const slideAnim = useRef(new Animated.Value(reducedMotion() ? 0 : getInitialSlide(direction))).current;

  useEffect(() => {
    // Item 82: skip animation entirely when user prefers reduced motion
    if (reducedMotion()) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, delay, useNativeDriver: true, tension: 70, friction: 11 }),
    ]).start();
  }, [delay, duration]);

  const transform = buildTransform(direction, slideAnim);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform }]}>
      {children}
    </Animated.View>
  );
};

function getInitialSlide(direction) {
  switch (direction) {
    case 'up':    return 24;
    case 'down':  return -24;
    case 'left':  return 30;
    case 'right': return -30;
    default:      return 0;
  }
}

function buildTransform(direction, anim) {
  switch (direction) {
    case 'up':
    case 'down':  return [{ translateY: anim }];
    case 'left':
    case 'right': return [{ translateX: anim }];
    default:      return [];
  }
}
