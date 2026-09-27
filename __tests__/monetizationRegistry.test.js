/**
 * MonetizationRegistry — kill-switch + registry integrity contracts.
 * The safety property under test: while MONETIZATION_LIVE is false, NOTHING
 * can monetize, regardless of per-way or per-rail flags.
 */
import {
  MONETIZATION_LIVE, RAILS_CONNECTED, MONETIZATION_CATEGORIES,
  MONETIZATION_WAYS, MONETIZATION_WAY_COUNT, isWayEnabled, enabledWays, waysByCategory,
} from '../src/constants/MonetizationRegistry';

describe('kill-switch safety', () => {
  it('master switch is OFF until a payment rail is actually connected', () => {
    expect(MONETIZATION_LIVE).toBe(false);
  });

  it('no rail reports connected', () => {
    expect(Object.values(RAILS_CONNECTED).every(v => v === false)).toBe(true);
  });

  it('isWayEnabled is false for every way while the master switch is off', () => {
    for (const w of MONETIZATION_WAYS) {
      expect(isWayEnabled(w.id)).toBe(false);
    }
    expect(enabledWays()).toHaveLength(0);
  });

  it('isWayEnabled handles unknown ids without throwing', () => {
    expect(isWayEnabled(99999)).toBe(false);
    expect(isWayEnabled(undefined)).toBe(false);
  });
});

describe('registry integrity', () => {
  const VALID_RAILS = ['admob', 'iap', 'affiliate', 'brand_invoice', 'payout_provider', 'voucher_xp', 'none'];

  it('holds all 255 ways with unique ids 1..255', () => {
    expect(MONETIZATION_WAYS).toHaveLength(255);
    expect(MONETIZATION_WAY_COUNT).toBe(255);
    const ids = MONETIZATION_WAYS.map(w => w.id).sort((a, b) => a - b);
    expect(ids[0]).toBe(1);
    expect(ids[254]).toBe(255);
    expect(new Set(ids).size).toBe(255);
  });

  it('every way has a valid category, rail and is disabled', () => {
    for (const w of MONETIZATION_WAYS) {
      expect(MONETIZATION_CATEGORIES[w.cat]).toBeDefined();
      expect(VALID_RAILS).toContain(w.rail);
      expect(w.enabled).toBe(false);
      expect(typeof w.name).toBe('string');
    }
  });

  it('every payout_provider way is flagged psp (needs a real PSP + KYC)', () => {
    for (const w of MONETIZATION_WAYS.filter(w => w.rail === 'payout_provider')) {
      expect(w.psp).toBe(true);
    }
  });

  it('waysByCategory partitions the registry completely', () => {
    const total = Object.keys(MONETIZATION_CATEGORIES)
      .reduce((sum, cat) => sum + waysByCategory(cat).length, 0);
    expect(total).toBe(255);
  });
});