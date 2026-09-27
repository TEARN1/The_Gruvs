// ── Crew out now ──────────────────────────────────────────────────────────────
// "Who's out RIGHT NOW." Distils your crew's live check-ins into a present-tense
// digest: one row per friend (their latest Touch Down), only within a live window
// (a night out ~ 6h), most-recent first. Verified presence only — never intent,
// never hype. Pure.

const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
const SKEW_MS = 60 * 1000; // tolerate 1m of clock skew on "future" rows

export function summarizeCrewOut(checkins = [], now = Date.now(), windowMs = LIVE_WINDOW_MS) {
  const rows = Array.isArray(checkins) ? checkins : [];
  const latestByUser = new Map();

  for (const c of rows) {
    if (!c || !c.user_id) continue;
    const t = c.checked_in_at ? new Date(c.checked_in_at).getTime() : NaN;
    if (!Number.isFinite(t)) continue;
    if (now - t > windowMs) continue;     // gone home
    if (t > now + SKEW_MS) continue;       // not started / bad clock

    const prev = latestByUser.get(c.user_id);
    if (!prev || t > prev._t) {
      latestByUser.set(c.user_id, {
        userId: c.user_id,
        username: c.username || c.profiles?.username || 'Someone',
        avatar: c.avatar_url || c.profiles?.avatar_url || null,
        eventId: c.event_id || null,
        title: c.title || c.events?.title || null,
        venue: c.venue || c.events?.venue_name || c.events?.title || null,
        _t: t,
      });
    }
  }

  return [...latestByUser.values()]
    .sort((a, b) => b._t - a._t)
    .map(({ _t, ...row }) => row);
}
