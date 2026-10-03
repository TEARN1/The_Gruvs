/**
 * safeRoute — Ride-hailing deep links, companion tracking & safe haven POIs.
 *
 * Provides:
 *   1. 1-tap Uber & Bolt deep-link generation with exact venue drop-off coordinates.
 *   2. "Watch My Route" companion trip status for getting home safe.
 *   3. Safe haven POI catalog (24/7 lit petrol stations, official taxi ranks, clinics).
 */
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_TRIP_KEY = 'gruvs_active_safe_trip';

export const SafeRoute = {
  /**
   * Open Uber with pickup set to user's location and dropoff at venue.
   */
  async launchUber(destLat, destLng, venueName = 'Venue') {
    if (!destLat || !destLng) return false;
    const nameEnc = encodeURIComponent(venueName);
    const nativeUrl = `uber://?action=setPickup&pickup=my_location&dropoff[latitude]=${destLat}&dropoff[longitude]=${destLng}&dropoff[nickname]=${nameEnc}`;
    const webUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${destLat}&dropoff[longitude]=${destLng}&dropoff[nickname]=${nameEnc}`;

    try {
      const canOpen = await Linking.canOpenURL(nativeUrl);
      if (canOpen) {
        await Linking.openURL(nativeUrl);
        return true;
      }
    } catch {}

    try {
      await Linking.openURL(webUrl);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Open Bolt with dropoff coordinates.
   */
  async launchBolt(destLat, destLng) {
    if (!destLat || !destLng) return false;
    const boltUrl = `bolt://ride?destination_lat=${destLat}&destination_lng=${destLng}`;
    const webUrl = `https://bolt.eu/`;

    try {
      const canOpen = await Linking.canOpenURL(boltUrl);
      if (canOpen) {
        await Linking.openURL(boltUrl);
        return true;
      }
    } catch {}

    try {
      await Linking.openURL(webUrl);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Start a companion trip watcher.
   */
  async startTrip(destinationName, etaMinutes = 20) {
    const trip = {
      destination: destinationName,
      startedAt: Date.now(),
      etaMinutes,
      active: true,
    };
    try {
      await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
    } catch {}
    return trip;
  },

  async endTrip() {
    try {
      await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
    } catch {}
  },

  async getActiveTrip() {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
      if (!raw) return null;
      const trip = JSON.parse(raw);
      // Auto-expire trips older than 4 hours
      if (Date.now() - trip.startedAt > 4 * 3600 * 1000) {
        await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
        return null;
      }
      return trip;
    } catch {
      return null;
    }
  },
};
