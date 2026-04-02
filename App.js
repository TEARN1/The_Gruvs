import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/state/useStore';
import { VibeProvider } from './src/state/VibeContext';
import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  useEffect(() => {
    console.log('[APP] Mounted and starting initialization...');
    const store = useStore.getState();

    try {
      // Do not block first paint on network/store hydration.
      if (store.fetchPosts) {
        console.log('[APP] Fetching posts...');
        Promise.resolve(store.fetchPosts()).catch((err) => {
          console.error('[APP FETCH ERROR]', err);
        });
      }

      if (store.subscribeToEvents) {
        console.log('[APP] Subscribing to events...');
        store.subscribeToEvents();
      }
      console.log('[APP] Initialization complete');
    } catch (err) {
      console.error('[APP INIT ERROR]', err);
    }
  }, []);

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
