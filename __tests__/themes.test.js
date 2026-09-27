import { THEMES, GENDERS, findThemeById } from '../src/constants/Themes';

describe('findThemeById (cross-device aura sync)', () => {
  it('resolves a known theme id to { gender, index, theme }', () => {
    const first = THEMES[GENDERS.MALE][0];
    const found = findThemeById(first.id);
    expect(found).not.toBeNull();
    expect(found.gender).toBe(GENDERS.MALE);
    expect(found.index).toBe(0);
    expect(found.theme.id).toBe(first.id);
  });

  it('finds themes regardless of which gender bucket they live in', () => {
    // Pick a theme from each bucket and confirm it round-trips.
    for (const g of Object.keys(THEMES)) {
      const sample = THEMES[g][THEMES[g].length - 1];
      const found = findThemeById(sample.id);
      expect(found).not.toBeNull();
      expect(found.theme.id).toBe(sample.id);
      expect(THEMES[found.gender][found.index].id).toBe(sample.id);
    }
  });

  it('returns null for unknown / empty ids', () => {
    expect(findThemeById('does_not_exist')).toBeNull();
    expect(findThemeById(null)).toBeNull();
    expect(findThemeById(undefined)).toBeNull();
    expect(findThemeById('')).toBeNull();
  });

  it('every theme has a unique, stable id (no collisions)', () => {
    const ids = [];
    for (const g of Object.keys(THEMES)) for (const t of THEMES[g]) ids.push(t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});