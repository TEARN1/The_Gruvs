// ── Heat — THE canonical "how hot is this right now" (F1) ────────────────────
// The app used to have THREE heat definitions (this one, ScoreEngine.heatScore,
// and utils/ranking's heatScore). This is now the only one — ScoreEngine.heatScore
// delegates here, and utils/ranking is retired. Rank Gruvs by how HOT they are
// right now — NOT by personal taste (that's eventScore's job). Verified presence
// dominates (the only unfakeable signal), then momentum (logged so it can't
// drown out presence), then imminence. Pure.

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

  // MOMENTUM (inherited from the trending job): engagement per hour since
  // posting — a new event catching fire beats an old one coasting on volume.
  // Log-capped so velocity can never drown out verified presence.
  let momentum = 0;
  if (event.created_at) {
    const ageH = (now - new Date(event.created_at).getTime()) / 3600000;
    if (Number.isFinite(ageH) && ageH > 0 && ageH < 72) {
      momentum = Math.log1p(Math.min(buzz / Math.max(ageH, 0.5), 50)) * 6;
    }
  }

  // verified presence dominates; momentum capped by log so it can't drown it out
  return here * 10 + Math.log1p(Math.max(0, buzz)) * 8 + momentum + imminence;
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
