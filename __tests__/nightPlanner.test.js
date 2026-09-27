import {
  suggestNextStops, scoreNextStop, resolveClashes, buildNightPlan,
  overlaps, haversineKm, startMs, endMs,
} from '../src/services/nightPlanner';

const NOW = Date.parse('2026-06-21T21:30:00Z');
const ev = (id, iso, extra = {}) => ({ id, title: id, date_time: iso, ...extra });

describe('nightPlanner — time + distance helpers', () => {
  test('startMs / endMs default to a 4h duration', () => {
    const e = ev('a', '2026-06-21T18:00:00Z');
    expect(endMs(e) - startMs(e)).toBe(4 * 3600 * 1000);
  });

  test('overlaps detects intersecting ranges', () => {
    expect(overlaps(ev('a', '2026-06-21T20:00:00Z'), ev('b', '2026-06-21T21:00:00Z'))).toBe(true);
    expect(overlaps(ev('a', '2026-06-21T18:00:00Z'), ev('b', '2026-06-21T23:00:00Z'))).toBe(false);
  });

  test('haversineKm is ~0 for same point and null for missing coords', () => {
    expect(haversineKm(-33.9, 18.4, -33.9, 18.4)).toBeCloseTo(0, 5);
    expect(haversineKm(null, 1, 2, 3)).toBeNull();
  });
});

describe('nightPlanner — suggestNextStops', () => {
  const current = ev('current', '2026-06-21T18:00:00Z'); // ends 22:00Z

  test('suggests a spot starting right as the current ends', () => {
    const cands = [
      ev('next', '2026-06-21T22:00:00Z', { vibe_count: 80 }),
      ev('tomorrow', '2026-06-22T10:00:00Z'), // too far out → excluded
      ev('over', '2026-06-21T10:00:00Z'),     // already ended → excluded
    ];
    const out = suggestNextStops(current, cands, { now: NOW });
    expect(out.length).toBe(1);
    expect(out[0].event.id).toBe('next');
    expect(out[0].reasons).toContain('starts right after this one');
  });

  test('ranks closer + buzzier spots higher', () => {
    const opts = { now: NOW, userLat: -33.9, userLon: 18.4 };
    const cands = [
      ev('far', '2026-06-21T22:00:00Z', { vibe_count: 10, lat: -34.5, lon: 19.5 }),
      ev('near', '2026-06-21T22:00:00Z', { vibe_count: 90, lat: -33.91, lon: 18.41 }),
    ];
    const out = suggestNextStops(current, cands, opts);
    expect(out[0].event.id).toBe('near');
  });

  test('excludes the current event itself', () => {
    const out = suggestNextStops(current, [current], { now: NOW });
    expect(out).toEqual([]);
  });
});

describe('nightPlanner — resolveClashes', () => {
  test('no clash → free night', () => {
    const r = resolveClashes([ev('a', '2026-06-21T22:00:00Z')], { now: NOW });
    expect(r.type).toBe('free');
  });

  test('non-overlapping pair → do both in order', () => {
    const r = resolveClashes([
      ev('a', '2026-06-21T18:00:00Z'),  // ends 22:00
      ev('b', '2026-06-21T22:30:00Z'),  // starts after
    ], { now: NOW });
    expect(r.type).toBe('both');
    expect(r.order.map(e => e.id)).toEqual(['a', 'b']);
  });

  test('tight overlap but catchable → both (duck out early)', () => {
    const r = resolveClashes([
      ev('a', '2026-06-21T20:00:00Z'),  // ends 00:00
      ev('b', '2026-06-21T23:30:00Z'),  // starts within the last hour
    ], { now: NOW });
    expect(r.type).toBe('both');
  });

  test('true clash → pick the stronger one with a reason', () => {
    const r = resolveClashes([
      ev('a', '2026-06-21T20:00:00Z', { vibe_count: 10 }),  // ends 00:00
      ev('b', '2026-06-21T20:30:00Z', { vibe_count: 200 }), // heavy overlap
    ], { now: NOW });
    expect(r.type).toBe('pick');
    expect(r.pick.id).toBe('b');
    expect(r.alt.id).toBe('a');
    expect(typeof r.reason).toBe('string');
  });
});

describe('nightPlanner — buildNightPlan', () => {
  test('chains the most non-overlapping stops, in start order', () => {
    const plan = buildNightPlan([
      ev('a', '2026-06-21T18:00:00Z'),  // 18-22
      ev('b', '2026-06-21T20:00:00Z'),  // 20-00 (overlaps a)
      ev('c', '2026-06-21T22:00:00Z'),  // 22-02 (fits after a)
    ], { now: NOW });
    expect(plan.map(e => e.id)).toEqual(['a', 'c']);
  });
});
