/**
 * searchRelevance — real search ranking + typo tolerance (Phase 3).
 *
 * Search used to return ilike substring hits ordered by vibe_count — i.e. the
 * most-liked match first, not the BEST match, and one typo meant zero results.
 * This module is the ranking + fuzz brain:
 *
 *   • Field-weighted relevance: exact title > title starts-with > title word >
 *     title substring > venue > category/city > description.
 *   • Typo tolerance: token-level Damerau-Levenshtein (1 edit for words ≥ 4,
 *     2 edits for words ≥ 7) — "amapaino" still finds "Amapiano".
 *   • Utility tiebreaks: upcoming beats finished, then real heat — fame is a
 *     tiebreak, never the ranking.
 *
 * Pure + deterministic. Callers fetch candidate pools; this orders them.
 */

/** Damerau-Levenshtein distance, early-exit capped at `max`. */
export function editDistance(a = '', b = '', max = 2) {
  a = String(a); b = String(b);
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  let prevPrev = null;
  let prev = Array.from({ length: bl + 1 }, (_, j) => j);
  for (let i = 1; i <= al; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      // transposition (Damerau): "amapaino" → "amapiano"
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1; // early exit — nothing in this row can recover
    prevPrev = prev; prev = cur;
  }
  return prev[bl];
}

/** Allowed edits for a query token: 0 for short words, 1 for ≥4, 2 for ≥7. */
const tolerance = (token) => (token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0);

const norm = (s) => String(s || '').toLowerCase().trim();
const words = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Does `text` match `token` exactly-ish (substring) or within typo tolerance? */
export function fuzzyTokenMatch(text, token) {
  const t = norm(token);
  if (!t) return { hit: false };
  const hay = norm(text);
  if (!hay) return { hit: false };
  if (hay.includes(t)) return { hit: true, exact: true };
  const tol = tolerance(t);
  if (!tol) return { hit: false };
  for (const w of words(hay)) {
    if (editDistance(w, t, tol) <= tol) return { hit: true, exact: false };
  }
  return { hit: false };
}

/**
 * Relevance of one EVENT for a query. 0 = no match at all (even fuzzy).
 * Field weights: title 50 / venue 24 / category+city 14 / description 8;
 * exact-field bonuses; fuzzy hits earn 60% of the field weight.
 */
export function eventRelevance(query, event, now = Date.now()) {
  const q = norm(query);
  if (!q || !event) return 0;
  const tokens = words(q);
  if (!tokens.length) return 0;

  const fields = [
    { text: event.title, weight: 50 },
    { text: event.venue_name, weight: 24 },
    { text: event.category, weight: 14 },
    { text: event.city, weight: 14 },
    { text: event.description, weight: 8 },
  ];

  let score = 0;
  let anyHit = false;
  for (const token of tokens) {
    let best = 0;
    for (const f of fields) {
      const m = fuzzyTokenMatch(f.text, token);
      if (!m.hit) continue;
      best = Math.max(best, f.weight * (m.exact ? 1 : 0.6));
    }
    if (best > 0) anyHit = true;
    score += best;
  }
  if (!anyHit) return 0;
  score /= tokens.length; // multi-word queries: average per-token quality

  const title = norm(event.title);
  if (title === q) score += 40;                 // exact title
  else if (title.startsWith(q)) score += 18;    // title prefix

  // Utility tiebreaks — searching "amapiano" should surface the NEXT amapiano
  // night above one from last month; fame only separates otherwise-equal hits.
  if (event.event_date) {
    const start = new Date(`${String(event.event_date).slice(0, 10)}T${event.event_time || '20:00'}:00`).getTime();
    if (Number.isFinite(start)) score += start >= now - 8 * 3600000 ? 12 : -10;
  }
  score += Math.min(6, Math.log10(1 + (Number(event.vibe_count) || 0)) * 2);

  return score;
}

/** Relevance of one USER (profile) for a query. */
export function userRelevance(query, user) {
  const q = norm(query);
  if (!q || !user) return 0;
  const uname = norm(user.username);
  const dname = norm(user.display_name);
  let score = 0;
  if (uname === q || dname === q) score += 60;
  else if (uname.startsWith(q) || dname.startsWith(q)) score += 40;
  else {
    const tokens = words(q);
    let anyHit = false;
    for (const token of tokens) {
      if (fuzzyTokenMatch(user.username, token).hit || fuzzyTokenMatch(user.display_name, token).hit) { score += 24; anyHit = true; }
      else if (fuzzyTokenMatch(user.bio, token).hit) { score += 8; anyHit = true; }
    }
    if (!anyHit) return 0;
  }
  score += Math.min(5, Math.log10(1 + (Number(user.vibe_score) || 0)) * 1.5); // tiebreak only
  return score;
}

/** Rank event results; drops non-matches (score 0). */
export function rankEventResults(query, events = [], now = Date.now()) {
  return (Array.isArray(events) ? events : [])
    .filter(Boolean)
    .map((e) => ({ e, s: eventRelevance(query, e, now) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => ({ ...x.e, _searchScore: x.s }));
}

/** Rank user results; drops non-matches. */
export function rankUserResults(query, users = []) {
  return (Array.isArray(users) ? users : [])
    .filter(Boolean)
    .map((u) => ({ u, s: userRelevance(query, u) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => ({ ...x.u, _searchScore: x.s }));
}

export default { editDistance, fuzzyTokenMatch, eventRelevance, userRelevance, rankEventResults, rankUserResults };
