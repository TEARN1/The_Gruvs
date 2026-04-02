import React from 'react';
import { View, Text } from 'react-native';

export default function TestApp() {
  return (
    <View style={{ flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#ff4da6', fontSize: 24, fontWeight: 'bold' }}>App Works!</Text>
      <Text style={{ color: '#fff', marginTop: 16 }}>The Gruvs v1.0.0</Text>
    </View>
  );
}
