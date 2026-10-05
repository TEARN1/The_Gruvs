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
const TTL_MS = 2.5 * 3600 * 1000; // Line statuses expire after 2.5 hours

export const DoorStatusService = {
  /**
   * Get the current verified line status for an event.
   */
  async getStatus(eventId) {
    if (!eventId) return DOOR_LEVELS.walk_in;

    const mem = memoryCache.get(eventId);
    if (mem && Date.now() - mem.updatedAt < TTL_MS) {
      return DOOR_LEVELS[mem.status] || DOOR_LEVELS.walk_in;
    }

    try {
      const local = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${eventId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (Date.now() - parsed.updatedAt < TTL_MS) {
          memoryCache.set(eventId, parsed);
          return DOOR_LEVELS[parsed.status] || DOOR_LEVELS.walk_in;
        }
      }
    } catch {}

    // Fall back to server query if table exists (graceful degradation)
    try {
      const { data } = await supabase
        .from('map_reports')
        .select('kind, created_at')
        .eq('event_id', eventId)
        .in('kind', ['door_walk_in', 'door_steady', 'door_packed', 'door_capacity'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.kind) {
        const mapped = data.kind.replace('door_', '');
        const entry = { status: mapped, updatedAt: new Date(data.created_at).getTime() };
        memoryCache.set(eventId, entry);
        return DOOR_LEVELS[mapped] || DOOR_LEVELS.walk_in;
      }
    } catch {}

    return DOOR_LEVELS.walk_in;
  },

  /**
   * Report door line status for an event (crowdsourced verification).
   */
  async reportStatus(eventId, userId, statusKey) {
    if (!eventId || !DOOR_LEVELS[statusKey]) return false;

    const entry = { status: statusKey, updatedAt: Date.now(), reportedBy: userId || 'anon' };
    memoryCache.set(eventId, entry);

    try {
      await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${eventId}`, JSON.stringify(entry));
    } catch {}

    try {
      await supabase.from('map_reports').insert({
        kind: `door_${statusKey}`,
        event_id: eventId,
        user_id: userId || null,
        note: `Door status update: ${DOOR_LEVELS[statusKey].label}`,
      });
    } catch {}

    return true;
  },
};
