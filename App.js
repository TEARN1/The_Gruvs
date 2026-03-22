import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/state/useStore';
import { VibeProvider } from './src/state/VibeContext';

export default function App() {
  useEffect(() => {
    if (useStore.getState().subscribeToRealtime) {
      useStore.getState().subscribeToRealtime();
    }
  }, []);
  
  return (
    <SafeAreaProvider style={styles.container}>
      <VibeProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </VibeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
  },
});

