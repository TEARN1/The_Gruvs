/**
 * giftTiers — the Tiered Gift System registry.
 *
 * Virtual gifts are the currency for advertising reach. Each gift is a value
 * tier that, when redeemed, unlocks a temporary advertising/broadcast scope
 * (see src/services/giftAdEngine). Bigger reach → higher tier → higher cost,
 * so a venue shout-out is cheap and a national push is dear (scope-based pricing).
 *
 * Constraint-safe: gifts are priced in vibe_coins — the EARNED in-app currency
 * (profiles.vibe_coins), not real money. A real-money rail (IAP top-ups) can be
 * layered on later via MonetizationRegistry without touching this logic.
 */

// Advertising reach, smallest → largest. A gift's reach covers every level at or
// below its own (a city gift also works for a single venue).
export const REACH_LEVELS = ['venue', 'city', 'region', 'national'];

export const REACH_META = {
  venue:    { label: 'This venue / event', icon: 'map-pin' },
  city:     { label: 'Across the city',    icon: 'map' },
  region:   { label: 'Whole region',       icon: 'compass' },
  national: { label: 'Nationwide',         icon: 'globe' },
};

// Tiers ascending by power. Costs are in vibe_coins. radiusKm / durationHours /
// audienceCap define the exact scope a redeemed gift unlocks.
export const GIFT_TIERS = [
  {
    id: 'spark',   name: 'Spark',   emoji: '✨', tier: 1,
    coinCost: 50,   reach: 'venue',    radiusKm: 5,    durationHours: 6,   audienceCap: 200,
    blurb: 'A quick shout to people at one spot.',
    accent: '#22d3ee',
  },
  {
    id: 'blaze',   name: 'Blaze',   emoji: '🔥', tier: 2,
    coinCost: 200,  reach: 'city',     radiusKm: 30,   durationHours: 24,  audienceCap: 2000,
    blurb: 'Light up your whole city for a day.',
    accent: '#f59e0b',
  },
  {
    id: 'diamond', name: 'Diamond', emoji: '💎', tier: 3,
    coinCost: 750,  reach: 'region',   radiusKm: 150,  durationHours: 72,  audienceCap: 20000,
    blurb: 'Reach the region for three days.',
    accent: '#a855f7',
  },
  {
    id: 'crown',   name: 'Crown',   emoji: '👑', tier: 4,
    coinCost: 2500, reach: 'national', radiusKm: 100000, durationHours: 168, audienceCap: 1000000,
    blurb: 'Go nationwide for a full week.',
    accent: '#eab308',
  },
];

export const giftById = (id) => GIFT_TIERS.find(g => g.id === id) || null;

export default { REACH_LEVELS, REACH_META, GIFT_TIERS, giftById };
