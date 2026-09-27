import React, { useRef, useEffect } from 'react';
import { Animated, Platform } from 'react-native';
import { DURATION } from '../constants/DesignTokens';

// Item 82: check prefers-reduced-motion before animating
const reducedMotion = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// direction: 'up' | 'down' | 'left' | 'right' | 'none'
export const FadeInView = ({ children, delay = 0, duration = DURATION.slow, direction = 'up', style }) => {
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
