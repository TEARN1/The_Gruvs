import { toBbox, padBbox, contains, shouldRefetch, bboxRadiusM, bboxCenter } from '../src/utils/mapViewport';

// Roughly central Joburg.
const view = { west: 28.00, south: -26.25, east: 28.10, north: -26.15 };

describe('mapViewport — the map must load what you are actually looking at', () => {
  it('reads a MapLibre bounds object or a plain bbox', () => {
    const libre = { getWest: () => 1, getSouth: () => 2, getEast: () => 3, getNorth: () => 4 };
    expect(toBbox(libre)).toEqual({ west: 1, south: 2, east: 3, north: 4 });
    expect(toBbox(view)).toEqual(view);
    expect(toBbox(null)).toBeNull();
    expect(toBbox({ west: 1 })).toBeNull();
  });

  it('pads the fetch area beyond the screen so small pans cost nothing', () => {
    const padded = padBbox(view, 0.5);
    expect(padded.west).toBeCloseTo(27.95);
    expect(padded.east).toBeCloseTo(28.15);
    expect(contains(padded, view)).toBe(true);
  });

  it('never pads past the poles', () => {
    const polar = padBbox({ west: 0, south: -89, east: 10, north: 89 }, 1);
    expect(polar.south).toBe(-90);
    expect(polar.north).toBe(90);
  });

  it('fetches when nothing has been fetched yet', () => {
    expect(shouldRefetch(null, view)).toBe(true);
  });

  it('does NOT refetch for a small pan inside what we already hold', () => {
    const fetched = padBbox(view, 0.5);
    const nudged = { ...view, west: view.west + 0.01, east: view.east + 0.01 };
    expect(shouldRefetch(fetched, nudged)).toBe(false);
  });

  it('refetches once the view leaves the fetched area', () => {
    const fetched = padBbox(view, 0.5);
    const movedToPretoria = { west: 28.15, south: -25.80, east: 28.25, north: -25.70 };
    expect(shouldRefetch(fetched, movedToPretoria)).toBe(true);
  });

  it('does NOT refetch on zoom-in — we already hold a superset', () => {
    const fetched = padBbox(view, 0.5);
    const zoomedIn = { west: 28.04, south: -26.21, east: 28.06, north: -26.19 };
    expect(shouldRefetch(fetched, zoomedIn)).toBe(false);
  });

  it('refetches when zoomed out far enough that the held area stops covering the screen', () => {
    // Contained, but the view is now much larger relative to what we fetched.
    const fetched = { west: 0, south: 0, east: 10, north: 10 };
    const wide = { west: 0, south: 0, east: 9.9, north: 9.9 };
    expect(shouldRefetch(fetched, wide)).toBe(false);
    expect(shouldRefetch({ west: 0, south: 0, east: 100, north: 100 }, { west: 0, south: 0, east: 90, north: 90 }, { zoomOutRatio: 0.5 })).toBe(true);
  });

  it('derives a radius and centre for the radius-based endpoints', () => {
    expect(bboxCenter(view)).toEqual({ lat: -26.20, lng: 28.05 });
    // ~0.05deg of latitude half-span => ~5.5km, plus the longitude leg.
    const r = bboxRadiusM(view);
    expect(r).toBeGreaterThan(5000);
    expect(r).toBeLessThan(9000);
  });

  it('is null-safe throughout', () => {
    expect(padBbox(null)).toBeNull();
    expect(contains(null, view)).toBe(false);
    expect(bboxRadiusM(null)).toBe(0);
    expect(bboxCenter(null)).toBeNull();
    expect(shouldRefetch(null, null)).toBe(false);
  });
});
