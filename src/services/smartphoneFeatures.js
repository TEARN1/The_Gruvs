/**
 * The Gruvs — Smartphone Features Service
 *
 * Modern device capabilities:
 *   - Biometric authentication (Face ID / fingerprint)
 *   - Device calendar sync (add Gruv → native calendar)
 *   - Network-aware loading (show offline banner instantly)
 *   - Accelerometer shake detection (shake to find random Gruv)
 *   - Media library save (save event poster to camera roll)
 *   - Screen brightness control (dim for QR scan)
 */

import { Platform, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Calendar from 'expo-calendar';
import * as MediaLibrary from 'expo-media-library';
import * as Network from 'expo-network';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';


// ── BIOMETRIC AUTH ────────────────────────────────────────────────────────────

export const BiometricAuth = {
  async isAvailable() {
    if (Platform.OS === 'web') return false;
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return has && enrolled;
    } catch { return false; }
  },

  async getSupportedTypes() {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types; // [1=fingerprint, 2=facial, 3=iris]
    } catch { return []; }
  },

  async authenticate(reason = 'Confirm your identity to continue') {
    if (Platform.OS === 'web') return { success: false, error: 'web' };
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
      return result; // { success, error, warning }
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /** Quick wrapper — returns true if auth passed or not available */
  async gate(reason) {
    const available = await this.isAvailable();
    if (!available) return true; // no biometrics = no gate
    const result = await this.authenticate(reason);
    return result.success;
  },
};

// ── DEVICE CALENDAR SYNC ──────────────────────────────────────────────────────

export const DeviceCalendar = {
  async requestPermission() {
    if (Platform.OS === 'web') return false;
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    } catch { return false; }
  },

  async getOrCreateGruvsCalendar() {
    if (Platform.OS === 'web') return null;
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const existing = calendars.find(c => c.title === 'The Gruvs');
      if (existing) return existing.id;

      // Create a new calendar
      const defaultCalendar = calendars.find(c => c.allowsModifications && c.isPrimary) || calendars[0];
      if (!defaultCalendar) return null;

      return await Calendar.createCalendarAsync({
        title: 'The Gruvs',
        color: '#00f2ff',
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: defaultCalendar.source?.id,
        source: defaultCalendar.source,
        name: 'The Gruvs',
        ownerAccount: defaultCalendar.ownerAccount || 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    } catch { return null; }
  },

  async addEvent(event) {
    if (Platform.OS === 'web') {
      // Web: open Google Calendar URL
      const title = encodeURIComponent(event.title || 'Gruv');
      const loc   = encodeURIComponent(event.venue_name || event.address || '');
      const start = event.event_date ? new Date(event.event_date + (event.event_time ? 'T' + event.event_time : 'T20:00:00')) : new Date();
      const end   = new Date(start.getTime() + 3 * 60 * 60 * 1000); // +3h
      const fmt   = d => d.toISOString().replace(/-|:|\.\d{3}/g, '');
      const url   = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&location=${loc}`;
      const { SecurityService } = require('./securityService');
      SecurityService.safeOpenURL(url).catch(() => {});
      return { success: true };
    }

    try {
      const granted = await this.requestPermission();
      if (!granted) return { success: false, error: 'Permission denied' };

      const calId = await this.getOrCreateGruvsCalendar();
      if (!calId) return { success: false, error: 'Could not create calendar' };

      const start = event.event_date
        ? new Date(event.event_date + (event.event_time ? 'T' + event.event_time : 'T20:00:00'))
        : new Date();
      const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

      const eventId = await Calendar.createEventAsync(calId, {
        title: event.title || 'Gruv',
        notes: event.description || `View on The Gruvs: https://thegruvs.app/event/${event.id}`,
        location: event.venue_name || event.address || event.city || '',
        startDate: start,
        endDate: end,
        alarms: [{ relativeOffset: -60 }, { relativeOffset: -1440 }], // 1h + 24h before
        url: `https://thegruvs.app/event/${event.id}`,
      });

      return { success: true, eventId };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

// ── MEDIA LIBRARY (Save poster to camera roll) ────────────────────────────────

export const MediaSave = {
  async saveImage(uri, albumName = 'The Gruvs') {
    if (Platform.OS === 'web') return { success: false, error: 'not_supported' };
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return { success: false, error: 'Permission denied' };
      const asset = await MediaLibrary.createAssetAsync(uri);
      const albums = await MediaLibrary.getAlbumsAsync();
      const album  = albums.find(a => a.title === albumName);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }
      return { success: true, asset };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

// ── NETWORK AWARENESS ─────────────────────────────────────────────────────────

export const NetworkMonitor = {
  async getState() {
    try {
      const state = await Network.getNetworkStateAsync();
      return {
        isConnected:     state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type, // CELLULAR | WIFI | NONE | UNKNOWN
        isWifi: state.type === Network.NetworkStateType.WIFI,
        isCellular: state.type === Network.NetworkStateType.CELLULAR,
      };
    } catch {
      return { isConnected: true, isInternetReachable: true, type: 'UNKNOWN', isWifi: false, isCellular: false };
    }
  },

  /** Returns true if on a metered connection (cellular) — use to reduce media quality */
  async isMetered() {
    const state = await this.getState();
    return state.isCellular;
  },
};

// ── SHAKE TO DISCOVER ─────────────────────────────────────────────────────────

const SHAKE_THRESHOLD = 1.8; // G-force threshold

export const ShakeDetector = {
  _subscription: null,
  _last: { x: 0, y: 0, z: 0 },

  start(onShake, cooldownMs = 3000) {
    if (Platform.OS === 'web') return;
    let lastShakeAt = 0;
    Accelerometer.setUpdateInterval(100);
    this._subscription = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      if (now - lastShakeAt < cooldownMs) return;
      const delta = Math.sqrt(
        Math.pow(x - this._last.x, 2) +
        Math.pow(y - this._last.y, 2) +
        Math.pow(z - this._last.z, 2)
      );
      if (delta > SHAKE_THRESHOLD) {
        lastShakeAt = now;
        onShake();
      }
      this._last = { x, y, z };
    });
  },

  stop() {
    this._subscription?.remove();
    this._subscription = null;
  },
};

// ── HAPTIC PATTERNS (richer than basic impact) ────────────────────────────────

export const RichHaptics = {
  async success() {
    if (Platform.OS === 'web') return;
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  },
  async error() {
    if (Platform.OS === 'web') return;
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  },
  async tap() {
    if (Platform.OS === 'web') return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  },
  async heavy() {
    if (Platform.OS === 'web') return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  },
  /** Triple-tap pattern — used for "Locked In" confirmations */
  async lockedIn() {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise(r => setTimeout(r, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise(r => setTimeout(r, 80));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },
};
