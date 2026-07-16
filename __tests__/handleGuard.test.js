import { handleSkeleton, isConfusable, escapeLike, findImpersonation } from '../src/utils/handleGuard';

describe('handleSkeleton', () => {
  it('collapses the ways a handle can be dressed up to read the same', () => {
    const base = handleSkeleton('konka');
    expect(handleSkeleton('k0nka')).toBe(base);    // zero for o
    expect(handleSkeleton('kon.ka')).toBe(base);   // dot separator
    expect(handleSkeleton('kon_ka')).toBe(base);   // underscore
    expect(handleSkeleton('KONKA')).toBe(base);    // case
    expect(handleSkeleton('konkaa')).toBe(base);   // doubled letter
    expect(handleSkeleton('@konka')).toBe(base);   // leading @
  });

  it('folds rn → m', () => {
    expect(handleSkeleton('konkarn')).toBe(handleSkeleton('konkam'));
  });

  it('keeps genuinely different handles distinct', () => {
    expect(handleSkeleton('konka')).not.toBe(handleSkeleton('taboo'));
  });
});

describe('isConfusable', () => {
  it('flags a near-copy of a real handle', () => {
    expect(isConfusable('k0nka', 'konka')).toBe(true);
    expect(isConfusable('kon.ka', 'konka')).toBe(true);
  });

  it('does not flag two clearly different handles', () => {
    expect(isConfusable('konka', 'shimmy')).toBe(false);
  });

  it('does not flag an identical handle as confusable-with-itself', () => {
    expect(isConfusable('konka', 'konka')).toBe(false);
    expect(isConfusable('KONKA', 'konka')).toBe(false); // case dup, handled by uniqueness
  });

  it('is null-safe', () => {
    expect(isConfusable(null, 'x')).toBe(false);
    expect(isConfusable('x', '')).toBe(false);
  });
});

describe('escapeLike — the ilike wildcard bug', () => {
  // A handle with `_` or `%` must not act as a SQL LIKE wildcard.
  it('escapes underscore and percent', () => {
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('50%')).toBe('50\\%');
    expect(escapeLike('plain')).toBe('plain');
  });
});

describe('findImpersonation', () => {
  it('finds the existing handle a new one would impersonate', () => {
    expect(findImpersonation('k0nka', ['taboo', 'konka', 'shimmy'])).toBe('konka');
  });

  it('returns null when the handle is genuinely original', () => {
    expect(findImpersonation('brandnew', ['konka', 'taboo'])).toBeNull();
  });

  it('ignores the exact match (that is a normal "taken", not impersonation)', () => {
    expect(findImpersonation('konka', ['konka'])).toBeNull();
  });
});
