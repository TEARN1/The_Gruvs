import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

/**
 * GruvsLogo — renders the official metallic crown "H" logo.
 * Usage: <GruvsLogo size={40} />
 */
export default function GruvsLogo({ size = 40, style }) {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Image
        source={require('../../assets/logo.jpg')}
        style={{ width: size, height: size, borderRadius: size * 0.15 }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
