import { sanitizeSearch, isUuid } from '../src/utils/sanitize';

describe('sanitizeSearch', () => {
  it('preserves normal text and accents', () => {
    expect(sanitizeSearch('café São Paulo')).toBe('café São Paulo');
    expect(sanitizeSearch('Monday park run')).toBe('Monday park run');
  });

  it('strips PostgREST .or() filter-injection metacharacters', () => {
    // commas, parens, *, backslash, %, _ , : all have meaning in the filter grammar
    expect(sanitizeSearch('x,is_admin.eq.true')).not.toContain(',');
    expect(sanitizeSearch('x),or(id.eq.0')).not.toMatch(/[(),]/);
    expect(sanitizeSearch('a%b_c*d\\e:f')).toBe('a b c d e f');
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeSearch('  hello   world  ')).toBe('hello world');
  });

  it('caps length to 80 chars', () => {
    expect(sanitizeSearch('a'.repeat(200)).length).toBe(80);
  });

  it('handles null/undefined/non-strings safely', () => {
    expect(sanitizeSearch(null)).toBe('');
    expect(sanitizeSearch(undefined)).toBe('');
    expect(sanitizeSearch(12345)).toBe('12345');
  });
});

describe('isUuid', () => {
  it('accepts valid UUIDs', () => {
    expect(isUuid('a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c')).toBe(true);
  });
  it('rejects non-UUIDs', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('123')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid('a1b2ea24a0b9450c9a593ba7bbc5224c')).toBe(false); // no dashes
  });
});
