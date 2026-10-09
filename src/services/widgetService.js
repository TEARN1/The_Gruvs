/**
 * widgetService — Android, iOS & PWA Native Home Screen Widgets Manager
 *
 * Synchronizes real-time snapshots of:
 *   1. Drop Radar (nearby drops, buzzing events, current radius)
 *   2. Tonight's Lineup (top event starting soon, countdown minutes)
 *   3. Crew & Safe Transit (crew check-ins, active safe rides)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const WIDGET_STORAGE_KEY = '@gruvs_widget_snapshot';

export const WIDGET_DEFINITIONS = [
  {
    id: 'drop_radar',
    title: 'Drop Radar Widget',
    subtitle: 'Live Nearby Heatmap',
    category: 'radar',
    sizes: ['2x2', '4x2'],
    icon: 'compass',
  },
  {
    id: 'tonight_lineup',
    title: 'Tonight Live Events',
    subtitle: 'Countdown & Guestlist Pass',
    category: 'tonight',
    sizes: ['2x2', '4x2', '4x4'],
    icon: 'calendar',
  },
  {
    id: 'crew_status',
    title: 'Crew Transit & Check-In',
    subtitle: 'Safe Rides & Crew Proximity',
    category: 'crew',
    sizes: ['2x2', '4x2'],
    icon: 'users',
  },
];

export const syncWidgetSnapshot = async ({ events = [], crewMembers = [], activeCheckIn = null } = {}) => {
  try {
    const topEvents = (events || []).slice(0, 3).map(e => ({
      id: e.id,
      title: e.title || 'Event',
      time: e.event_time || '20:00',
      venue: e.venue_name || e.city || 'Johannesburg',
      cover: e.cover_url || null,
      price: e.price || 'Free',
    }));

    const snapshot = {
      updatedAt: new Date().toISOString(),
      topEvents,
      tonightCount: events.length,
      crewOutCount: crewMembers.length,
      activeCheckIn: activeCheckIn ? {
        place: activeCheckIn.place,
        dueAt: activeCheckIn.dueAt,
      } : null,
    };

    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(snapshot));

    // Web PWA Widget data broadcast
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('gruvs_pwa_widget_data', JSON.stringify(snapshot));
    }

    return snapshot;
  } catch (err) {
    console.warn('[widgetService] Failed to sync widget snapshot:', err);
    return null;
  }
};

export const getWidgetSnapshot = async () => {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
