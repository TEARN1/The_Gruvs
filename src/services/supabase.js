import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
// Native reads are memoised in memory. The stored session is ~5.4 KB, and
// supabase-js re-reads it for EVERY request: on a Galaxy A05s each keystore
// decrypt took 0.3–4.5 s and ~12 queued up at launch, so the login restore
// took 4–6.5 s and held every query (the feed arrived at 6–12 s). Now the
// keystore is read once per key; later reads come from memory. Writes and
// deletes still go to SecureStore, so the session stays encrypted at rest.
const memo = new Map();      // key -> latest value (string | null)
const inflight = new Map();  // key -> pending first read, shared by callers

const secureStorage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    if (memo.has(key)) return memo.get(key);
    if (!inflight.has(key)) {
      inflight.set(key, SecureStore.getItemAsync(key)
        .then((value) => {
          // A write that landed while we were reading wins.
          if (!memo.has(key)) memo.set(key, value);
          return memo.get(key);
        })
        .finally(() => inflight.delete(key)));
    }
    return inflight.get(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    memo.set(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    memo.set(key, null);
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
