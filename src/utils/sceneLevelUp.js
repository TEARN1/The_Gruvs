// ── Scene level-up ────────────────────────────────────────────────────────────
// "You leveled the scene up" (#115). When a venue you're a verified regular at is
// trending right now, that's partly YOUR doing — you helped build it. Matches
// your regulars against what's hot and hands back a celebration. Pure.

const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

export function detectSceneLevelUp(regulars = [], hotVenues = []) {
  const hot = new Set((Array.isArray(hotVenues) ? hotVenues : []).map(norm).filter(Boolean));
  const seen = new Set();
  const out = [];

  for (const r of (Array.isArray(regulars) ? regulars : [])) {
    const name = typeof r === 'string' ? r : r?.name;
    const visits = (r && typeof r === 'object') ? Number(r.visits ?? r.count ?? 0) || 0 : 0;
    const key = norm(name);
    if (!key || seen.has(key) || !hot.has(key)) continue;
    seen.add(key);
    out.push({ venue: name, visits, message: `${name} is trending — a spot you helped build` });
  }

  return out.sort((a, b) => b.visits - a.visits);
}
