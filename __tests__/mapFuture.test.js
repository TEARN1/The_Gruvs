import { arcPoints, pickStreams, createBeams, createStreams, createHud } from '../src/utils/mapFuture';

test('stream arcs start at you, end at the venue, and bow sideways', () => {
  const a = { lat: -26, lng: 28 }, b = { lat: -26, lng: 28.02 };
  const pts = arcPoints(a, b, 10);
  expect(pts).toHaveLength(11);
  expect(pts[0]).toEqual([28, -26]);
  expect(pts[10][0]).toBeCloseTo(28.02, 10);
  expect(pts[10][1]).toBeCloseTo(-26, 10);
  expect(pts[5][1]).not.toBeCloseTo(-26, 4); // the middle is off the straight line
});

test('streams: the picked hotspot first, then live/busy ones nearby; far ones skipped', () => {
  const me = { lat: -26, lng: 28 };
  const ev = [
    { id: 'far', lat: -26.5, lon: 28.5, here_count: 50 },          // ~70 km away
    { id: 'quiet', lat: -26.005, lon: 28.005, going: 1 },
    { id: 'live', lat: -26.01, lon: 28.01, here_count: 4 },
    { id: 'busy', lat: -26.02, lon: 27.99, going: 30 },
  ];
  expect(pickStreams(me, ev).map((h) => h.id)).toEqual(['live', 'busy', 'quiet']);
  expect(pickStreams(me, ev, { focusId: 'quiet' })[0].id).toBe('quiet');
  expect(pickStreams(null, ev)).toEqual([]);
});

test('map decorations are safe no-ops without a DOM / engine', () => {
  expect(() => createBeams(null, null).update([])).not.toThrow();
  expect(() => createStreams(null, null).update(null, [], null)).not.toThrow();
  expect(() => createHud(null, null).destroy()).not.toThrow();
});
