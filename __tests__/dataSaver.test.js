import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataSaver, DATA_SAVER_KEY, isMeteredWebConnection } from '../src/utils/dataSaver';
import { VideoCache } from '../src/services/videoCache';
import { rankTaggableEvents } from '../src/utils/clipEventSuggest';
import { coverSize } from '../src/utils/videoCover';

beforeEach(async () => {
  DataSaver._reset();
  VideoCache.clear();
  await AsyncStorage.clear();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
});

describe('dataSaver — when the app treats the connection as metered', () => {
  it('counts mobile data, Save-Data and very slow links as metered', () => {
    expect(isMeteredWebConnection({ type: 'cellular' })).toBe(true);
    expect(isMeteredWebConnection({ saveData: true, type: 'wifi' })).toBe(true);
    expect(isMeteredWebConnection({ effectiveType: '2g' })).toBe(true);
    expect(isMeteredWebConnection({ effectiveType: '3g' })).toBe(true);
  });

  it('treats Wi-Fi, fast links and browsers that say nothing as unmetered', () => {
    expect(isMeteredWebConnection({ type: 'wifi', effectiveType: '4g' })).toBe(false);
    expect(isMeteredWebConnection(undefined)).toBe(false);
  });
});

describe('dataSaver — the Auto / On / Off choice', () => {
  it('defaults to auto, which is off on an unmetered connection', () => {
    expect(DataSaver.getMode()).toBe('auto');
    expect(DataSaver.isActive()).toBe(false);
  });

  it('On always saves data, Off never does, and the choice is remembered', async () => {
    await DataSaver.setMode('on');
    expect(DataSaver.isActive()).toBe(true);
    expect(await AsyncStorage.getItem(DATA_SAVER_KEY)).toBe('on');
    await DataSaver.setMode('off');
    expect(DataSaver.isActive()).toBe(false);
  });

  it('ignores a mode it does not know', async () => {
    await DataSaver.setMode('turbo');
    expect(DataSaver.getMode()).toBe('auto');
  });

  it('tells subscribers when it changes', async () => {
    const seen = [];
    const off = DataSaver.subscribe((s) => seen.push(s.active));
    await DataSaver.setMode('on');
    off();
    await DataSaver.setMode('off');
    expect(seen).toEqual([true]);
  });
});

describe('videoCache — no downloading ahead while saving data', () => {
  it('prefetches the next clips normally', () => {
    VideoCache.prefetchBatch(['https://x/a.mp4', 'https://x/b.mp4']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('prefetches nothing when data saver is on', async () => {
    await DataSaver.setMode('on');
    VideoCache.prefetchBatch(['https://x/a.mp4', 'https://x/b.mp4']);
    await VideoCache.prefetch('https://x/c.mp4');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('clipEventSuggest — which event a new clip is tagged to', () => {
  const now = new Date('2026-10-24T20:00:00');
  const party = { id: 'p', title: 'Rooftop', event_date: '2026-10-24' };
  const old = { id: 'o', title: 'Last month', event_date: '2026-09-20' };
  const mine = { id: 'm', title: 'My gig', event_date: '2026-10-30' };

  it('starts on the event "Add a clip" was opened from', () => {
    const r = rankTaggableEvents({ preset: mine, checkins: [party], now });
    expect(r.suggested.id).toBe('m');
    expect(r.list[0].id).toBe('m');
  });

  it('otherwise starts on the event they checked into', () => {
    expect(rankTaggableEvents({ checkins: [party], authored: [mine], now }).suggested.id).toBe('p');
  });

  it('otherwise starts on an event of theirs that is on today', () => {
    expect(rankTaggableEvents({ rsvped: [old, party], now }).suggested.id).toBe('p');
  });

  it('suggests nothing when nothing fits, and lists each event once', () => {
    const r = rankTaggableEvents({ authored: [old, mine], rsvped: [mine], now });
    expect(r.suggested).toBeNull();
    expect(r.list.map((e) => e.id)).toEqual(['m', 'o']);
  });
});

describe('videoCover — cover size', () => {
  it('puts the shorter side at 720 and keeps the shape', () => {
    expect(coverSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(coverSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
  });

  it('never enlarges a small clip, and refuses an unknown size', () => {
    expect(coverSize(480, 854)).toEqual({ width: 480, height: 854 });
    expect(coverSize(0, 0)).toBeNull();
  });
});
