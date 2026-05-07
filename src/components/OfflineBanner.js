import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

const checkOnline = async () => {
  try {
    const res = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [justCameBack, setJustCameBack] = useState(false);
  const slideY = useRef(new Animated.Value(-60)).current;
  const intervalRef = useRef(null);

  const animate = (show) => {
    Animated.spring(slideY, {
      toValue: show ? 0 : -60,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  useEffect(() => {
    const poll = async () => {
      const online = await checkOnline();
      setIsOffline(prev => {
        if (prev && online) {
          setJustCameBack(true);
          setTimeout(() => setJustCameBack(false), 2500);
        }
        return !online;
      });
    };

    poll();
    intervalRef.current = setInterval(poll, 8000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    animate(isOffline || justCameBack);
  }, [isOffline, justCameBack]);

  const isBack = !isOffline && justCameBack;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: isBack ? '#10b981' : '#ef4444' },
        { transform: [{ translateY: slideY }] },
      ]}
      pointerEvents="none"
    >
      <Feather name={isBack ? 'wifi' : 'wifi-off'} size={14} color="#fff" />
      <Text style={styles.text}>
        {isBack ? 'Back online' : 'No internet connection'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
