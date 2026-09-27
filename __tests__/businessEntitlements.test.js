// A1 — Business tiers finally gate features. Locks in the entitlement table
// so the marketed perks and the product can never drift apart again.
import {
  can, limit, tierFor, tierAtLeast, missionQuota, clampAudience, TIER_ORDER,
} from '../src/services/businessEntitlements';

describe('capabilities per tier', () => {
  it('mirrors the marketed perks exactly', () => {
    expect(can('starter', 'storefront')).toBe(false);
    expect(can('pro', 'storefront')).toBe(true);
    expect(can('starter', 'advancedReads')).toBe(false);
    expect(can('pro', 'advancedReads')).toBe(true);
    expect(can('pro', 'apiAccess')).toBe(false);
    expect(can('royal', 'apiAccess')).toBe(true);
    expect(can('royal', 'backingMarketplace')).toBe(true);
    expect(can('royal', 'bulkMissions')).toBe(false);
    expect(can('enterprise', 'bulkMissions')).toBe(true);
  });

  it('unknown tier defaults to starter — never grants by accident', () => {
    expect(can(undefined, 'storefront')).toBe(false);
    expect(can('hacker', 'apiAccess')).toBe(false);
    expect(tierAtLeast(null, 'pro')).toBe(false);
  });

  it('ungated keys are open; tierFor names the unlock tier', () => {
    expect(can('starter', 'basicReads')).toBe(true);
    expect(tierFor('storefront')).toBe('pro');
    expect(tierFor('bulkMissions')).toBe('enterprise');
  });
});

describe('missionQuota', () => {
  const inMonth = (n) => Array.from({ length: n }, (_, i) => ({ created_at: new Date().toISOString(), id: i }));
  const lastMonth = { created_at: new Date(Date.now() - 40 * 86400000).toISOString() };

  it('starter blocks at 5 launches this month; older campaigns do not count', () => {
    expect(missionQuota('starter', inMonth(4)).blocked).toBe(false);
    expect(missionQuota('starter', inMonth(5)).blocked).toBe(true);
    expect(missionQuota('starter', [...inMonth(4), lastMonth]).blocked).toBe(false);
  });

  it('pro and up are unlimited', () => {
    expect(missionQuota('pro', inMonth(500)).blocked).toBe(false);
    expect(missionQuota('enterprise', inMonth(500)).left).toBe(Infinity);
  });

  it('is null-safe', () => {
    expect(missionQuota(undefined, null).quota).toBe(5);
  });
});

describe('clampAudience', () => {
  it('caps a Mission reach to the tier ceiling', () => {
    expect(clampAudience('starter', 50000)).toBe(500);
    expect(clampAudience('pro', 50000)).toBe(10000);
    expect(clampAudience('enterprise', 50000)).toBe(50000);
    expect(clampAudience('starter', 200)).toBe(200); // under the cap → untouched
  });

  it('garbage input never crashes', () => {
    expect(clampAudience('starter', NaN)).toBe(500);
    expect(clampAudience('starter', -5)).toBe(500);
  });
});

describe('tier order', () => {
  it('is the ladder the product sells', () => {
    expect(TIER_ORDER).toEqual(['starter', 'pro', 'royal', 'enterprise']);
    expect(limit('starter', 'missionsPerMonth')).toBe(5);
  });
});
