import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

let AppNavigator;
let appError = null;

try {
  AppNavigator = require('./src/navigation/AppNavigator').default;
} catch (e) {
  appError = e;
  console.error('[APP] Failed to load AppNavigator:', e);
}

import { useStore } from './src/state/useStore';
import { VibeProvider } from './src/state/VibeContext';
import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    console.log('[APP] Mounting...');
    const store = useStore.getState();

    try {
      if (store.fetchPosts) {
        console.log('[APP] Fetching posts...');
        Promise.resolve(store.fetchPosts()).catch((err) => {
          console.error('[APP FETCH ERROR]', err);
        });
      }

      if (store.subscribeToEvents) {
        console.log('[APP] Subscribing...');
        store.subscribeToEvents();
      }
    } catch (err) {
      console.error('[APP INIT ERROR]', err);
    }
    
    setTimeout(() => setInitialized(true), 100);
  }, []);

  if (appError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#ff4da6', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>App Failed to Load</Text>
        <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>{appError.message}</Text>
      </View>
    );
  }

  if (!initialized || !AppNavigator) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ff4da6" />
        <Text style={{ color: '#fff', marginTop: 16 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <VibeProvider>
          <StatusBar style="light" />
          <View style={styles.container}>
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
