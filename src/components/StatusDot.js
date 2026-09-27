/**
 * StatusDot — a status indicator dot that is never colour-only. It pulls colour
 * from the semantic statusPalette and exposes the matching label to screen
 * readers (#261 / #264 / #271), so the meaning survives for colour-blind and
 * VoiceOver users. Visually identical to a plain coloured dot.
 */
import React from 'react';
import { View } from 'react-native';
import { statusToken } from '../utils/statusPalette';

export function StatusDot({ status = 'live', size = 8, style }) {
  const t = statusToken(status);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t.label || undefined}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.color }, style]}
    />
  );
}
