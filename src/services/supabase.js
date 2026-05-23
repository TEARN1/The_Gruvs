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
const secureStorage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(
  supabaseUrl    || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage:          secureStorage,
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: false,
    },
  }
);
