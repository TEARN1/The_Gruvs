/**
 * AIAssistant — Floating ✦ button that opens the AI chat modal.
 * Rendered globally above the TabBar in App.js.
 */
import React, { useState, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { AIAssistantModal } from './AIAssistantModal';

export const AIAssistant = ({ bottomOffset = 90 }) => {
  const { currentTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const primary = currentTheme?.primary || "#00f2ff";

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start(() => setOpen(true));
  };

  return (
    <>
      <Animated.View
        style={[
          styles.fab,
          {
            bottom: bottomOffset,
            backgroundColor: primary,
            shadowColor: primary,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={handlePress} style={styles.fabInner} activeOpacity={1}>
          {/* Glow ring */}
          <View style={[styles.glowRing, { borderColor: `${primary}50` }]} />
          <Animated.Text style={styles.fabIcon}>✦</Animated.Text>
        </TouchableOpacity>
      </Animated.View>

      <AIAssistantModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 800,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  fabInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
  },
  fabIcon: {
    fontSize: 22,
    color: '#000',
    fontWeight: '900',
  },
});
