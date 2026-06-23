import {
  requiredGiftForScope, redeemGift, tokenGrantsScope, tokenActive,
  bestTokenForScope, canAfford, reachForRadius, reachRank,
} from '../src/services/giftAdEngine';
import { GIFT_TIERS, giftById } from '../src/constants/giftTiers';

describe('giftAdEngine — scope-based pricing', () => {
  test('a tiny venue promo needs the cheapest tier (Spark)', () => {
    const r = requiredGiftForScope({ reach: 'venue', radiusKm: 2, durationHours: 3, audience: 100 });
    expect(r.gift.id).toBe('spark');
    expect(r.cost).toBe(giftById('spark').coinCost);
    expect(r.sufficient).toBe(true);
  });

  test('city-wide for a day needs Blaze', () => {
    const r = requiredGiftForScope({ reach: 'city', radiusKm: 25, durationHours: 24, audience: 1500 });
    expect(r.gift.id).toBe('blaze');
  });

  test('cost scales up with reach (venue < city < region < national)', () => {
    const venue = requiredGiftForScope({ reach: 'venue' }).cost;
    const city = requiredGiftForScope({ reach: 'city' }).cost;
    const region = requiredGiftForScope({ reach: 'region' }).cost;
    const national = requiredGiftForScope({ reach: 'national' }).cost;
    expect(venue).toBeLessThan(city);
    expect(city).toBeLessThan(region);
    expect(region).toBeLessThan(national);
  });

  test('a large radius forces a higher tier even if reach says venue', () => {
    const r = requiredGiftForScope({ reach: 'venue', radiusKm: 120 });
    expect(['diamond', 'crown']).toContain(r.gift.id); // 120km exceeds Spark/Blaze radius
  });

  test('a long duration forces a higher tier', () => {
    // venue reach but wants 100h → Spark(6h)/Blaze(24h)/Diamond(72h) too short → Crown(168h)
    const r = requiredGiftForScope({ reach: 'venue', durationHours: 100 });
    expect(r.gift.id).toBe('crown');
  });

  test('huge audience forces a higher tier', () => {
    const r = requiredGiftForScope({ reach: 'venue', audience: 50000 });
    expect(r.gift.id).toBe('crown'); // only Crown caps >= 50k
  });

  test('beyond every tier → returns top tier flagged not sufficient', () => {
    const r = requiredGiftForScope({ audience: 5_000_000 });
    expect(r.gift.id).toBe('crown');
    expect(r.sufficient).toBe(false);
  });

  test('empty scope is satisfied by the cheapest tier', () => {
    expect(requiredGiftForScope({}).gift.id).toBe('spark');
  });
});

describe('giftAdEngine — reach helpers', () => {
  test('reachForRadius maps distance to the right band', () => {
    expect(reachForRadius(3)).toBe('venue');
    expect(reachForRadius(20)).toBe('city');
    expect(reachForRadius(100)).toBe('region');
    expect(reachForRadius(5000)).toBe('national');
  });
  test('reachRank orders levels ascending', () => {
    expect(reachRank('venue')).toBeLessThan(reachRank('national'));
    expect(reachRank('nonsense')).toBe(-1);
  });
});

describe('giftAdEngine — affordability', () => {
  test('canAfford compares vibe_coins to cost', () => {
    expect(canAfford(60, giftById('spark'))).toBe(true);   // 60 >= 50
    expect(canAfford(40, giftById('spark'))).toBe(false);
  });
});

describe('giftAdEngine — redeem → token', () => {
  const NOW = Date.parse('2026-06-23T12:00:00Z');

  test('redeeming a gift mints a token expiring after its duration', () => {
    const tok = redeemGift(giftById('blaze'), { now: NOW });
    expect(tok.giftId).toBe('blaze');
    expect(tok.reach).toBe('city');
    expect(new Date(tok.expiresAt).getTime()).toBe(NOW + 24 * 3600 * 1000);
  });

  test('redeemGift throws without a gift', () => {
    expect(() => redeemGift(null)).toThrow();
  });
});

describe('giftAdEngine — access control', () => {
  const NOW = Date.parse('2026-06-23T12:00:00Z');
  const blazeToken = redeemGift(giftById('blaze'), { now: NOW }); // city, 30km, 24h, 2000

  test('a valid token grants a scope within its reach', () => {
    expect(tokenGrantsScope(blazeToken, { reach: 'venue', radiusKm: 5, audience: 100 }, NOW)).toBe(true);
    expect(tokenGrantsScope(blazeToken, { reach: 'city', radiusKm: 30, audience: 2000 }, NOW)).toBe(true);
  });

  test('a token does NOT grant a scope beyond its reach', () => {
    expect(tokenGrantsScope(blazeToken, { reach: 'national' }, NOW)).toBe(false);
    expect(tokenGrantsScope(blazeToken, { reach: 'city', radiusKm: 100 }, NOW)).toBe(false);
    expect(tokenGrantsScope(blazeToken, { audience: 999999 }, NOW)).toBe(false);
  });

  test('an expired token grants nothing', () => {
    const later = NOW + 25 * 3600 * 1000; // past Blaze's 24h
    expect(tokenActive(blazeToken, later)).toBe(false);
    expect(tokenGrantsScope(blazeToken, { reach: 'venue' }, later)).toBe(false);
  });

  test('bestTokenForScope picks the strongest covering token', () => {
    const sparkToken = redeemGift(giftById('spark'), { now: NOW });
    const crownToken = redeemGift(giftById('crown'), { now: NOW });
    const best = bestTokenForScope([sparkToken, blazeToken, crownToken], { reach: 'city', radiusKm: 30 }, NOW);
    expect(best.giftId).toBe('crown'); // strongest that still covers
    const none = bestTokenForScope([sparkToken], { reach: 'national' }, NOW);
    expect(none).toBeNull();
  });
});

describe('giftAdEngine — registry sanity', () => {
  test('tiers are strictly ascending in cost and reach', () => {
    for (let i = 1; i < GIFT_TIERS.length; i++) {
      expect(GIFT_TIERS[i].coinCost).toBeGreaterThan(GIFT_TIERS[i - 1].coinCost);
      expect(reachRank(GIFT_TIERS[i].reach)).toBeGreaterThanOrEqual(reachRank(GIFT_TIERS[i - 1].reach));
    }
  });
});
