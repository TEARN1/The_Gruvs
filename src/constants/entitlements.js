/**
 * entitlements — the single source of truth for WHO can use WHAT.
 *
 * Maps subscription tiers → feature keys. The app gates premium depth (never the
 * core create/discover/Touch Down loop) through useEntitlement().can(key) and
 * <ProGate>. This is constraint-safe: it's pure config + runtime checks — no
 * payment SDK, no money handling. A real rail (RevenueCat IAP, store = merchant
 * of record) only has to set profiles.subscription_tier later; everything else
 * is already wired.
 *
 * While MONETIZATION_LIVE is false (bootstrap/pre-revenue), gates are OPEN —
 * every feature is free for everyone — so nothing changes for users until you
 * deliberately flip the master switch in MonetizationRegistry.js.
 */

// Tiers, lowest → highest power. A tier inherits everything below it.
export const TIERS = {
  FREE:        'free',
  PRO:         'pro',          // consumer "Gruvs Pro"
  BIZ_STARTER: 'biz_starter',  // "Gruvs for Business" entry
  BIZ_PRO:     'biz_pro',      // business power tier
};

// Rank for inheritance checks. Business tiers are a separate axis from consumer
// Pro, but rank-wise a paying business also gets consumer Pro perks.
const RANK = {
  [TIERS.FREE]: 0,
  [TIERS.PRO]: 1,
  [TIERS.BIZ_STARTER]: 2,
  [TIERS.BIZ_PRO]: 3,
};

// ── Consumer Pro features ─────────────────────────────────────────────────────
// "Gate the depth, never the core loop." Posting/browsing/Touch Down stay free.
export const PRO_FEATURES = {
  who_viewed_you:        { label: 'See who viewed you',        blurb: 'Know exactly who checked out your Vibe Card.' },
  who_crossed_you:       { label: 'Full Crossed Paths',        blurb: 'See everyone you keep crossing — not just the top few.' },
  scout_advanced:        { label: 'Advanced Scout filters',    blurb: 'Filter people by every signal, not just the basics.' },
  dm_non_followers:      { label: 'Message anyone',            blurb: 'DM people who don’t follow you back.' },
  radius_max:            { label: 'Widest discovery radius',   blurb: 'Find Gruvs and Vibers across the whole city.' },
  beacon_extended:       { label: 'Long-burn beacon',          blurb: 'Stay visible "out now" for longer.' },
  planner_horizon:       { label: 'Month & year planner',      blurb: 'Plan further than the next few days.' },
  unlimited_bookmarks:   { label: 'Unlimited bookmarks',       blurb: 'Save as many Gruvs as you want.' },
  hd_reels:              { label: 'HD & longer reels',         blurb: 'Post higher quality, longer clips.' },
  premium_auras:         { label: 'Premium auras & themes',    blurb: 'Unlock the exclusive look packs.' },
  incognito:             { label: 'Incognito browsing',        blurb: 'Look around without leaving a footprint.' },
  early_rsvp:            { label: 'Early-access RSVP',          blurb: 'Get your spot before the rush.' },
};

// ── Business features ─────────────────────────────────────────────────────────
export const BIZ_FEATURES = {
  business_dashboard:    { label: 'Business dashboard',        tier: TIERS.BIZ_STARTER },
  store_builder:         { label: 'Storefront builder',        tier: TIERS.BIZ_STARTER },
  campaigns:             { label: 'Missions & promos',         tier: TIERS.BIZ_STARTER },
  drip_surveys:          { label: 'Drip surveys',              tier: TIERS.BIZ_STARTER },
  audience_targeting:    { label: 'Audience targeting',        tier: TIERS.BIZ_PRO },
  attendance_analytics:  { label: 'Proof-of-attendance analytics', tier: TIERS.BIZ_PRO },
  priority_placement:    { label: 'Priority placement',        tier: TIERS.BIZ_PRO },
  unlimited_events:      { label: 'Unlimited events',          tier: TIERS.BIZ_PRO },
};

// featureKey → minimum tier required.
const FEATURE_MIN_TIER = {
  ...Object.fromEntries(Object.keys(PRO_FEATURES).map(k => [k, TIERS.PRO])),
  ...Object.fromEntries(Object.entries(BIZ_FEATURES).map(([k, v]) => [k, v.tier])),
};

/** Does `tier` satisfy the minimum required for `featureKey`? */
export function tierAllows(tier, featureKey) {
  const min = FEATURE_MIN_TIER[featureKey];
  if (!min) return true; // unknown / ungated feature → always allowed
  return (RANK[tier] ?? 0) >= (RANK[min] ?? 99);
}

export const ALL_FEATURE_KEYS = Object.keys(FEATURE_MIN_TIER);
export const minTierFor = (featureKey) => FEATURE_MIN_TIER[featureKey] || TIERS.FREE;
