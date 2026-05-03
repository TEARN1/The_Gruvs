import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const Orb = ({ size, top, left, color, duration, delay, minOpacity, maxOpacity }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [minOpacity, maxOpacity] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top,
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
        zIndex: -1,
      }}
    />
  );
};

export const AuraEffect = ({ color }) => {
  const { currentTheme } = useTheme();
  const primary = color || currentTheme?.primary || '#00f2ff';
  const accent = currentTheme?.accent || '#b8c1c2';

  return (
    <>
      <Orb
        size={width * 1.2}
        top={-width * 0.3}
        left={-width * 0.15}
        color={primary}
        duration={5000}
        delay={0}
        minOpacity={0.04}
        maxOpacity={0.13}
      />
      <Orb
        size={width * 0.8}
        top={height * 0.4}
        left={width * 0.4}
        color={accent}
        duration={6500}
        delay={1500}
        minOpacity={0.03}
        maxOpacity={0.09}
      />
      <Orb
        size={width * 0.6}
        top={height * 0.6}
        left={-width * 0.1}
        color={primary}
        duration={4000}
        delay={800}
        minOpacity={0.02}
        maxOpacity={0.07}
      />
    </>
  );
};
