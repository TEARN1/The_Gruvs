import { buildWrapped, buildWrappedShareText } from '../src/utils/nightlifeWrapped';

const NOW = Date.parse('2026-12-31T12:00:00Z');
const td = (date, venue, city, scene) => ({ checked_in_at: date, venue, city, scene });

describe('buildWrapped — verified year in review', () => {
  const data = [
    td('2026-02-14', 'Taboo', 'Joburg', 'amapiano'),
    td('2026-02-21', 'Taboo', 'Joburg', 'amapiano'),
    td('2026-06-10', 'Era', 'Joburg', 'house'),
    td('2026-07-01', 'Shimmy', 'Cape Town', 'house'),
    td('2025-12-30', 'OldSpot', 'Joburg', 'techno'), // prior year — excluded
  ];

  it('counts only the target year and its distinct places', () => {
    const w = buildWrapped(data, NOW);
    expect(w.year).toBe(2026);
    expect(w.total).toBe(4);
    expect(w.venueCount).toBe(3);
    expect(w.cityCount).toBe(2);
  });

  it('surfaces the top venue / scene / city by real frequency', () => {
    const w = buildWrapped(data, NOW);
    expect(w.topVenue).toEqual({ name: 'Taboo', count: 2 });
    expect(w.topScene).toEqual({ name: 'amapiano', count: 2 }); // tie (amapiano/house) → alphabetical
    expect(w.topCity).toEqual({ name: 'Joburg', count: 3 });
  });

  it('finds the busiest month', () => {
    const w = buildWrapped(data, NOW);
    expect(w.busiestMonth).toEqual({ name: 'Feb', count: 2 });
  });

  it('headline counts verified nights', () => {
    expect(buildWrapped(data, NOW).headline).toBe('4 verified nights out in 2026');
  });

  it('handles an empty / future year warmly, never with a zero dump', () => {
    const w = buildWrapped([], NOW);
    expect(w.total).toBe(0);
    expect(w.topVenue).toBeNull();
    expect(w.busiestMonth).toBeNull();
    expect(w.headline).toMatch(/blank page/);
  });

  it('respects an explicit year and is null-safe', () => {
    expect(buildWrapped(data, NOW, { year: 2025 }).total).toBe(1);
    expect(buildWrapped(null, NOW).total).toBe(0);
  });
});

describe('buildWrappedShareText — the viral artifact', () => {
  it('flexes real verified stats', () => {
    const msg = buildWrappedShareText(buildWrapped(
      [td('2026-02-14', 'Taboo', 'Joburg', 'amapiano'), td('2026-06-10', 'Era', 'Cape Town', 'house')], NOW));
    expect(msg).toMatch(/My 2026 Nightlife Wrapped/);
    expect(msg).toMatch(/2 verified nights out/);
    expect(msg).toMatch(/2 venues · 2 cities/);
    expect(msg).toMatch(/Home base:/);
    expect(msg).toContain('thegruvs.com');
  });

  it('gives a newcomer a starter line, never an empty flex', () => {
    const msg = buildWrappedShareText(buildWrapped([], NOW));
    expect(msg).toMatch(/Starting my 2026/);
    expect(msg).toContain('thegruvs.com');
  });

  it('is null-safe', () => {
    expect(buildWrappedShareText(null)).toContain('thegruvs.com');
  });
});
