/**
 * SmartImage — Drop-in replacement for RN Image with:
 *   - expo-image disk + memory cache (images load instantly on revisit)
 *   - Animated fade-in on first load
 *   - Placeholder blur hash / colour while loading
 *   - Graceful error fallback
 *
 * Usage: identical to <Image source={{ uri }} style={...} />
 */
import React, { useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';

export const SmartImage = ({
  source,
  style,
  resizeMode = 'cover',
  placeholder,
  fallbackIcon = 'image',
  fallbackColor = 'rgba(255,255,255,0.05)',
  contentFit,
}) => {
  const [errored, setErrored] = useState(false);
  const uri = typeof source === 'string' ? source : source?.uri;

  if (!uri || errored) {
    return (
      <View style={[style, styles.fallback, { backgroundColor: fallbackColor }]}>
        <Feather name={fallbackIcon} size={Math.min(Number(StyleSheet.flatten(style)?.width) / 3 || 20, 28)} color="rgba(255,255,255,0.2)" />
      </View>
    );
  }

  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit={contentFit || resizeMode}
      placeholder={placeholder}
      transition={180}
      cachePolicy="disk"
      onError={() => setErrored(true)}
      recyclingKey={uri}
    />
  );
};

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
