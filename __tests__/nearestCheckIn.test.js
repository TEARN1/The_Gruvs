import { nearestCheckInTarget, haversineKm } from '../src/utils/nearestCheckIn';

const TODAY = '2026-06-30';
const NOW = Date.parse('2026-06-30T20:00:00');
// venue at Joburg-ish coords
const V = { lat: -26.2041, lon: 28.0473 };
const near = { ...V, lat: V.lat + 0.001, lon: V.lon + 0.001 }; // ~150m away

describe('nearestCheckInTarget — proximity Touch Down nudge', () => {
  it('returns a today event you are physically at', () => {
    const r = nearestCheckInTarget(
      [{ id: 'a', title: 'Taboo', lat: V.lat, lon: V.lon, event_date: TODAY }],
      near, { now: NOW });
    expect(r?.event.id).toBe('a');
    expect(r.distanceKm).toBeLessThan(0.5);
  });

  it('ignores events too far away', () => {
    const r = nearestCheckInTarget(
      [{ id: 'a', lat: 0, lon: 0, event_date: TODAY }], near, { now: NOW });
    expect(r).toBeNull();
  });

  it('ignores events not happening today', () => {
    const r = nearestCheckInTarget(
      [{ id: 'a', lat: V.lat, lon: V.lon, event_date: '2026-07-04' }], near, { now: NOW });
    expect(r).toBeNull();
  });

  it('picks the closest of several in range', () => {
    const r = nearestCheckInTarget([
      { id: 'far', lat: V.lat + 0.003, lon: V.lon + 0.003, event_date: TODAY },
      { id: 'close', lat: V.lat, lon: V.lon, event_date: TODAY },
    ], near, { now: NOW });
    expect(r.event.id).toBe('close');
  });

  it('is null-safe (no coords, no events, bad geo)', () => {
    expect(nearestCheckInTarget([{ id: 'a', lat: V.lat, lon: V.lon }], {})).toBeNull();
    expect(nearestCheckInTarget(null, near)).toBeNull();
    expect(nearestCheckInTarget([{ id: 'a' }], near, { now: NOW })).toBeNull();
  });

  it('haversine is roughly correct (~150m)', () => {
    expect(haversineKm(V.lat, V.lon, near.lat, near.lon)).toBeLessThan(0.2);
  });
});
