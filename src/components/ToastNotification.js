import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const ToastContext = createContext();

const TYPES = {
  success: { icon: 'check-circle', color: '#10b981' },
  error:   { icon: 'alert-triangle', color: '#ef4444' },
  info:    { icon: 'info', color: '#3b82f6' },
  vibe:    { icon: 'zap', color: '#f97316' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const show = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDone={() => remove(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onDone }) => {
  const { currentTheme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const config = TYPES[toast.type] || TYPES.info;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -120, duration: 300, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(onDone);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: currentTheme?.surface || '#1a1a1a',
          borderLeftColor: config.color,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Feather name={config.icon} size={18} color={config.color} style={{ marginRight: 10 }} />
      <Text style={[styles.message, { color: currentTheme?.text || '#fff' }]} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  icon: {
    fontSize: 18,
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
