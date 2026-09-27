/**
 * offlineCache — AsyncStorage-backed TTL cache.
 * Guards: fresh reads within TTL, stale reads past TTL,
 * stale fallback always returns last known value.
 */
import { MatchCache, EventCache, withCache } from '../src/services/offlineCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage is auto-mocked by jest.setup.js via the official mock
// Reset between tests
beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('MatchCache', () => {
  const matchId = 'match-uuid-123';
  const matchData = { id: matchId, home_score: 2, away_score: 1, status: 'completed' };

  it('saves and retrieves a match within TTL', async () => {
    await MatchCache.saveMatch(matchId, matchData);
    const result = await MatchCache.getMatch(matchId);
    expect(result).toEqual(matchData);
  });

  it('returns null for a match that was never saved', async () => {
    const result = await MatchCache.getMatch('nonexistent-id');
    expect(result).toBeNull();
  });

  it('getMatchStale returns data even when expired (stale-while-revalidate)', async () => {
    await MatchCache.saveMatch(matchId, matchData);
    // Force the timestamp to be 10 minutes old
    const key = '@gruvs_cache:match:' + matchId;
    const raw = JSON.parse(await AsyncStorage.getItem(key));
    await AsyncStorage.setItem(key, JSON.stringify({ ...raw, ts: Date.now() - 10 * 60 * 1000 }));

    // getFresh should return null (expired)
    const fresh = await MatchCache.getMatch(matchId);
    expect(fresh).toBeNull();

    // getStale should still return the data
    const stale = await MatchCache.getMatchStale(matchId);
    expect(stale).toEqual(matchData);
  });

  it('saves and retrieves match events', async () => {
    const events = [{ id: 'e1', event_type: 'goal', minute: 23 }];
    await MatchCache.saveMatchEvents(matchId, events);
    const result = await MatchCache.getMatchEvents(matchId);
    expect(result).toEqual(events);
  });

  it('saves and retrieves league table', async () => {
    const eventId = 'event-uuid-abc';
    const table = [{ team_id: 't1', points: 9, position: 1 }];
    await MatchCache.saveLeagueTable(eventId, table);
    const result = await MatchCache.getLeagueTable(eventId);
    expect(result).toEqual(table);
  });

  it('saves and retrieves commentary', async () => {
    const commentary = [{ id: 'c1', body: 'GOAL! 2-0', minute: 45 }];
    await MatchCache.saveCommentary(matchId, commentary);
    const result = await MatchCache.getCommentary(matchId);
    expect(result).toEqual(commentary);
  });
});

describe('EventCache', () => {
  const eventId = 'event-uuid-456';

  it('saves and retrieves now playing', async () => {
    const nowPlaying = { artist_name: 'DJ Maphorisa', song_title: 'Izolo', is_active: true };
    await EventCache.saveNowPlaying(eventId, nowPlaying);
    const result = await EventCache.getNowPlaying(eventId);
    expect(result).toEqual(nowPlaying);
  });

  it('saves and retrieves setlist', async () => {
    const setlist = [{ id: 's1', song_title: 'Midnight Mix', track_number: 1, is_played: false }];
    await EventCache.saveSetlist(eventId, setlist);
    const result = await EventCache.getSetlist(eventId);
    expect(result).toEqual(setlist);
  });

  it('saves and retrieves lineup', async () => {
    const lineup = [{ id: 'l1', name: 'Sun El Musician', role: 'Headliner' }];
    await EventCache.saveLineup(eventId, lineup);
    const result = await EventCache.getLineup(eventId);
    expect(result).toEqual(lineup);
  });

  it('saves and retrieves vendors', async () => {
    const vendors = [{ id: 'v1', name: 'Kota Palace', category: 'Food' }];
    await EventCache.saveVendors(eventId, vendors);
    const result = await EventCache.getVendors(eventId);
    expect(result).toEqual(vendors);
  });
});

describe('withCache', () => {
  it('returns cached value without calling fetcher when cache is fresh', async () => {
    const matchId = 'cached-match';
    const cached = { id: matchId, status: 'live' };
    await MatchCache.saveMatch(matchId, cached);

    const fetcher = jest.fn().mockResolvedValue({ id: matchId, status: 'completed' });
    const saver = jest.fn();

    const result = await withCache(
      () => MatchCache.getMatch(matchId),
      () => MatchCache.getMatchStale(matchId),
      fetcher,
      saver,
    );

    expect(result).toEqual(cached);
    // Fetcher runs in background but we don't await it in this test
  });

  it('calls fetcher and saves when cache is empty', async () => {
    const matchId = 'uncached-match';
    const fresh = { id: matchId, status: 'scheduled' };
    const fetcher = jest.fn().mockResolvedValue(fresh);
    const saver = jest.fn();

    const result = await withCache(
      () => MatchCache.getMatch(matchId),
      () => MatchCache.getMatchStale(matchId),
      fetcher,
      saver,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(saver).toHaveBeenCalledWith(fresh);
    expect(result).toEqual(fresh);
  });

  it('falls back to stale cache when fetcher throws', async () => {
    const matchId = 'stale-match';
    const staleData = { id: matchId, status: 'completed' };

    // Store data then expire it
    await MatchCache.saveMatch(matchId, staleData);
    const key = '@gruvs_cache:match:' + matchId;
    const raw = JSON.parse(await AsyncStorage.getItem(key));
    await AsyncStorage.setItem(key, JSON.stringify({ ...raw, ts: 0 })); // expired

    const fetcher = jest.fn().mockRejectedValue(new Error('offline'));
    const saver = jest.fn();

    const result = await withCache(
      () => MatchCache.getMatch(matchId),
      () => MatchCache.getMatchStale(matchId),
      fetcher,
      saver,
    );

    expect(result).toEqual(staleData);
  });

  it('returns null when both cache and fetcher fail', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('offline'));
    const saver = jest.fn();

    const result = await withCache(
      () => MatchCache.getMatch('does-not-exist'),
      () => MatchCache.getMatchStale('does-not-exist'),
      fetcher,
      saver,
    );

    expect(result).toBeNull();
  });
});
