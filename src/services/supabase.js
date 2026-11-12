import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { markStartup } from '../utils/startupTrace';

const supabaseUrl    = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseEnabled = !!supabaseUrl && !!supabaseAnonKey;

if (!isSupabaseEnabled) {
  console.error(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing.\n' +
    'Create a .env file with both variables. Data features will be disabled until they are set.'
  );
}

// On native (iOS / Android) we store auth tokens in the device's hardware-backed
// secure keychain / keystore via expo-secure-store, which provides AES-256 encryption
// at rest.  On Web, AsyncStorage (localStorage) is used as a safe fallback because
// SecureStore is not available in browser environments.
// Temporary measurement: how long each native SecureStore call takes on a cold
// start (the login restore was taking ~6.5 s with no network involved).
let storageCalls = 0;
const timed = async (op, key, fn) => {
  const t = Date.now();
  const out = await fn();
  if (storageCalls++ < 12) {
    const size = typeof out === 'string' ? out.length : '-';
    markStartup(`SecureStore.${op}#${storageCalls} ${Date.now() - t}ms (${String(key).slice(-12)}, ${size} chars)`);
  }
  return out;
};

const secureStorage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return timed('get', key, () => SecureStore.getItemAsync(key));
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    return timed('set', key, () => SecureStore.setItemAsync(key, value));
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

const currentAppId   = process.env.EXPO_PUBLIC_APP_ID || process.env.NEXT_PUBLIC_APP_ID || 'the_gruvs';

export const supabase = createClient(
  supabaseUrl    || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    global: {
      headers: {
        'x-app-id': currentAppId,
      },
    },
    auth: {
      storage:          secureStorage,
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: Platform.OS === 'web',
      // On the web, a sign-in link only works in the browser that asked for
      // it (PKCE). The implicit flow accepted tokens in any address, so a
      // crafted link could sign someone into the sender's account.
      flowType: Platform.OS === 'web' ? 'pkce' : 'implicit',
    },
  }
);
