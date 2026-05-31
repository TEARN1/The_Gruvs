/**
 * Offline cache for live sport/event data.
 * Uses AsyncStorage as a persistent fallback when Supabase realtime drops.
 * Pattern: write-through on every successful fetch, read-from-cache on error.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@gruvs_cache:';
const TTL_MS = 5 * 60 * 1000; // 5 minutes before stale

const key = (ns, id) => `${PREFIX}${ns}:${id}`;

async function write(ns, id, data) {
  try {
    await AsyncStorage.setItem(key(ns, id), JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

async function read(ns, id, maxAgeMs = TTL_MS) {
  try {
    const raw = await AsyncStorage.getItem(key(ns, id));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}

async function readStale(ns, id) {
  // Returns cached data regardless of age — used when offline
  try {
    const raw = await AsyncStorage.getItem(key(ns, id));
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch {
    return null;
  }
}

async function clear(ns, id) {
  try { await AsyncStorage.removeItem(key(ns, id)); } catch {}
}

// ── Domain helpers ────────────────────────────────────────────────────────────

export const MatchCache = {
  async saveMatch(matchId, data) { await write('match', matchId, data); },
  async getMatch(matchId) { return read('match', matchId); },
  async getMatchStale(matchId) { return readStale('match', matchId); },

  async saveMatchEvents(matchId, events) { await write('match_events', matchId, events); },
  async getMatchEvents(matchId) { return read('match_events', matchId); },
  async getMatchEventsStale(matchId) { return readStale('match_events', matchId); },

  async saveCommentary(matchId, items) { await write('commentary', matchId, items); },
  async getCommentary(matchId) { return read('commentary', matchId); },
  async getCommentaryStale(matchId) { return readStale('match_events', matchId); },

  async saveLeagueTable(eventId, rows) { await write('league_table', eventId, rows); },
  async getLeagueTable(eventId) { return read('league_table', eventId); },
  async getLeagueTableStale(eventId) { return readStale('league_table', eventId); },
};

export const EventCache = {
  async saveNowPlaying(eventId, data) { await write('now_playing', eventId, data); },
  async getNowPlaying(eventId) { return read('now_playing', eventId, 60_000); }, // 1 min TTL
  async getNowPlayingStale(eventId) { return readStale('now_playing', eventId); },

  async saveSetlist(eventId, data) { await write('setlist', eventId, data); },
  async getSetlist(eventId) { return read('setlist', eventId); },
  async getSetlistStale(eventId) { return readStale('setlist', eventId); },

  async saveLineup(eventId, data) { await write('lineup', eventId, data); },
  async getLineup(eventId) { return read('lineup', eventId); },
  async getLineupStale(eventId) { return readStale('lineup', eventId); },

  async saveSessions(eventId, data) { await write('sessions', eventId, data); },
  async getSessions(eventId) { return read('sessions', eventId); },
  async getSessionsStale(eventId) { return readStale('sessions', eventId); },

  async saveVendors(eventId, data) { await write('vendors', eventId, data); },
  async getVendors(eventId) { return read('vendors', eventId); },
  async getVendorsStale(eventId) { return readStale('vendors', eventId); },
};

/**
 * withCache — wraps any async data fetch with cache-then-network logic.
 *
 * Usage:
 *   const data = await withCache(
 *     () => MatchCache.getMatch(id),
 *     () => MatchCache.getMatchStale(id),
 *     async () => { const { data } = await supabase.from('sport_matches')...; return data; },
 *     (d) => MatchCache.saveMatch(id, d),
 *   );
 */
export async function withCache(getFresh, getStale, fetcher, saver) {
  // 1. Return fresh cache if available
  const cached = await getFresh();
  if (cached) {
    // Refresh in background
    fetcher().then(d => d && saver(d)).catch(() => {});
    return cached;
  }
  // 2. Try network
  try {
    const data = await fetcher();
    if (data) await saver(data);
    return data;
  } catch {
    // 3. Fall back to stale cache when offline
    return getStale();
  }
}
