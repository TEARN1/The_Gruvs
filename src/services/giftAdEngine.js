/**
 * giftAdEngine — the brain of the Tiered Gift System.
 *
 * Three pure jobs (all unit-tested, no network):
 *   1. requiredGiftForScope() — given how far/long/large a promotion wants to
 *      reach, return the cheapest gift tier that covers it (scope-based pricing).
 *   2. redeemGift()           — turn a gift into an access TOKEN: a time-boxed
 *      grant of advertising/broadcast scope.
 *   3. tokenGrantsScope()     — access control: does a held token actually cover
 *      what the user is trying to broadcast, right now?
 *
 * Persistence (deducting vibe_coins, storing the token row) lives in a thin
 * service on top of this; the rules themselves stay here so they're testable.
 */
import { GIFT_TIERS, REACH_LEVELS, giftById } from '../constants/giftTiers';

/** Index of a reach level (higher = wider). -1 if unknown. */
export const reachRank = (reach) => REACH_LEVELS.indexOf(reach);

/** Smallest reach level whose radius covers `radiusKm`. */
export const reachForRadius = (radiusKm) => {
  if (!(radiusKm > 0)) return 'venue';
  const tier = GIFT_TIERS.find(g => g.radiusKm >= radiusKm);
  return tier ? tier.reach : 'national';
};

/**
 * Cheapest gift tier that satisfies the requested scope.
 * @param {object} scope
 * @param {string} [scope.reach]          'venue'|'city'|'region'|'national'
 * @param {number} [scope.radiusKm]       desired radius (raises reach if bigger)
 * @param {number} [scope.durationHours]  how long the promo should run
 * @param {number} [scope.audience]       expected audience size
 * @returns {{ gift:object, cost:number, sufficient:boolean, neededReach:string }}
 *   sufficient=false means even the top tier can't fully cover it (gift = top).
 */
export function requiredGiftForScope(scope = {}) {
  const { reach, radiusKm = 0, durationHours = 0, audience = 0 } = scope;
  // Needed reach = the widest implied by either an explicit reach or the radius.
  const byRadius = reachForRadius(radiusKm);
  const neededReach = reachRank(reach) > reachRank(byRadius) ? reach : byRadius;
  const neededRank = Math.max(0, reachRank(neededReach));

  const covers = (g) =>
    reachRank(g.reach) >= neededRank &&
    g.radiusKm >= radiusKm &&
    g.durationHours >= durationHours &&
    g.audienceCap >= audience;

  // GIFT_TIERS is ascending, so the first match is the cheapest sufficient one.
  const match = GIFT_TIERS.find(covers);
  if (match) return { gift: match, cost: match.coinCost, sufficient: true, neededReach };

  const top = GIFT_TIERS[GIFT_TIERS.length - 1];
  return { gift: top, cost: top.coinCost, sufficient: false, neededReach };
}

/** Can a user with `coins` vibe_coins afford this gift? */
export function canAfford(coins, gift) {
  return Number(coins) >= Number(gift?.coinCost || Infinity);
}

/**
 * Redeem a gift into an access token (pure — caller persists it).
 * @returns {{ giftId, reach, radiusKm, audienceCap, issuedAt, expiresAt }}
 */
export function redeemGift(gift, { now = Date.now() } = {}) {
  if (!gift) throw new Error('redeemGift: no gift');
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + gift.durationHours * 3600 * 1000).toISOString();
  return {
    giftId: gift.id,
    reach: gift.reach,
    radiusKm: gift.radiusKm,
    audienceCap: gift.audienceCap,
    issuedAt,
    expiresAt,
  };
}

/** Is a token still valid (not expired) at `now`? */
export function tokenActive(token, now = Date.now()) {
  if (!token?.expiresAt) return false;
  return new Date(token.expiresAt).getTime() > now;
}

/**
 * Access control: does `token` permit broadcasting at `scope` right now?
 * Must be unexpired AND cover the requested reach / radius / audience.
 */
export function tokenGrantsScope(token, scope = {}, now = Date.now()) {
  if (!tokenActive(token, now)) return false;
  const { reach = 'venue', radiusKm = 0, audience = 0 } = scope;
  return (
    reachRank(token.reach) >= Math.max(0, reachRank(reach)) &&
    Number(token.radiusKm) >= radiusKm &&
    Number(token.audienceCap) >= audience
  );
}

/** From a set of held tokens, the strongest one that covers the scope (or null). */
export function bestTokenForScope(tokens = [], scope = {}, now = Date.now()) {
  return (tokens || [])
    .filter(t => tokenGrantsScope(t, scope, now))
    .sort((a, b) => reachRank(b.reach) - reachRank(a.reach))[0] || null;
}

export default {
  requiredGiftForScope, redeemGift, tokenGrantsScope, tokenActive,
  bestTokenForScope, canAfford, reachForRadius, reachRank, giftById,
};
