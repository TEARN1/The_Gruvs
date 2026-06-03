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

  // Resolve the viewer's ISO country code (e.g. 'ZA', 'US') from GPS, used to
  // pick the local display currency. Best-effort: returns null if denied/offline.
  async getCountryCode() {
    try {
      const coords = _cachedCoords || (await this.requestAndGet());
      if (!coords) return null;
      const results = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lon });
      return results?.[0]?.isoCountryCode || null;
    } catch {
      return null;
    }
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

  // Geocode address string to lat/lon (Best-effort / Mock for now)
  async geocode(address) {
    if (!address) return null;
    try {
      // In a real app, use Expo's Location.geocodeAsync(address)
      const results = await Location.geocodeAsync(address);
      if (results && results.length > 0) {
        return {
          lat: results[0].latitude,
          lon: results[0].longitude,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  // Reverse geocode lat/lon to address
  async reverseGeocode(lat, lon) {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (results && results.length > 0) {
        const item = results[0];
        return `${item.streetNumber || ''} ${item.street || ''}, ${item.city || ''}, ${item.region || ''}`;
      }
      return null;
    } catch {
      return null;
    }
  }
};
