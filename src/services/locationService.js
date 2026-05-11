import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { supabase, isSupabaseEnabled } from './supabase';

let _cachedCoords = null;

export const LocationService = {
  async requestAndGet() {
    try {
      // Web uses browser geolocation; expo-location handles it transparently
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      _cachedCoords = {
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
      };
      return _cachedCoords;
    } catch {
      return null;
    }
  },

  getCached() {
    return _cachedCoords;
  },

  // Save coords to the user's profile so PostGIS RPCs can use them
  async saveToProfile(userId, lat, lon) {
    if (!userId) return;
    try {
      await supabase
        .from('profiles')
        .update({ coords: `SRID=4326;POINT(${lon} ${lat})` })
        .eq('id', userId);
    } catch {}
  },
};
