import * as Location from 'expo-location';
import { supabase } from './supabase';

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
        .update({ lat, lon })
        .eq('id', userId);
    } catch {}
  },

  // Address → { lat, lon }. Delegates to the central geocoder so it works on WEB
  // too (Expo Location.geocodeAsync doesn't exist there — this used to silently
  // return null on the website).
  async geocode(address) {
    if (!address) return null;
    const { forwardGeocode, isValidCoord } = require('./geocoding');
    const p = await forwardGeocode(address);
    return (p && isValidCoord(p.lat, p.lon)) ? { lat: p.lat, lon: p.lon } : null;
  },

  // Coords → human address string (web-capable via the central geocoder).
  async reverseGeocode(lat, lon) {
    const { reverseGeocode } = require('./geocoding');
    const p = await reverseGeocode(lat, lon);
    if (!p) return null;
    return p.displayName || [p.road, p.city, p.province].filter(Boolean).join(', ') || null;
  }
};
