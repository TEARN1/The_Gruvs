import { rankHotspots, metresPerPixel, startMapPulse } from '../src/utils/mapMotion';

test('metres per pixel follows web-mercator (512px tiles)', () => {
  expect(metresPerPixel(0, 0)).toBeCloseTo(78271.5, 0);
  expect(metresPerPixel(0, 1)).toBeCloseTo(39135.76, 1);
  // Johannesburg at zoom 12: the 15-min (1,200 m) ring is ~140 px across.
  expect(Math.round((2 * 1200) / metresPerPixel(-26, 12))).toBe(140);
});

test('live venues pulse first, then the busiest; capped; bad coords skipped', () => {
  const ev = [
    { id: 'quiet', lat: 1, lon: 1, going: 2 },
    { id: 'busy', lat: 1, lon: 1, going: 40 },
    { id: 'live', lat: 1, lon: 1, here_count: 3 },
    { id: 'nowhere', going: 99 },
    null,
  ];
  expect(rankHotspots(ev).map((h) => h.id)).toEqual(['live', 'busy', 'quiet']);
  expect(rankHotspots(Array.from({ length: 30 }, (_, i) => ({ id: i, lat: 0, lon: 0 }))).length).toBe(12);
});

test('the map pulse is a safe no-op without a map', () => {
  const p = startMapPulse(null, null);
  expect(() => { p.popEvents(); p.stop(); }).not.toThrow();
});
