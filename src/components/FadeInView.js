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
const WebFadeIn = ({ children, delay = 0, duration = DURATION.slow, direction = 'up', style, reveal }) => {
  if (reducedMotion()) return <View style={style}>{children}</View>;
  const offset = getInitialSlide(direction);
  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  return (
    <View
      style={[style, reveal ? null : {
        animationKeyframes: [{
          from: { opacity: 0, transform: `translate${axis}(${offset}px)` },
          to: { opacity: 1, transform: 'none' },
        }],
        animationDuration: `${duration}ms`,
        animationDelay: `${delay}ms`,
        animationTimingFunction: 'cubic-bezier(.2,.8,.2,1)',
        animationFillMode: 'backwards',
      }]}
      {...(reveal ? { dataSet: { fx: 'reveal' } } : {})}
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
