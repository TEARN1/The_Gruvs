/**
 * weightedPick — score-weighted random selection (Vibe Roulette's brain).
 *
 * The roulette used to be Math.random() over everything: a dead event with
 * zero presence had the same odds as tonight's hottest floor. Serendipity IS
 * the product, so this stays random — but weighted, so better nights win more
 * often while weak ones remain possible (discovery never hard-filters).
 *
 * Pure; inject `rand` for deterministic tests.
 */
export function weightedPick(items, weightOf, rand = Math.random) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  // Floor at 1 so nothing has zero odds; sqrt-soften so a mega-event doesn't
  // make the wheel a foregone conclusion (it's still a roulette).
  const weights = list.map((it) => {
    const w = Number(weightOf ? weightOf(it) : 1);
    return Math.sqrt(Math.max(1, Number.isFinite(w) ? w : 1));
  });
  const total = weights.reduce((s, w) => s + w, 0);

  let roll = rand() * total;
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return list[i];
  }
  return list[list.length - 1];
}
