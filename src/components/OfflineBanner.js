import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, Platform } from 'react-native';
import { Z_INDEX } from '../constants/DesignTokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

// Use Supabase health endpoint — same origin we already talk to, no CORS issues
const pingSupabase = async () => {
  try {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!url || url.includes('your-project-id')) return true; // demo mode — always online
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status === 400; // 400 means server replied — we're online
  } catch {
    return false;
  }
};

export const OfflineBanner = () => {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [justCameBack, setJustCameBack] = useState(false);
  const [initialized, setInitialized] = useState(false);
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

  const checkConnectivity = async () => {
    let online;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      // navigator.onLine is instant and accurate on web
      online = navigator.onLine;
      // Double-check with a real ping only if navigator says offline
      if (!online) {
        online = await pingSupabase();
      }
    } else {
      online = await pingSupabase();
    }

    setIsOffline(prev => {
      if (prev && online && initialized) {
        setJustCameBack(true);
        setTimeout(() => setJustCameBack(false), 2500);
      }
      return !online;
    });
    if (!initialized) setInitialized(true);
  };

  useEffect(() => {
    // Delay initial check by 2s so app finishes mounting before we start pinging
    const initTimer = setTimeout(() => {
      checkConnectivity();
      intervalRef.current = setInterval(checkConnectivity, 15000);
    } , 2000);

    let handleOnline, handleOffline;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      handleOnline  = () => { setIsOffline(false); setJustCameBack(true); setTimeout(() => setJustCameBack(false), 2500); };
      handleOffline = () => setIsOffline(true);
      window.addEventListener('online',  handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      clearTimeout(initTimer);
      clearInterval(intervalRef.current);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online',  handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  useEffect(() => {
    animate(isOffline || justCameBack);
  }, [isOffline, justCameBack]);

  const isBack = !isOffline && justCameBack;

  return (
    // Item 81: role="alert" + assertive live region — announced immediately
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        styles.banner,
        { backgroundColor: isBack ? "#10b981" : "#ef4444", paddingTop: (insets.top || 0) + 10 },
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
    zIndex: Z_INDEX.modal - 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
