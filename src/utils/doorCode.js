/**
 * doorCode — the printable door sign's link (BD_PLAYBOOK §4.5, §5).
 *
 * At a venue door you get one shot: someone scans, lands on THIS event, and
 * Touches Down. Two things have to be true of that URL:
 *
 *  1. It must open the event itself, not a generic install page. A generic link
 *     loses the person and loses the event attribution.
 *  2. It must carry who sent them — the host — so a door signup joins under that
 *     host's lineage instead of appearing from nowhere. Without this you get 100
 *     users and no idea which night produced them.
 *
 * Pure + deterministic so the door link is testable without a browser.
 */
import { eventUrl } from './slug';

/** Where a door scan should land. `ref` is the host's referral code. */
export function doorUrl(event, ref, origin = 'https://thegruvs.com') {
  const base = eventUrl(event, origin);
  const q = [];
  if (ref) q.push(`ref=${encodeURIComponent(ref)}`);
  // Distinguishes a door scan from a WhatsApp forward of the same event, so the
  // scoreboard can tell which nights the printed sign actually worked.
  q.push('src=door');
  return `${base}${base.includes('?') ? '&' : '?'}${q.join('&')}`;
}

/**
 * Pull an inbound referral out of a landing URL. Returns null when there isn't
 * one — a plain visit must never be attributed to anybody.
 */
export function refFromUrl(url) {
  try {
    const qs = String(url || '').split('?')[1];
    if (!qs) return null;
    const params = new URLSearchParams(qs);
    const ref = (params.get('ref') || '').trim();
    // Referral codes are short and alphanumeric; anything else is someone
    // playing with the query string, not a real invite.
    if (!ref || !/^[A-Za-z0-9_-]{4,32}$/.test(ref)) return null;
    return ref;
  } catch { return null; }
}

export default { doorUrl, refFromUrl };
