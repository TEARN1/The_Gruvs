import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { Animated, Text, StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const ToastContext = createContext();

const TYPES = {
  success: { icon: 'check-circle', color: '#10b981' },
  error:   { icon: 'alert-triangle', color: '#ef4444' },
  info:    { icon: 'info',           color: '#3b82f6' },
  vibe:    { icon: 'zap',            color: '#f97316' },
  warning: { icon: 'alert-circle',   color: '#f59e0b' },
};

export const ToastProvider = ({ children }) => {
  const [queue, setQueue]       = useState([]); // pending toasts
  const [current, setCurrent]   = useState(null);
  const idRef                   = useRef(0);
  const showingRef              = useRef(false);
  const insets                  = useSafeAreaInsets();

  const show = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++idRef.current;
    setQueue(prev => [...prev, { id, message, type, duration }]);
  }, []);

  // Drain queue one at a time
  useEffect(() => {
    if (showingRef.current || queue.length === 0) return;
    showingRef.current = true;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
  }, [queue, current]);

  const onDone = useCallback(() => {
    setCurrent(null);
    showingRef.current = false;
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={[s.container, { top: (insets.top || 0) + 8 }]} pointerEvents="box-none">
        {current && <ToastItem key={current.id} toast={current} onDone={onDone} />}
      </View>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onDone }) => {
  const { currentTheme } = useTheme();
  const slideY  = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config  = TYPES[toast.type] || TYPES.info;
  const surface = currentTheme?.surface || '#1a1a2e';
  const text    = currentTheme?.text    || '#fff';

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -80, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,   duration: 280, useNativeDriver: true }),
    ]).start(onDone);
  };

  return (
    <Animated.View
      style={[
        s.toast,
        {
          backgroundColor: surface,
          borderLeftColor: config.color,
          transform: [{ translateY: slideY }],
          opacity,
          ...(Platform.OS === 'web' && { boxShadow: `0 4px 24px rgba(0,0,0,0.5)` }),
        },
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: `${config.color}18` }]}>
        <Feather name={config.icon} size={16} color={config.color} />
      </View>
      <Text style={[s.message, { color: text }]} numberOfLines={2}>
        {toast.message}
      </Text>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Feather name="x" size={15} color={`${text}60`} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export const useToast = () => useContext(ToastContext);

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, // overridden dynamically via insets
    left: 14,
    right: 14,
    zIndex: 99999,
    alignItems: 'stretch',
    pointerEvents: 'box-none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
