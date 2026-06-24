// ── Share text ──────────────────────────────────────────────────────────────
// Build the share/invite message for a Gruv. The Truth Protocol travels with
// every share: REAL signals only, verified presence first (the unfakeable one),
// then intent, then price — never organizer spin. Pure.

const APP_URL = 'https://thegruvs.app';

export function buildShareText(event = {}, opts = {}) {
  const e = event || {};
  const lines = [`🎉 "${e.title || 'A Gruv'}" on The Gruvs`];

  if (e.event_date) {
    try {
      const d = new Date(`${e.event_date}T00:00:00`).toLocaleDateString(
        opts.locale || 'en-ZA',
        { weekday: 'short', day: 'numeric', month: 'short' },
      );
      if (d && d !== 'Invalid Date') lines.push(`📅 ${d}${e.event_time ? ` · ${e.event_time}` : ''}`);
    } catch { /* skip unparseable date */ }
  }

  const venue = e.venue_name || e.city || '';
  if (venue) lines.push(`📍 ${venue}`);

  if (e.price === 0 || e.price === 'FREE' || !e.price) lines.push('🆓 FREE entry');

  // social proof — verified presence leads, then intent (hype never leads)
  const here  = Number(e.here_count ?? e.touchdown_count ?? 0);
  const going = Number(e.going) || 0;
  const proof = [];
  if (here > 0)  proof.push(`🔥 ${here} already there`);
  if (going > 0) proof.push(`✅ ${going} locked in`);
  if (proof.length) lines.push(proof.join('  ·  '));

  const url = e.id != null ? `${APP_URL}?event=${e.id}` : APP_URL;
  lines.push(`\nDownload The Gruvs 👉 ${url}`);

  return lines.join('\n');
}
