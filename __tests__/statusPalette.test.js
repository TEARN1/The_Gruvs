import { STATUS, statusToken } from '../src/utils/statusPalette';

describe('statusPalette — never colour alone', () => {
  it('every token pairs colour with an icon and a label key', () => {
    for (const [key, t] of Object.entries(STATUS)) {
      expect(typeof t.color).toBe('string');
      expect(t.color).toMatch(/^#/);
      expect(typeof t.icon).toBe('string');
      expect(t.icon.length).toBeGreaterThan(0);   // icon always present → not colour-only
      expect(t).toHaveProperty('label');           // label key always defined (may be '')
    }
  });

  it('resolves known tokens', () => {
    expect(statusToken('live')).toMatchObject({ color: '#10b981', icon: 'radio', label: 'Live' });
    expect(statusToken('hot').icon).toBe('trending-up');
  });

  it('falls back to muted for unknown / missing keys', () => {
    expect(statusToken('nope')).toBe(STATUS.muted);
    expect(statusToken()).toBe(STATUS.muted);
  });
});
