import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { REACTION_LIST } from '../constants/CategoryConfig';

export const ReactPicker = ({ visible, onReact, userReaction }) => {
  const { currentTheme } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const primary = currentTheme?.primary || '#00f2ff';
  const surface = currentTheme?.surface || '#1a1a1a';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.container,
      { backgroundColor: surface, borderColor: `${primary}30` },
      {
        opacity: slideAnim,
        transform: [{ scaleY: slideAnim }, { translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
      },
    ]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {REACTION_LIST.map(r => {
          const isActive = userReaction === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => onReact(r.key)}
              style={[
                styles.reactBtn,
                { backgroundColor: isActive ? `${primary}30` : 'rgba(255,255,255,0.06)', borderColor: isActive ? primary : 'transparent' },
              ]}
            >
              <Text style={styles.emoji}>{r.emoji}</Text>
              <Text style={[styles.label, { color: isActive ? primary : 'rgba(255,255,255,0.55)' }]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  reactBtn: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 56,
  },
  emoji: { fontSize: 18 },
  label: { fontSize: 9, fontWeight: '700', marginTop: 3 },
});
