// ── Vibe level ladder ─────────────────────────────────────────────────────────
// THE single source of truth for leveling (F3). The app used to have THREE
// formulas — this named ladder, floor(sqrt(xp/100)) in LevelManager, and
// floor(sqrt(xp/50)) in ProfilePage — so the level-up notification and the
// profile bar disagreed, and DiscoverPeople shipped its own copy of the ladder
// with the top tier misnamed "Grand Viber". Now:
//   • STATUS  = named tiers on vibe_score (earned contribution) — getVibeLevel.
//   • XP LVL  = ONE numeric curve on xp — getXpLevel (kept the /50 curve users
//     already see on their profile, so nobody's displayed level drops).
// Pure + null-safe.
//
// Tiers (Legend = the secret top tier from the masterpiece design):
export const VIBE_LEVELS = [
  { name: 'Viber',        min: 0,     max: 100,      color: '#94a3b8' },
  { name: 'Elite Viber',  min: 101,   max: 500,      color: '#06b6d4' },
  { name: 'Royal Viber',  min: 501,   max: 2000,     color: '#8b5cf6' },
  { name: 'Gruv Master',  min: 2001,  max: 10000,    color: '#f59e0b' },
  { name: 'Legend',       min: 10001, max: Infinity, color: '#ef4444' },
];

/**
 * @returns {{ name, min, max, next, toNext, progress }}
 *   name     — current tier name
 *   next     — next tier name (or null at the top)
 *   toNext   — points needed to reach the next tier (0 at the top)
 *   progress — % toward the next tier (0–100; 100 at the top)
 */
export function getVibeLevel(score = 0) {
  const s = Math.max(0, Number(score) || 0);
  let i = VIBE_LEVELS.findIndex((l) => s >= l.min && s <= l.max);
  if (i === -1) i = VIBE_LEVELS.length - 1;
  const current = VIBE_LEVELS[i];
  const next = VIBE_LEVELS[i + 1] || null;
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(100, Math.max(0, ((s - current.min) / span) * 100)) : 100;
  const toNext = next ? Math.max(0, next.min - s) : 0;
  return { name: current.name, min: current.min, max: current.max, color: current.color, next: next ? next.name : null, toNext, progress };
}

/**
 * THE numeric XP level curve (F3) — every "LVL n" in the app comes from here.
 * level = floor(sqrt(xp / 50)) + 1, capped at 100.
 * @returns {{ level, xpStart, xpEnd, pct, toNext }}
 */
export function getXpLevel(xp = 0) {
  const x = Math.max(0, Number(xp) || 0);
  const level = Math.min(100, Math.floor(Math.sqrt(x / 50)) + 1);
  const xpFor = (n) => Math.pow(n - 1, 2) * 50;
  const xpStart = xpFor(level);
  const xpEnd = xpFor(level + 1);
  const pct = level >= 100 ? 100 : Math.round(Math.min(100, Math.max(0, ((x - xpStart) / (xpEnd - xpStart)) * 100)));
  return { level, xpStart, xpEnd, pct, toNext: level >= 100 ? 0 : Math.max(0, xpEnd - x) };
}
