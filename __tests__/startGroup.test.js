// Coming Soon — "starts in N" grouping for the Upcoming feed.
import { startGroup, insertStartHeaders } from '../src/utils/startGroup';

const NOW = new Date('2026-07-16T18:00:00').getTime(); // local 6pm
const d = (daysAhead) => {
  const t = new Date(NOW + daysAhead * 86400000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const ev = (id, daysAhead, time = '20:00') => ({ id, event_date: d(daysAhead), event_time: time });

describe('startGroup', () => {
  it('maps events to honest time buckets', () => {
    expect(startGroup(ev('a', 0), NOW).key).toBe('today');      // tonight 20:00
    expect(startGroup(ev('b', 1), NOW).key).toBe('tomorrow');
    expect(startGroup(ev('c', 5), NOW).key).toBe('week');
    expect(startGroup(ev('d', 10), NOW).key).toBe('next');
    expect(startGroup(ev('e', 20), NOW).key).toBe('month');
    expect(startGroup(ev('f', 60), NOW).key).toBe('later');
  });

  it('an event running right now is Live', () => {
    expect(startGroup(ev('live', 0, '16:00'), NOW).key).toBe('live'); // started 4pm, now 6pm
  });

  it('undated events get no bucket (never crash)', () => {
    expect(startGroup({ id: 'x' }, NOW)).toBeNull();
  });
});

describe('insertStartHeaders', () => {
  it('inserts one header per bucket change, keeping event order', () => {
    const out = insertStartHeaders([ev('a', 0), ev('b', 0, '22:00'), ev('c', 1), ev('d', 6)], NOW);
    expect(out.map(x => x._header || x.id)).toEqual([
      'Tonight', 'a', 'b', 'Tomorrow', 'c', 'This week', 'd',
    ]);
    expect(out.filter(x => x._header).every(h => String(h.id).startsWith('hdr-'))).toBe(true);
  });

  // Regression: a bucket that recurs non-contiguously (the list is not really
  // date-ascending — collapseTourStops can park a later-dated tour card early)
  // used to emit the SAME `hdr-*` id twice, producing duplicate React keys in
  // the Upcoming VirtualizedList.
  it('never emits the same header id twice when the list is not sorted', () => {
    const unsorted = [ev('a', 20), ev('b', 5), ev('c', 21), ev('d', 6)]; // month, week, month, week
    const out = insertStartHeaders(unsorted, NOW);
    const headerIds = out.filter(x => x._header).map(x => x.id);
    expect(headerIds).toEqual([...new Set(headerIds)]); // all unique
    expect(headerIds.filter(id => id === 'hdr-month')).toHaveLength(1);
    // every event still survives, in its original order
    expect(out.filter(x => !x._header).map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('skips headers for tiny lists and handles garbage', () => {
    expect(insertStartHeaders([ev('a', 0)], NOW)).toHaveLength(1);
    expect(insertStartHeaders(null, NOW)).toEqual([]);
    expect(insertStartHeaders([null, ev('a', 0), ev('b', 1)], NOW).filter(Boolean).length).toBeGreaterThan(0);
  });
});
