/**
 * reelScore — the Reels "For You" algorithm (Phase 1).
 *
 * "For You" was reverse-chronological — whoever posted last owned the feed,
 * nothing was personal, and you were re-shown reels you'd already watched.
 * This is a real short-form ranker, Gruvs-flavoured:
 *
 *   • ENGAGEMENT QUALITY over raw counts — likes+comments *per view*
 *     (Wilson-flavoured), so a small reel that lands beats a big stale one.
 *   • FRESH beats old (fast exp decay — short-form lives in hours, not days).
 *   • YOUR GRAPH matters — authors you follow rank up.
 *   • EVENT-LINKED reels get a lift: a reel that pulls you to a real night out
 *     serves the core loop (discover → go), not endless scrolling.
 *   • ALREADY-WATCHED demotes hard (reel_views), liked demotes gently
 *     (consumed, but a taste signal the deep profile keeps).
 *   • AUTHOR DIVERSITY — one creator can't own the next 10 swipes.
 *
 * Pure + deterministic (jitter is caller-seeded), fully testable.
 */

const HOUR = 3600000;

/** Engagement quality: reactions per view with a volume floor, log-compressed
 *  volume bonus. Unknown views → conservative floor, never a divide-by-zero. */
export function engagementSignal(reel) {
  const likes = Number(reel?.like_count) || 0;
  const comments = Number(reel?.comment_count) || 0;
  const views = Math.max(Number(reel?.view_count) || 0, 20); // floor damps tiny-sample flukes
  const reactions = likes + comments * 2;                     // a comment costs more than a tap
  const rate = Math.min(1, reactions / views);                // quality: did it LAND?
  const volume = Math.log10(1 + reactions);                   // compressed mass
  return rate * 40 + volume * 6;
}

/** Freshness: exp decay, half-life ~18h. No created_at → neutral small. */
export function freshnessSignal(reel, now = Date.now()) {
  const t = reel?.created_at ? new Date(reel.created_at).getTime() : NaN;
  if (!Number.isFinite(t)) return 5;
  const ageH = Math.max(0, (now - t) / HOUR);
  return 30 * Math.exp(-ageH / 26); // ~half after 18h, ~0 after 4 days
}

/**
 * Composite score for one reel.
 * @param reel   row from ReelsRepository (with _liked/_following stamped)
 * @param opts   { viewedIds: Set<reelId>, now }
 */
export function reelScore(reel, { viewedIds = new Set(), now = Date.now() } = {}) {
  if (!reel) return 0;

  const engagement = engagementSignal(reel);
  const freshness = freshnessSignal(reel, now);
  const followedAuthor = reel._following ? 22 : 0;
  const eventLinked = reel.event_id ? 8 : 0;            // pulls people to a real night
  const verified = reel.profiles?.is_verified ? 4 : 0;
  // Author contribution enters tiny and log-compressed — fame is not the feed.
  const authorRep = Math.min(6, Math.log10(1 + (Number(reel.profiles?.vibe_score) || 0)) * 1.5);

  let score = engagement + freshness + followedAuthor + eventLinked + verified + authorRep;

  if (viewedIds.has(reel.id)) score *= 0.35;            // already watched — mostly done
  else if (reel._liked) score *= 0.6;                   // consumed + enjoyed — gently retire

  return score;
}

/**
 * Rank a reels page for "For You": score, then a greedy author-diversity pass
 * (same MMR idea as the event feed) so one creator can't own consecutive
 * swipes. Deterministic given inputs; pass `jitter` (0..1 per call) for
 * per-pull variety.
 */
export function rankReels(reels, { viewedIds = new Set(), now = Date.now(), jitterSeed = 0, authorPenalty = 0.3 } = {}) {
  const list = (Array.isArray(reels) ? reels : []).filter(Boolean);
  if (list.length < 2) return list;

  // Deterministic per-item jitter from the seed (so refresh feels alive but a
  // given fetch is stable + testable).
  const jitterFor = (id, max) => {
    if (!jitterSeed) return 0;
    let h = 0;
    const s = `${jitterSeed}:${id}`;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return ((h % 1000) / 1000 - 0.5) * max;
  };

  const scored = list.map((r) => {
    const s = reelScore(r, { viewedIds, now });
    return { r, base: s + jitterFor(r.id, s * 0.15) };
  });

  // Greedy pick with growing same-author penalty — diversity without deletion.
  const picked = [];
  const usedAuthor = new Map();
  const remaining = scored.slice();
  while (remaining.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const { r, base } = remaining[i];
      const n = usedAuthor.get(r.user_id) || 0;
      const val = base * (1 - Math.min(0.8, n * authorPenalty));
      if (val > bestVal) { bestVal = val; bestIdx = i; }
    }
    const { r } = remaining.splice(bestIdx, 1)[0];
    picked.push(r);
    usedAuthor.set(r.user_id, (usedAuthor.get(r.user_id) || 0) + 1);
  }
  return picked;
}

export default { reelScore, rankReels, engagementSignal, freshnessSignal };
