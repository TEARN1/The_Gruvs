/**
 * fanFidelity — the math core of the Fan Reciprocity engine.
 *
 * Computes a fan's Fidelity Score toward a host/brand from REAL recorded
 * actions (Touch Downs, RSVPs, shares, comments, reactions, likes) using an
 * exponential time-decay sum:
 *
 *      F = Σ  W(type) · e^(−λ·ageDays)      λ = ln(2) / halfLifeDays
 *
 * Design properties (the "un-gameable" rules, scaled to our reality):
 *  • Showing up (verified GPS Touch Down) outweighs everything digital —
 *    100 likes can never beat one real attendance. Truth Protocol.
 *  • Time decay: two years of quiet, consistent support keeps solid value;
 *    a burst of activity this afternoon must PERSIST to matter.
 *  • Burst guard: actions beyond a velocity cap inside one hour contribute
 *    ZERO weight (comment-spam / bot bursts are stripped, not just dampened).
 *
 * Pure functions — no I/O. Callers feed rows from live_checkins, event_rsvps,
 * echoes, event_reactions, media_likes. See FAN_RECIPROCITY.md for the roadmap.
 */

export const SIGNAL_WEIGHTS = {
  touchdown: 10,  // geolocation-verified presence — the gold signal
  rsvp: 4,        // stated intent (Locked In)
  share: 3,       // active advocacy
  comment: 2,     // effortful engagement (echoes)
  reaction: 1.5,
  like: 1,
  view: 0.1,
};

export const DEFAULT_HALF_LIFE_DAYS = 180; // support halves in value every ~6 months

const DAY_MS = 86400000;

/**
 * Strip weight from burst actions: within any rolling 1-hour bucket, only the
 * first `maxPerHour` actions of a given type count; the rest are zeroed.
 * @param {Array<{type:string, at:string|number}>} actions
 */
export function applyBurstGuard(actions = [], { maxPerHour = 30 } = {}) {
  const seen = new Map(); // `${type}:${hourBucket}` -> count
  return actions.map(a => {
    const t = new Date(a.at).getTime();
    if (isNaN(t)) return { ...a, _guarded: true };
    const key = `${a.type}:${Math.floor(t / 3600000)}`;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    return n > maxPerHour ? { ...a, _guarded: true } : a;
  });
}

/**
 * Fidelity score for one fan toward one host/brand.
 * @param {Array<{type:string, at:string|number}>} actions — the fan's recorded actions
 * @param {{now?:number, halfLifeDays?:number, maxPerHour?:number}} opts
 * @returns {number} decayed weighted sum, rounded to 2dp
 */
export function fidelityScore(actions = [], { now = Date.now(), halfLifeDays = DEFAULT_HALF_LIFE_DAYS, maxPerHour = 30 } = {}) {
  const lambda = Math.LN2 / halfLifeDays;
  let score = 0;
  for (const a of applyBurstGuard(actions, { maxPerHour })) {
    if (a._guarded) continue;
    const w = SIGNAL_WEIGHTS[a.type] || 0;
    if (!w) continue;
    const t = new Date(a.at).getTime();
    if (isNaN(t) || t > now) continue; // future/invalid timestamps never score
    const ageDays = (now - t) / DAY_MS;
    score += w * Math.exp(-lambda * ageDays);
  }
  return Math.round(score * 100) / 100;
}

/** Loyalty tier from a fidelity score — the fan's public badge. */
export function loyaltyTier(score) {
  if (score >= 60) return { key: 'day_one', label: 'Day One', emoji: '🏆' };
  if (score >= 25) return { key: 'real_one', label: 'Real One', emoji: '💎' };
  if (score >= 8) return { key: 'supporter', label: 'Supporter', emoji: '⭐' };
  return { key: 'new_energy', label: 'New Energy', emoji: '✨' };
}

/**
 * Reciprocity Score (0–100) for a host/brand — community give-back vs
 * extraction, from REAL platform actions only:
 *  give-back: free events hosted, rewards issued to fans, host engaging back
 *             (comments/reactions the host leaves on others' content)
 *  extraction: paid events hosted, promo posts
 * A host with zero history sits at neutral 50 — unknown, not condemned.
 */
export function reciprocityScore({ freeEvents = 0, rewardsIssued = 0, hostEngagementsBack = 0, paidEvents = 0, promoPosts = 0 } = {}) {
  const give = freeEvents * 3 + rewardsIssued * 5 + Math.min(hostEngagementsBack, 200) * 0.25;
  const take = paidEvents * 2 + promoPosts * 0.5;
  if (give === 0 && take === 0) return 50;
  const ratio = give / (give + take);
  return Math.round(ratio * 100);
}

/** Public bracket for a reciprocity score. */
export function reciprocityBracket(score) {
  if (score >= 75) return { key: 'community_partner', label: 'Community Partner', emoji: '🤝' };
  if (score >= 50) return { key: 'gives_back', label: 'Gives Back', emoji: '🌱' };
  if (score >= 25) return { key: 'mostly_takes', label: 'Mostly Takes', emoji: '⚖️' };
  return { key: 'eats_alone', label: 'Eats Alone', emoji: '🍽️' };
}

export default { SIGNAL_WEIGHTS, fidelityScore, applyBurstGuard, loyaltyTier, reciprocityScore, reciprocityBracket, DEFAULT_HALF_LIFE_DAYS };
