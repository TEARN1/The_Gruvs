import React, { useState } from 'react';
import { Image, View, StyleSheet, Text } from 'react-native';

/**
 * GruvsLogo — renders the official metallic crown "H" logo.
 * Usage: <GruvsLogo size={40} />
 */
export default function GruvsLogo({ size = 40, style }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Text style={{ fontSize: size * 0.6, fontWeight: 'bold', color: '#ff4da6' }}>G</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Image
        source={require('../../assets/logo.jpg')}
        style={{ width: size, height: size, borderRadius: size * 0.15 }}
        resizeMode="contain"
        onError={() => setImageFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});
