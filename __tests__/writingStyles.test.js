import { transform, stylesForGender, STYLES, GENDER_STYLES } from '../src/utils/writingStyles';

describe('writingStyles.transform', () => {
  it('returns input unchanged for the normal style', () => {
    expect(transform('Hello', 'normal')).toBe('Hello');
  });

  it('actually transforms for a fancy style (and stays non-empty)', () => {
    const out = transform('Hello', 'bold');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toBe('Hello'); // bold maps to different codepoints
  });

  it('is safe on empty / unknown input', () => {
    expect(transform('', 'bold')).toBe('');
    expect(transform('Hi', 'no_such_style')).toBe('Hi'); // unknown key → passthrough
    expect(transform(null, 'bold')).toBe('');
    expect(transform(undefined, 'bold')).toBe('');
  });

  it('preserves spaces and length-ish structure (per-char map)', () => {
    const out = transform('a b', 'sans');
    expect(out).toContain(' ');
  });
});

describe('writingStyles.stylesForGender', () => {
  it('returns 15 styles for each aura', () => {
    ['male', 'female', 'non binary'].forEach(g => {
      expect(stylesForGender(g)).toHaveLength(15);
    });
  });

  it('falls back to male set for an unknown gender', () => {
    expect(stylesForGender('unknown')).toHaveLength(GENDER_STYLES.male.length);
  });

  it('only references styles that exist in the registry', () => {
    Object.values(GENDER_STYLES).flat().forEach(key => {
      expect(STYLES[key]).toBeDefined();
    });
  });
});