// ── Lineup heat ───────────────────────────────────────────────────────────────
// Rank Gruvs by how HOT they are right now — NOT by personal taste (that's the
// feed's job). Verified presence dominates (the only unfakeable signal), then
// momentum (logged so it can't drown out presence), then imminence. This is the
// leaderboard's ranking. Pure.

export function heatScore(event, now = Date.now()) {
  if (!event) return 0;
  const here = Number(event.here_count ?? event.touchdown_count ?? 0);
  const buzz = (Number(event.vibe_count) || 0) + (Number(event.going) || 0);

  let imminence = 0;
  if (event.event_date) {
    const start = new Date(`${event.event_date}T${event.event_time || '20:00'}`).getTime();
    if (Number.isFinite(start)) {
      const h = (start - now) / 3600000;
      if (h <= -8)        return -Infinity;  // it's over — definitively sink it
      else if (h <= 0)    imminence = 40;    // happening now
      else if (h <= 6)    imminence = 30;    // very soon
      else if (h <= 24)   imminence = 15;    // today / tonight
      else if (h <= 72)   imminence = 6;     // this weekend
    }
  }

  // verified presence dominates; momentum capped by log so it can't drown it out
  return here * 10 + Math.log1p(Math.max(0, buzz)) * 8 + imminence;
}

/**
 * A short, honest heat label for a single card. Leads with VERIFIED presence
 * ("N here now", live) — the only unfakeable signal — and only falls back to
 * intent language ("Filling fast") for strong RSVP counts. Never overclaims;
 * returns null when there's no real signal, so the pill is never a dead zero.
 */
export function heatLabel(event) {
  if (!event) return null;
  const here = Number(event.here_count ?? event.touchdown_count ?? 0);
  if (here > 0) return { text: `${here} here now`, live: true };
  const going = Number(event.going) || 0;
  if (going >= 20) return { text: 'Filling fast', live: false };
  if (going >= 8)  return { text: 'Catching on', live: false };
  return null;
}

/** Rank a list of Gruvs by heat (hottest first); drops finished events. */
export function rankByHeat(events = [], now = Date.now()) {
  return (Array.isArray(events) ? events : [])
    .map((e) => ({ e, heat: heatScore(e, now) }))
    .filter((x) => x.heat > -100) // finished events sunk below this
    .sort((a, b) => b.heat - a.heat)
    .map((x) => x.e);
}
