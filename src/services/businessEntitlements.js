/**
 * businessEntitlements — tiers finally GATE something (A1).
 *
 * The Business dashboard sold four tiers (Starter/Pro/Royal/Enterprise) whose
 * perks were pure display copy — every feature was open to everyone, so
 * upgrading meant nothing. This is the single source of truth for what each
 * tier can do; every business surface checks HERE, never its own copy.
 *
 * Money posture: tier changes are free today (no PSP). When RevenueCat lands,
 * IT sets profiles/business tier — this module doesn't care who set it, it
 * only answers "what can this tier do?". Pure + null-safe (unknown tier =
 * starter — never accidentally grant by default).
 */

export const TIER_ORDER = ['starter', 'pro', 'royal', 'enterprise'];

const rank = (tier) => {
  const i = TIER_ORDER.indexOf(String(tier || '').toLowerCase());
  return i === -1 ? 0 : i; // unknown → starter, never grant by default
};

/** tierAtLeast('pro')('starter') → false */
export const tierAtLeast = (tier, min) => rank(tier) >= rank(min);

// The entitlement table — mirrors the marketed perks exactly, so the pitch
// and the product can never drift apart again.
const LIMITS = {
  // Missions (campaigns) a business may LAUNCH per calendar month.
  missionsPerMonth: { starter: 5, pro: Infinity, royal: Infinity, enterprise: Infinity },
  // Max Crowd targets a single Mission may address.
  crowdTargetsPerMission: { starter: 500, pro: 10000, royal: 50000, enterprise: Infinity },
};
const FLAGS = {
  advancedReads: 'pro',       // deep analytics panels (Starter keeps Basic Reads)
  storefront: 'pro',          // the Storefront builder
  apiAccess: 'royal',
  backingMarketplace: 'royal',
  prioritySupport: 'royal',
  customDomain: 'royal',
  bulkMissions: 'enterprise',
  whiteLabel: 'enterprise',
};

/** Numeric limit for a tier. limit('starter','missionsPerMonth') → 5 */
export function limit(tier, key) {
  const row = LIMITS[key];
  if (!row) return Infinity;
  const t = TIER_ORDER[rank(tier)];
  return row[t] ?? row.starter;
}

/** Boolean capability. can('starter','storefront') → false */
export function can(tier, key) {
  const min = FLAGS[key];
  if (!min) return true; // unknown key = not a gated feature
  return tierAtLeast(tier, min);
}

/** The lowest tier that unlocks a capability (for upgrade CTAs). */
export function tierFor(key) {
  return FLAGS[key] || 'starter';
}

/**
 * Missions left this month. Counts campaigns created in the current calendar
 * month against the tier quota. → { left, used, quota, blocked }
 */
export function missionQuota(tier, campaigns = [], now = new Date()) {
  const quota = limit(tier, 'missionsPerMonth');
  const y = now.getFullYear(), m = now.getMonth();
  const used = (Array.isArray(campaigns) ? campaigns : []).filter((c) => {
    const t = c?.created_at ? new Date(c.created_at) : null;
    return t && t.getFullYear() === y && t.getMonth() === m;
  }).length;
  const left = quota === Infinity ? Infinity : Math.max(0, quota - used);
  return { left, used, quota, blocked: left !== Infinity && left <= 0 };
}

/** Clamp a Mission's audience size to the tier's ceiling. */
export function clampAudience(tier, requested) {
  const cap = limit(tier, 'crowdTargetsPerMission');
  const n = Number(requested);
  if (!Number.isFinite(n) || n <= 0) return cap === Infinity ? 0 : Math.min(500, cap);
  return cap === Infinity ? n : Math.min(n, cap);
}

export default { TIER_ORDER, tierAtLeast, limit, can, tierFor, missionQuota, clampAudience };
