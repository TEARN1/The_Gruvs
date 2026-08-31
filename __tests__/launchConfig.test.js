import { FEATURES, feature } from '../src/constants/launchConfig';

describe('launchConfig — feature flags', () => {
  it('cashout is off, independently of gifting', () => {
    // These must never be the same flag: sending a gift is an internal XP
    // transfer (safe), cashing out is a real ZAR promise with no funded
    // payout rail behind it. Someone flipping gifting on to allow normal
    // gift-sending must NOT silently re-enable an unfunded cashout.
    expect(feature('cashout')).toBe(false);
    expect(FEATURES.cashout).toBe(false);
  });

  it('an unknown feature key defaults to on', () => {
    // feature()'s contract: FEATURES[key] !== false. Confirms cashout being
    // off is a deliberate false, not an absent key riding the default.
    expect(feature('some_key_that_does_not_exist')).toBe(true);
  });
});
