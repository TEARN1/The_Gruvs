import { checkEvent, checkTourStops, hasBlocker, SEVERITY } from '../src/utils/eventGuard';

const NOW = Date.UTC(2026, 7, 15, 12, 0);
const ok = { title: 'Amapiano Sunset', event_date: '2026-08-20', event_time: '20:00', timezone: 'UTC', price: 150, category: 'nightlife', age_min: 18 };

describe('checkEvent', () => {
  it('passes a normal event clean', () => {
    expect(checkEvent(ok, { now: NOW })).toEqual([]);
  });

  it('catches a date in the past', () => {
    const issues = checkEvent({ ...ok, event_date: '2026-07-01' }, { now: NOW });
    expect(issues.map((i) => i.code)).toContain('past_date');
  });

  it('catches a fat-fingered price', () => {
    const issues = checkEvent({ ...ok, price: 25000 }, { now: NOW });
    expect(issues.map((i) => i.code)).toContain('price_outlier');
  });

  it('catches a pin nowhere near the stated city', () => {
    const issues = checkEvent(
      { ...ok, city: 'Johannesburg', lat: -33.92, lon: 18.42 },   // that's Cape Town
      { now: NOW, cityLat: -26.2041, cityLon: 28.0473 },
    );
    expect(issues.map((i) => i.code)).toContain('pin_far_from_city');
  });

  // Age is the ONE legal hard gate — everything else only warns.
  it('BLOCKS an under-18 nightlife event', () => {
    const issues = checkEvent({ ...ok, age_min: 16 }, { now: NOW });
    expect(hasBlocker(issues)).toBe(true);
    expect(issues.find((i) => i.code === 'underage_nightlife').severity).toBe(SEVERITY.BLOCK);
  });

  it('allows an under-18 event that is NOT nightlife', () => {
    const issues = checkEvent({ ...ok, title: 'Family Picnic', category: 'food', age_min: 12 }, { now: NOW });
    expect(hasBlocker(issues)).toBe(false);
  });

  // A false positive that silences a real host is worse than a typo published.
  it('only WARNS on everything except the legal age gate', () => {
    const issues = checkEvent({ ...ok, event_date: '2026-07-01', price: 99999 }, { now: NOW });
    expect(issues.length).toBeGreaterThan(0);
    expect(hasBlocker(issues)).toBe(false);
  });

  it('never throws on junk', () => {
    expect(checkEvent(null)).toEqual([]);
    expect(checkEvent({})).toEqual([]);
  });
});

describe('checkTourStops', () => {
  const stop = (d, lat, lon) => ({ date: new Date(d), lat, lon });

  it('catches the same date entered twice', () => {
    const issues = checkTourStops([stop('2026-08-15', -26.2, 28.0), stop('2026-08-15', -29.8, 31.0)]);
    expect(issues.map((i) => i.code)).toContain('duplicate_stop_date');
  });

  it('catches impossible travel between consecutive nights', () => {
    // Johannesburg one night, Cape Town (1260km) the next
    const issues = checkTourStops([stop('2026-08-15', -26.2041, 28.0473), stop('2026-08-16', -33.9249, 18.4241)]);
    expect(issues.map((i) => i.code)).toContain('impossible_travel');
  });

  it('accepts a sane route', () => {
    // Johannesburg → Pretoria, a week apart
    expect(checkTourStops([stop('2026-08-15', -26.2041, 28.0473), stop('2026-08-22', -25.7479, 28.2293)])).toEqual([]);
  });

  it('never throws on missing coords or dates', () => {
    expect(checkTourStops([{ date: null }, {}])).toEqual([]);
    expect(checkTourStops(null)).toEqual([]);
  });
});
