// ── Vibe level ladder ─────────────────────────────────────────────────────────
// The single source of truth for a Viber's level from their vibe_score.
// Earned by real-world presence (Touch Downs weigh most); status + the unlock
// menu hang off this. Pure + null-safe.
//
// Tiers (Legend = the secret top tier from the masterpiece design):
export const VIBE_LEVELS = [
  { name: 'Viber',        min: 0,     max: 100 },
  { name: 'Elite Viber',  min: 101,   max: 500 },
  { name: 'Royal Viber',  min: 501,   max: 2000 },
  { name: 'Gruv Master',  min: 2001,  max: 10000 },
  { name: 'Legend',       min: 10001, max: Infinity },
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
  return { name: current.name, min: current.min, max: current.max, next: next ? next.name : null, toNext, progress };
}
