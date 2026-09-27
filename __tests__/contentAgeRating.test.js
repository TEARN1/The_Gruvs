import { rateContent, canView, normalizeForMatch, AGE_TIERS } from '../src/utils/contentAgeRating';

describe('contentAgeRating — rateContent', () => {
  test('clean general content stays at 13', () => {
    const r = rateContent('Amazing sunset vibes at the beach tonight 🌅');
    expect(r.minAge).toBe(AGE_TIERS.GENERAL);
    expect(r.mature).toBe(false);
    expect(r.escalate).toBe(false);
    expect(r.categories).toEqual([]);
  });

  test('empty / null text is general', () => {
    expect(rateContent('').minAge).toBe(13);
    expect(rateContent(null).minAge).toBe(13);
    expect(rateContent(undefined).mature).toBe(false);
  });

  test('alcohol / soft-drug talk → 16+', () => {
    expect(rateContent('shots shots shots getting drunk tonight').minAge).toBe(16);
    expect(rateContent('passing the zol around 🍃').minAge).toBe(16);
    expect(rateContent('hookah lounge later?').minAge).toBe(16);
  });

  test('strong profanity → 16+ but not escalated', () => {
    const r = rateContent('this party is fucking insane');
    expect(r.minAge).toBe(16);
    expect(r.escalate).toBe(false);
  });

  test('explicit sexual content → 18+ and escalated', () => {
    const r = rateContent('check my onlyfans for nudes');
    expect(r.minAge).toBe(18);
    expect(r.mature).toBe(true);
    expect(r.escalate).toBe(true);
    expect(r.categories).toContain('sexual');
  });

  test('hard drugs → 18+ and escalated', () => {
    const r = rateContent('plug for drugs, cocaine available');
    expect(r.minAge).toBe(18);
    expect(r.escalate).toBe(true);
    expect(r.categories).toContain('hard_drugs');
  });

  test('adult tier overrides teen tier when both present', () => {
    const r = rateContent('weed and cocaine all night');
    expect(r.minAge).toBe(18);
  });

  test('leetspeak obfuscation is caught', () => {
    expect(rateContent('p0rn link in bio').minAge).toBe(18);
    expect(rateContent('c0ca1ne plug').categories).toContain('hard_drugs');
  });

  test('stretched letters are caught', () => {
    expect(rateContent('fuuuuuck this is wild').minAge).toBe(16);
  });

  test('no false positive from substrings (grass != ass)', () => {
    const r = rateContent('sitting on the grass at the picnic');
    expect(r.minAge).toBe(13);
    expect(r.categories).toEqual([]);
  });

  test('declared legal age restriction raises the floor', () => {
    const r = rateContent('chilled networking event', { declaredAgeRestriction: 18 });
    expect(r.minAge).toBe(18);
  });

  test('declared restriction never lowers an adult rating', () => {
    const r = rateContent('nudes here', { declaredAgeRestriction: 16 });
    expect(r.minAge).toBe(18);
  });

  test('severity rises with more adult hits', () => {
    const mild = rateContent('one beer 🍺');
    const heavy = rateContent('cocaine and porn and a gun for sale');
    expect(heavy.severity).toBeGreaterThan(mild.severity);
    expect(heavy.severity).toBeLessThanOrEqual(1);
  });
});

describe('contentAgeRating — canView', () => {
  test('everyone sees general content', () => {
    expect(canView(13, 13)).toBe(true);
    expect(canView(null, 13)).toBe(true);
    expect(canView(8, 13)).toBe(true);
  });

  test('under-age is blocked from mature content', () => {
    expect(canView(15, 16)).toBe(false);
    expect(canView(17, 18)).toBe(false);
  });

  test('of-age viewer sees mature content', () => {
    expect(canView(16, 16)).toBe(true);
    expect(canView(21, 18)).toBe(true);
  });

  test('unknown viewer age is restricted from mature content', () => {
    expect(canView(null, 16)).toBe(false);
    expect(canView(null, 18)).toBe(false);
  });
});

describe('contentAgeRating — normalizeForMatch', () => {
  test('lowercases, de-leets, strips punctuation', () => {
    expect(normalizeForMatch('P0RN!!!')).toBe('porn');
  });
});
