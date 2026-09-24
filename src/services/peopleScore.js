/**
 * peopleScore — THE person-to-person relevance engine (F5).
 *
 * Events had a 9-signal ranker; people had NOTHING — every people surface
 * (Find Viber, Suggested Follows, Who Was There) fell back to fame
 * (vibe_score DESC) or a bare mutual count, and null-permissive filters let
 * missing attributes pass as matches. This engine fixes both:
 *
 *   • "Who should I meet?" is answered by REAL signals — shared interests,
 *     real-world co-presence (events you both Touched Down at), mutual
 *     follows, reciprocity, proximity, recency — not by who is famous.
 *   • Unknown attributes are NEUTRAL, never a match and never a penalty.
 *   • Trust (SIS) scales the bundle (0.85–1.25×) like the event ranker —
 *     trust never buys reach, it only amplifies genuine relevance.
 *
 * Pure + deterministic — no I/O, fully testable. Callers fetch the inputs.
 */
import { distanceKm } from '../utils/geo';

// ── Signal helpers ────────────────────────────────────────────────────────────

/** Shared-interest affinity, position-weighted (a person's first interest says
 *  the most about them). Unknown/empty on either side → 0 (neutral). Max ~35. */
export function interestOverlap(viewerInterests, candidateInterests) {
  const a = Array.isArray(viewerInterests) ? viewerInterests.filter(Boolean) : [];
  const b = Array.isArray(candidateInterests) ? candidateInterests.filter(Boolean) : [];
  if (!a.length || !b.length) return 0;
  let score = 0;
  a.forEach((interest, i) => {
    const j = b.indexOf(interest);
    if (j !== -1) score += 14 * (1 / (i + 1)) * (1 / (j * 0.5 + 1));
  });
  return Math.min(35, score);
}

/** Soft geographic closeness (0–15; unknown → neutral 7, never a penalty). */
export function proximitySignal(viewer, candidate) {
  const d = distanceKm(viewer?.lat, viewer?.lon, candidate?.lat, candidate?.lon);
  if (d == null) return 7;
  if (d <= 2) return 15;
  if (d <= 5) return 12;
  if (d <= 15) return 9;
  if (d <= 40) return 5;
  return 2;
}

/** Recency/presence: online now beats active today beats gone-for-a-month. */
export function recencySignal(candidate, now = Date.now()) {
  if (candidate?.is_online) return 12;
  const seen = candidate?.last_seen ? new Date(candidate.last_seen).getTime() : NaN;
  if (!Number.isFinite(seen)) return 4; // unknown → mild neutral
  const h = (now - seen) / 3600000;
  if (h <= 24) return 8;
  if (h <= 24 * 7) return 5;
  return 1;
}

// ── The score ─────────────────────────────────────────────────────────────────

/**
 * personScore(viewer, candidate, extras) → number (higher = more relevant).
 *
 * @param viewer    { id, interests, lat, lon }
 * @param candidate { id, interests, lat, lon, social_integrity_score,
 *                    vibe_score, is_verified, resident_trust_tier,
 *                    is_online, last_seen }
 * @param extras    { coPresenceCount, mutualCount, followsViewer,
 *                    isFollowedByViewer, sameEventNow, now }
 */
export function personScore(viewer = {}, candidate = {}, {
  coPresenceCount = 0,     // events you both physically attended — the real world
  mutualCount = 0,         // mutual follows
  followsViewer = false,   // they follow you (reciprocity pull)
  isFollowedByViewer = false,
  sameEventNow = false,    // checked in at the SAME event as you, right now
  now = Date.now(),
} = {}) {
  // 0. Here, right now, dominates everything below it — including proximity.
  // "Two blocks away" and "in this room with you" are not the same claim, and
  // conflating them is exactly the gap Find Them had: a GPS radius scan with
  // no ranking, so someone at your table and someone across the neighbourhood
  // came back in arbitrary order.
  const hereNow = sameEventNow ? 40 : 0;

  // 1. Real-world co-presence DOMINATES — you keep ending up in the same rooms.
  const coPresence = Math.log1p(Math.max(0, coPresenceCount)) * 13;      // ~31 at 10 shared nights

  // 2. Shared interests (position-weighted, neutral when unknown).
  const affinity = interestOverlap(viewer.interests, candidate.interests); // ≤ 35

  // 3. Social graph: mutuals + reciprocity.
  const mutuals = Math.log1p(Math.max(0, mutualCount)) * 8;               // ~19 at 10 mutuals
  const reciprocity = (followsViewer && !isFollowedByViewer) ? 10 : 0;    // follows you back-worthy
  const familiarity = isFollowedByViewer ? 4 : 0;

  // 4. Proximity (soft — visibility is a safety property, never hard-filter).
  const proximity = proximitySignal(viewer, candidate);                    // ≤ 15

  // 5. Recency / online-now.
  const recency = recencySignal(candidate, now);                           // ≤ 12

  // 6. Identity trust: small lifts, never dominance.
  const verified = candidate.is_verified ? 5 : 0;
  const residentTier = candidate.resident_trust_tier === 'verified' ? 5
    : candidate.resident_trust_tier === 'trusted' ? 3 : 0;

  // 7. Contribution enters only log-compressed and small — fame must not be
  //    the ranking (that was the bug this engine replaces).
  const contribution = Math.min(8, Math.log10(1 + Math.max(0, Number(candidate.vibe_score) || 0)) * 2);

  const raw = hereNow + coPresence + affinity + mutuals + reciprocity + familiarity
    + proximity + recency + verified + residentTier + contribution;

  // 8. Behaviour trust scales the bundle (bounded, like eventScore's 0.8–1.4).
  const sis = Number(candidate.social_integrity_score);
  const trustMultiplier = Number.isFinite(sis)
    ? 0.85 + (Math.min(Math.max(sis, 0), 100) / 100) * 0.4   // [0.85, 1.25]
    : 1;                                                      // unknown → neutral

  return raw * trustMultiplier;
}

/**
 * rankPeople(viewer, candidates, extrasById) → candidates sorted by relevance,
 * each stamped with `_personScore`. extrasById: Map/obj of candidate.id →
 * { coPresenceCount, mutualCount, followsViewer, isFollowedByViewer, sameEventNow }.
 */
export function rankPeople(viewer, candidates = [], extrasById = {}, now = Date.now()) {
  const get = (id) => (extrasById instanceof Map ? extrasById.get(id) : extrasById?.[id]) || {};
  return (Array.isArray(candidates) ? candidates : [])
    .filter(Boolean)
    .map((c) => ({ ...c, _personScore: personScore(viewer, c, { ...get(c.id), now }) }))
    .sort((a, b) => b._personScore - a._personScore);
}

export default { personScore, rankPeople, interestOverlap, proximitySignal, recencySignal };
