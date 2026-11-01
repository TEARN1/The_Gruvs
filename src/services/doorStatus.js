/**
 * doorStatus — Real-time venue line & capacity truth (Truth Protocol).
 *
 * Prevents vibers from traveling across town only to find a 45-minute line
 * or a venue at full capacity (1-in-1-out).
 *
 * Status levels:
 *   - walk_in:  Walk straight in (< 5 min wait) 🟢
 *   - steady:   Moving steady (10–20 min wait) 🔵
 *   - packed:   Packed / Long line (30+ min wait) 🟡
 *   - capacity: At capacity / 1-in-1-out 🔴
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { MapReports } from './mapReports';
import { logError } from '../utils/logError';

export const DOOR_LEVELS = {
  walk_in: {
    key: 'walk_in',
    label: 'Walk in',
    fullLabel: 'Walk straight in (< 5m wait)',
    icon: 'check-circle',
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.16)',
    waitEstimate: '< 5 min',
  },
  steady: {
    key: 'steady',
    label: 'Steady',
    fullLabel: 'Moving steady (10–20m wait)',
    icon: 'clock',
    color: '#00f2ff',
    badgeBg: 'rgba(0, 242, 255, 0.16)',
    waitEstimate: '10–20 min',
  },
  packed: {
    key: 'packed',
    label: 'Packed line',
    fullLabel: 'Packed line (30m+ wait)',
    icon: 'alert-triangle',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    waitEstimate: '30+ min',
  },
  capacity: {
    key: 'capacity',
    label: '1-in 1-out',
    fullLabel: 'At capacity / 1-in-1-out',
    icon: 'slash',
    color: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.16)',
    waitEstimate: 'Capacity full',
  },
};

const CACHE_KEY_PREFIX = 'gruvs_door_status_';
const memoryCache = new Map();
// Line statuses go stale fast — same 2h life as the map's long/short queue pins.
export const DOOR_TTL_HOURS = 2;
const TTL_MS = DOOR_TTL_HOURS * 3600 * 1000;
export const DOOR_REPORT_KINDS = Object.keys(DOOR_LEVELS).map((k) => `door_${k}`);
// map_reports has no event_id, so a door report is a pin AT the venue. ~60 m
// box: wide enough for GPS jitter in the organiser's pin, tight enough not to
// borrow the line from the club next door.
const VENUE_RADIUS_DEG = 60 / 111000;

const coordsOf = (c) => {
  const lat = Number(c?.lat ?? c?.latitude);
  const lon = Number(c?.lon ?? c?.lng ?? c?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
};

export const DoorStatusService = {
  /**
   * The current crowd-reported line status for an event, or null when nobody
   * has reported one in the last couple of hours. Null is the honest answer:
   * defaulting to "Walk in" sent people across town on a claim no one made.
   * `coords` is the venue's { lat, lon } — the server lookup needs it.
   */
  async getStatus(eventId, coords = null) {
    if (!eventId) return null;

    const mem = memoryCache.get(eventId);
    if (mem && Date.now() - mem.updatedAt < TTL_MS) {
      return DOOR_LEVELS[mem.status] || null;
    }

    try {
      const local = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${eventId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (Date.now() - parsed.updatedAt < TTL_MS) {
          memoryCache.set(eventId, parsed);
          return DOOR_LEVELS[parsed.status] || null;
        }
      }
    } catch {}

    const at = coordsOf(coords);
    if (!at) return null;
    try {
      const d = VENUE_RADIUS_DEG;
      const { data, error } = await supabase
        .from('map_reports')
        .select('kind, created_at')
        .in('kind', DOOR_REPORT_KINDS)
        .gt('expires_at', new Date().toISOString())
        .gte('lat', at.lat - d).lte('lat', at.lat + d)
        .gte('lon', at.lon - d).lte('lon', at.lon + d)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (data?.kind) {
        const mapped = data.kind.replace('door_', '');
        const entry = { status: mapped, updatedAt: new Date(data.created_at).getTime() };
        memoryCache.set(eventId, entry);
        return DOOR_LEVELS[mapped] || null;
      }
    } catch (e) { logError('DoorStatus.getStatus', e); }

    return null;
  },

  /**
   * Report door line status for an event (crowdsourced verification).
   * Shared through map_reports (report_map stamps the author and clamps the
   * TTL), so it needs a signed-in user and the venue's coords; without either
   * it is still remembered on this device.
   */
  async reportStatus(eventId, userId, statusKey, coords = null) {
    if (!eventId || !DOOR_LEVELS[statusKey]) return false;

    const entry = { status: statusKey, updatedAt: Date.now(), reportedBy: userId || 'anon' };
    memoryCache.set(eventId, entry);

    try {
      await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${eventId}`, JSON.stringify(entry));
    } catch {}

    const at = coordsOf(coords);
    if (userId && at) {
      try {
        await MapReports.create({
          kind: `door_${statusKey}`,
          lat: at.lat,
          lon: at.lon,
          note: `Door status update: ${DOOR_LEVELS[statusKey].label}`,
        });
      } catch { /* MapReports.create already logged it; the local status still stands */ }
    }

    return true;
  },
};
