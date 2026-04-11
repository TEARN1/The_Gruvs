import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, LogBox, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Ignore specific warnings
LogBox.ignoreLogs(['Setting a timer', 'AsyncStorage has been extracted']);

let AppNavigator;
let loadError = null;

try {
  AppNavigator = require('./src/core/navigation/AppNavigator').default;
} catch (e) {
  loadError = e;
  console.error('[APP] Critical Load Error:', e);
}

import { THEME, ACCENT } from './src/core/theme';
import { useStore } from './src/core/state/useStore';
import { VibeProvider } from './src/core/state/VibeContext';
import ErrorBoundary from './src/shared/components/ErrorBoundary';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(loadError);

  useEffect(() => {
    async function init() {
      try {
        console.log('[APP] Initializing store...');
        const store = useStore.getState();

        // Basic sanity check for store
        if (!store) throw new Error('Store failed to initialize');

        if (store.fetchPosts) {
          await store.fetchPosts().catch(e => console.warn('Fetch posts failed', e));
        }

        setInitialized(true);
      } catch (err) {
        console.error('[APP INIT ERROR]', err);
        setError(err);
        setInitialized(true);
      }
    }

    init();
  }, []);

  // Web-specific: Ensure we have a root view that fills the screen
  const containerStyle = [
    styles.container,
    Platform.OS === 'web' && { flex: 1, height: '100vh' }
  ];

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <Text style={{ color: ACCENT, fontSize: 24, fontWeight: '900', marginBottom: 20 }}>Frequency Interrupted</Text>
        <View style={{ backgroundColor: '#141428', padding: 24, borderRadius: 24, borderLeftWidth: 6, borderLeftColor: ACCENT, width: '100%' }}>
          <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 20 }}>{error.stack || error.message}</Text>
        </View>
        <Text style={{ color: '#94a3b8', marginTop: 30, textAlign: 'center', fontWeight: '600' }}>
          Check your console for more details.
        </Text>
      </View>
    );
  }

  if (!initialized || !AppNavigator) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={{ color: '#ffffff', marginTop: 24, fontSize: 13, letterSpacing: 4, fontWeight: '800', opacity: 0.6 }}>
          TUNING FREQUENCY...
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <VibeProvider>
          <StatusBar style="dark" />
          <View style={containerStyle}>
            <AppNavigator />
          </View>
        </VibeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
  },
});
