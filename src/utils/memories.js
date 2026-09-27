// ── Memories ("on this day") ──────────────────────────────────────────────────
// Resurface REAL moments from a Viber's Touch Down history — anniversaries of
// nights they actually lived. Only true memories (you were really there), never
// fabricated. Pure.
//
//   touchDowns: [{ title?, venue_name?, city?, checked_in_at }]
//
// Returns memories whose month+day match today, from a PREVIOUS year, soonest
// (fewest years ago) first.

export function findMemories(touchDowns = [], now = Date.now()) {
  const today = new Date(now);
  const m = today.getMonth();
  const d = today.getDate();
  const y = today.getFullYear();

  const out = [];
  for (const td of Array.isArray(touchDowns) ? touchDowns : []) {
    if (!td || !td.checked_in_at) continue;
    const t = new Date(td.checked_in_at);
    if (isNaN(t.getTime())) continue;
    if (t.getMonth() === m && t.getDate() === d && t.getFullYear() < y) {
      const yearsAgo = y - t.getFullYear();
      out.push({
        yearsAgo,
        when: `${yearsAgo} year${yearsAgo !== 1 ? 's' : ''} ago today`,
        title: (typeof td.title === 'string' && td.title.trim()) || td.venue_name || 'a Gruv',
        venue: td.venue_name || null,
        city: td.city || null,
        date: t.toISOString(),
      });
    }
  }
  return out.sort((a, b) => a.yearsAgo - b.yearsAgo);
}
