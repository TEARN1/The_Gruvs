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
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';

export const SmartImage = ({
  source,
  style,
  resizeMode = 'cover',
  placeholder,
  fallbackIcon = 'image',
  fallbackColor = 'rgba(255,255,255,0.05)',
  contentFit,
  onLoad,
  onError,
}) => {
  const [errored, setErrored] = useState(false);

  // Normalize source for expo-image and identify if we have a valid source
  let resolvedSource = null;
  let cacheKey = '';

  if (typeof source === 'string') {
    resolvedSource = { uri: source };
    cacheKey = source;
  } else if (typeof source === 'number') {
    resolvedSource = source; // local require number
    cacheKey = String(source);
  } else if (source && typeof source === 'object' && source.uri) {
    resolvedSource = source;
    cacheKey = source.uri;
  }

  if (!resolvedSource || errored) {
    return (
      <View style={[style, styles.fallback, { backgroundColor: fallbackColor }]}>
        <Feather 
          name={fallbackIcon} 
          size={Math.min(Number(StyleSheet.flatten(style)?.width) / 3 || 20, 28)} 
          color="rgba(255,255,255,0.2)" 
        />
      </View>
    );
  }

  return (
    <ExpoImage
      source={resolvedSource}
      style={style}
      contentFit={contentFit || resizeMode}
      placeholder={placeholder}
      transition={180}
      cachePolicy="disk"
      onLoad={onLoad}
      onError={(e) => { setErrored(true); onError?.(e); }}
      recyclingKey={cacheKey}
    />
  );
};

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
