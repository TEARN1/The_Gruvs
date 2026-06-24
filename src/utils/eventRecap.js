// ── Event recap ───────────────────────────────────────────────────────────────
// Post-event truth: the gap between who SAID they'd come (intent / RSVP) and who
// actually showed (verified Touch Down). The Truth Protocol, retrospective — the
// number organizers can't spin and the signal that feeds reputation. Pure.

export function buildEventRecap({ rsvpd = 0, showed = 0, vibes = 0 } = {}) {
  const r = Math.max(0, Number(rsvpd) || 0);
  const s = Math.max(0, Number(showed) || 0);
  const v = Math.max(0, Number(vibes) || 0);

  const showRate = r > 0 ? Math.round((s / r) * 100) : null; // only meaningful with RSVPs
  const noShows  = r > s ? r - s : 0;
  const overflow = s > r ? s - r : 0; // showed up without ever RSVPing

  let verdict, tone;
  if (s === 0) {
    verdict = 'No verified turnout'; tone = 'none';
  } else if (showRate != null && showRate >= 80) {
    verdict = 'Delivered — the room was real'; tone = 'real';
  } else if (showRate != null && showRate >= 50) {
    verdict = 'Solid turnout'; tone = 'solid';
  } else if (showRate != null && showRate < 50 && r >= 5) {
    verdict = 'Hype outran reality'; tone = 'soft';
  } else {
    verdict = `${s} showed up`; tone = 'solid';
  }

  return { rsvpd: r, showed: s, vibes: v, showRate, noShows, overflow, verdict, tone };
}
