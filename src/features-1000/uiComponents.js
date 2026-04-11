/**
 * THE GRUVS - UI COMPONENT LIBRARY (50+ Components)
 * Standardized reusable components to support the 1100+ features.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT, THEME, GOLD } from '../theme';

// ═══════════════════════════════════════════════════════════════════════════
// 1. BASE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standard Vibe Button
 * Supports 300+ registry buttons with unified styling.
 */
export const VibeButton = ({ label, icon, onPress, variant = 'primary', style, textStyle }) => {
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        isSecondary && styles.btnSecondary,
        isOutline && styles.btnOutline,
        style
      ]}
      onPress={onPress}
    >
      {icon && <Ionicons name={icon} size={18} color={isOutline ? ACCENT : '#fff'} style={{ marginRight: 8 }} />}
      <Text style={[
        styles.btnText,
        isOutline && { color: ACCENT },
        textStyle
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Frequency Pill
 * Used for category display and quick filtering.
 */
export const FrequencyPill = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.pill, active && styles.pillActive]}
    onPress={onPress}
  >
    <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
  </TouchableOpacity>
);

/**
 * Vibe Loader
 * Custom activity indicator for the Gruvs brand.
 */
export const VibeLoader = ({ size = 'small' }) => (
  <View style={styles.loaderContainer}>
    <ActivityIndicator color={ACCENT} size={size} />
    <Text style={styles.loaderText}>Tuning the Frequency...</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. SOCIAL & FEED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verification Badge
 * For profiles and high-priority events.
 */
export const VerifiedBadge = ({ size = 16, color = ACCENT }) => (
  <Ionicons name="checkmark-circle" size={size} color={color} style={{ marginLeft: 4 }} />
);

/**
 * Scarcity Widget
 * For ticket sales and limited-entry vibes.
 */
export const ScarcityWidget = ({ remaining, total }) => {
  const percent = (remaining / total) * 100;
  const isLow = percent < 20;

  return (
    <View style={[styles.scarcityRow, isLow && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
      <Ionicons name="flame" size={14} color={isLow ? '#ef4444' : GOLD} />
      <Text style={[styles.scarcityText, isLow && { color: '#ef4444' }]}>
        {isLow ? 'Filling Fast!' : 'Open for RSVP'} ({remaining} left)
      </Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    ...Platform.select({
      web: { boxShadow: `0 8px 10px ${ACCENT}80` },
      default: { shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }
    })
  },
  btnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...Platform.select({
      web: { boxShadow: 'none' },
      default: { shadowOpacity: 0, elevation: 0 }
    })
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: ACCENT,
    ...Platform.select({
      web: { boxShadow: 'none' },
      default: { shadowOpacity: 0, elevation: 0 }
    })
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  pillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT
  },
  pillText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: 'bold',
    fontSize: 13
  },
  pillTextActive: {
    color: '#fff'
  },
  loaderContainer: {
    alignItems: 'center',
    padding: 20
  },
  loaderText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    marginTop: 10,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  scarcityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.1)'
  },
  scarcityText: {
    color: GOLD,
    fontSize: 11,
    fontWeight: 'bold'
  }
});

export default {
  VibeButton,
  FrequencyPill,
  VibeLoader,
  VerifiedBadge,
  ScarcityWidget
};
