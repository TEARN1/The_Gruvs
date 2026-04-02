import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/state/useStore';
import { VibeProvider } from './src/state/VibeContext';

export default function App() {
  useEffect(() => {
    const store = useStore.getState();

    try {
      // Do not block first paint on network/store hydration.
      if (store.fetchPosts) {
        Promise.resolve(store.fetchPosts()).catch((err) => {
          console.error('[APP FETCH ERROR]', err);
        });
      }

      if (store.subscribeToEvents) {
        store.subscribeToEvents();
      }
    } catch (err) {
      console.error('[APP INIT ERROR]', err);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <VibeProvider>
        <StatusBar style="light" />
        <View style={styles.container}>
          <AppNavigator />
        </View>
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
