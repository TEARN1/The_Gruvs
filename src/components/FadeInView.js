import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

// direction: 'up' | 'down' | 'left' | 'right' | 'none'
export const FadeInView = ({ children, delay = 0, duration = 400, direction = 'up', style }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(getInitialSlide(direction))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration, delay, useNativeDriver: true }),
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
