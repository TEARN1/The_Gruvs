/**
 * stealthMode — Nightlife privacy & discovery radar modes.
 *
 * Privacy is sacred on a night out. Vibers decide exactly how visible
 * they are to friends and mutuals:
 *
 *   1. 'public':  Full Beacon — mutuals see your active venue Touch Down.
 *   2. 'fuzzy':   Suburb Ghost — mutuals see "Out in Rosebank" without venue name.
 *   3. 'ghost':   Full Stealth — 100% invisible. You see the world, world doesn't see you.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const STEALTH_MODES = {
  public: {
    key: 'public',
    label: 'Public Beacon',
    desc: 'Friends see which venue you Touched Down at',
    icon: 'radio',
    color: '#00f2ff',
    badge: 'Beacon On',
  },
  fuzzy: {
    key: 'fuzzy',
    label: 'Suburb Ghost',
    desc: 'Shows your general area (e.g. "Rosebank"), not the venue',
    icon: 'eye-off',
    color: '#a855f7',
    badge: 'Fuzzy Area',
  },
  ghost: {
    key: 'ghost',
    label: 'Full Ghost',
    desc: '100% invisible on the map to everyone',
    icon: 'shield',
    color: '#64748b',
    badge: 'Ghost Mode',
  },
};

const STORAGE_KEY = 'gruvs_stealth_mode';
let cachedMode = 'public';

export const StealthMode = {
  async getMode() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && STEALTH_MODES[stored]) {
        cachedMode = stored;
        return stored;
      }
    } catch {}
    return cachedMode;
  },

  async setMode(modeKey, userId = null) {
    if (!STEALTH_MODES[modeKey]) return;
    cachedMode = modeKey;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, modeKey);
    } catch {}

    if (userId) {
      try {
        await supabase
          .from('profiles')
          .update({
            is_beacon_active: modeKey === 'public',
            identity_mode: modeKey,
          })
          .eq('id', userId);
      } catch {}
    }
  },

  /**
   * Filter or mask location according to viewer/viber mode.
   */
  maskLocation(venueName, suburb, mode) {
    if (mode === 'ghost') return null;
    if (mode === 'fuzzy') return suburb ? `Near ${suburb}` : 'Out Tonight';
    return venueName || suburb || 'Out Tonight';
  },
};
