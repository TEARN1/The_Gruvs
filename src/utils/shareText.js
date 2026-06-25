// ── Share text ──────────────────────────────────────────────────────────────
// Build the share/invite message for a Gruv. The Truth Protocol travels with
// every share: REAL signals only, verified presence first (the unfakeable one),
// then intent, then price — never organizer spin. Pure.
//
// The link points at the live app by default (always works). For RICH previews
// (event cover image in WhatsApp/iMessage) pass opts.ogMetaBase — but only once
// the og-meta edge function is DEPLOYED, otherwise that endpoint 404s. We never
// auto-route to og-meta, to avoid shipping dead share links.
import { APP_WEB_URL } from '../constants/appUrl';

export function eventShareUrl(id, opts = {}) {
  if (id == null) return APP_WEB_URL;
  const og = (opts.ogMetaBase ?? '').replace(/\/$/, '');
  return og ? `${og}/og-meta/event/${id}` : `${APP_WEB_URL}/?event=${id}`;
}

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

  lines.push(`\nTap to see who's going 👉 ${eventShareUrl(e.id, opts)}`);

  return lines.join('\n');
}
