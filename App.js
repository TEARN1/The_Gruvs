/**
 * App.js — Application Root Entry Point.
 *
 * Bootstraps runtime guards, error reporters, font assets, and mounts the top-level
 * AppProviders wrapper around MainNavigator.
 */
import React, { useState, useEffect } from 'react';
import { useFonts, loadAsync as _loadFontAsync } from 'expo-font';
const Font = { loadAsync: _loadFontAsync };
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { setDriftReporter } from './src/utils/resilience';
import { shouldEnterSafeMode, shouldEnterSafeModeSync, clearCrashLog } from './src/utils/bootGuard';
import { logError } from './src/utils/logError';
import { captureRef } from './src/services/referral';
import { installGlobalErrorHandler, installWebErrorHandler } from './src/utils/errorReporter';
import { validateEnv } from './src/utils/validateEnv';
import { SecurityService } from './src/services/securityService';
import { installWebFx } from './src/styles/webFx';

import { AppProviders } from './src/context/AppProviders';
import { MainNavigator } from './src/navigation/MainNavigator';

// ── Boot Initialization ───────────────────────────────────────────────────────
installGlobalErrorHandler();
installWebFx();
installWebErrorHandler({
  logError: (label, err) => logError(label, err),
  logSecurityEvent: (userId, type, details) => SecurityService.logSecurityEvent(userId, type, details),
});
validateEnv();
captureRef();

setDriftReporter((label, err, kind) =>
  logError(`${kind}:${label}`.slice(0, 80), err, { code: err?.code || null })
);

export default function App() {
  const [syncSafeMode] = useState(() => (Platform.OS === 'web' ? shouldEnterSafeModeSync() : null));
  const [safeModeChecked, setSafeModeChecked] = useState(syncSafeMode !== null);
  const [inSafeMode, setInSafeMode] = useState(!!syncSafeMode);

  useEffect(() => {
    if (syncSafeMode !== null) return undefined;
    let alive = true;
    Promise.race([
      shouldEnterSafeMode(),
      new Promise((resolve) => setTimeout(() => resolve(false), 800)),
    ])
      .then((trip) => {
        if (alive) {
          setInSafeMode(trip);
          setSafeModeChecked(true);
        }
      })
      .catch(() => {
        if (alive) setSafeModeChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [syncSafeMode]);

  // Load primary Feather font (synchronous gate on native) + MCI subset asynchronously
  const [fontsLoaded] = useFonts({
    Feather: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
    feather: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
  });

  useEffect(() => {
    Font.loadAsync({
      MaterialCommunityIcons: require('./assets/fonts/MaterialCommunityIconsSubset.ttf'),
      'material-community': require('./assets/fonts/MaterialCommunityIconsSubset.ttf'),
    }).catch(() => {});
  }, []);

  const [forceLoaded, setForceLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!safeModeChecked || (Platform.OS !== 'web' && !fontsLoaded && !forceLoaded)) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0d1112" translucent={false} />
        <ActivityIndicator size="large" color="#00f2ff" />
      </View>
    );
  }

  if (inSafeMode) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0d1112" translucent={false} />
        <Feather name="shield" size={28} color="#00f2ff" />
        <Text style={styles.safeModeTitle}>Running in safe mode</Text>
        <Text style={styles.safeModeDesc}>
          The Gruvs crashed a few times in a row, so it's starting up minimal this time to break the
          loop.
        </Text>
        <View style={styles.safeModeRow}>
          <TouchableOpacity
            style={styles.safeModeBtn}
            onPress={async () => {
              await clearCrashLog();
              if (typeof window !== 'undefined' && window.location) window.location.reload();
              else {
                setInSafeMode(false);
              }
            }}
          >
            <Feather name="rotate-cw" size={13} color="#00f2ff" />
            <Text style={styles.safeModeBtnText}>Exit safe mode</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <AppProviders>
      <MainNavigator />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1112',
  },
  safeModeTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  safeModeDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  safeModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  safeModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00f2ff',
  },
  safeModeBtnText: {
    color: '#00f2ff',
    fontSize: 13,
    fontWeight: '700',
  },
});
