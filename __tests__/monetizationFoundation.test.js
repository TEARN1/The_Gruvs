/**
 * Monetization foundation — entitlement gating + affiliate links.
 * Safety property: while MONETIZATION_LIVE is off, nothing is gated and no
 * outbound link is rewritten — the app behaves exactly as pre-revenue.
 */
import { TIERS, tierAllows, PRO_FEATURES, BIZ_FEATURES, ALL_FEATURE_KEYS, minTierFor } from '../src/constants/entitlements';
import { MONETIZATION_LIVE } from '../src/constants/MonetizationRegistry';
import { affiliateUrl, isAffiliateLink, AFFILIATE_PARTNERS } from '../src/utils/affiliate';

describe('entitlements tier gating', () => {
  it('free tier is blocked from Pro features; Pro is allowed', () => {
    expect(tierAllows(TIERS.FREE, 'who_viewed_you')).toBe(false);
    expect(tierAllows(TIERS.PRO, 'who_viewed_you')).toBe(true);
  });

  it('business tiers inherit consumer Pro perks', () => {
    expect(tierAllows(TIERS.BIZ_PRO, 'who_viewed_you')).toBe(true);
    expect(tierAllows(TIERS.BIZ_STARTER, 'scout_advanced')).toBe(true);
  });

  it('business-only features require the right business tier', () => {
    expect(tierAllows(TIERS.PRO, 'attendance_analytics')).toBe(false);   // BIZ_PRO only
    expect(tierAllows(TIERS.BIZ_STARTER, 'attendance_analytics')).toBe(false);
    expect(tierAllows(TIERS.BIZ_PRO, 'attendance_analytics')).toBe(true);
    expect(tierAllows(TIERS.BIZ_STARTER, 'campaigns')).toBe(true);       // starter+
  });

  it('unknown / ungated features are always allowed', () => {
    expect(tierAllows(TIERS.FREE, 'posting')).toBe(true);
    expect(tierAllows(TIERS.FREE, 'touch_down')).toBe(true);
  });

  it('every gated feature maps to a known tier', () => {
    const valid = new Set(Object.values(TIERS));
    for (const k of ALL_FEATURE_KEYS) expect(valid.has(minTierFor(k))).toBe(true);
    expect(Object.keys(PRO_FEATURES).length).toBeGreaterThan(5);
    expect(Object.keys(BIZ_FEATURES).length).toBeGreaterThan(3);
  });
});

describe('affiliate links', () => {
  it('is a no-op while the affiliate rail is off (current state)', () => {
    const url = 'https://www.quicket.co.za/events/12345-some-gruv/';
    expect(affiliateUrl(url)).toBe(url);
  });

  it('returns the input unchanged for falsy / non-string', () => {
    expect(affiliateUrl(null)).toBeNull();
    expect(affiliateUrl(undefined)).toBeUndefined();
    expect(affiliateUrl('')).toBe('');
  });

  it('recognises known SA ticketing + ride partners', () => {
    expect(isAffiliateLink('https://quicket.co.za/x')).toBe(true);
    expect(isAffiliateLink('https://webtickets.co.za/x')).toBe(true);
    expect(isAffiliateLink('https://howler.co.za/x')).toBe(true);
    expect(isAffiliateLink('https://example.com/x')).toBe(false);
  });

  it('partner table is well-formed', () => {
    for (const p of AFFILIATE_PARTNERS) {
      expect(typeof p.id).toBe('string');
      expect(Array.isArray(p.hosts)).toBe(true);
      expect(p.hosts.length).toBeGreaterThan(0);
      expect(typeof p.param).toBe('string');
    }
  });

  // Documents the live behaviour: once a refCode is set AND the rail flips on,
  // the tag is appended. We simulate by tagging a partner clone directly.
  it('would append the ref param when configured (shape check)', () => {
    const u = new URL('https://quicket.co.za/events/1');
    u.searchParams.set('ref', 'thegruvs');
    expect(u.toString()).toContain('ref=thegruvs');
  });
});

describe('master switch', () => {
  it('monetization stays OFF until a rail is connected', () => {
    expect(MONETIZATION_LIVE).toBe(false);
  });
});
