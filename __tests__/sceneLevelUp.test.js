import { detectSceneLevelUp } from '../src/utils/sceneLevelUp';

describe('detectSceneLevelUp — you helped build it', () => {
  it('matches your regulars against hot venues, case-insensitively', () => {
    const out = detectSceneLevelUp(
      [{ name: 'Era', visits: 5 }, { name: 'Taboo', visits: 3 }],
      ['ERA', 'Shimmy'],
    );
    expect(out).toHaveLength(1);
    expect(out[0].venue).toBe('Era');
    expect(out[0].message).toMatch(/you helped build/);
  });

  it('returns nothing when none of your spots are hot', () => {
    expect(detectSceneLevelUp([{ name: 'Era', visits: 5 }], ['Shimmy'])).toEqual([]);
  });

  it('orders by how much of a regular you are', () => {
    const out = detectSceneLevelUp(
      [{ name: 'Era', visits: 2 }, { name: 'Taboo', visits: 9 }],
      ['era', 'taboo'],
    );
    expect(out.map((m) => m.venue)).toEqual(['Taboo', 'Era']);
  });

  it('accepts plain string regulars and dedupes', () => {
    const out = detectSceneLevelUp(['Era', 'era', 'Taboo'], ['era']);
    expect(out).toHaveLength(1);
    expect(out[0].venue).toBe('Era');
  });

  it('is null-safe', () => {
    expect(detectSceneLevelUp(null, null)).toEqual([]);
    expect(detectSceneLevelUp([null, {}, ''], ['x'])).toEqual([]);
  });
});
