/**
 * eventKey — canonical identity for a venue and for an event.
 *
 * Two problems, one root: the same real-world thing gets typed a dozen ways.
 *
 *   "Konka" · "KONKA Soweto" · "konka club" · "Konka, Soweto"   → one venue
 *   the same night posted by the promoter, the venue AND a fan  → one event
 *
 * The moment hosts start importing from WhatsApp, duplicates arrive in bulk and
 * the feed fills with triplicates of the same party. Splitting a crowd across
 * three cards is worse than showing none: the RSVP counts all look dead.
 *
 * Deterministic, pure, no AI. Same input → same key, always.
 */

// Words that carry no identity — they're decoration on a venue name.
const VENUE_NOISE = /\b(the|at|club|lounge|bar|pub|venue|hall|centre|center|rooftop|restaurant|cafe|hotel|events?|spot|place)\b/g;

// Strip accents so "Café" and "Cafe" are the same venue.
const deaccent = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * A stable key for a venue. Lowercase, de-accented, noise-words and punctuation
 * removed, tokens sorted — so word order can't create a second venue.
 *
 *   "KONKA Soweto"  → "konka soweto"
 *   "Konka, Soweto" → "konka soweto"
 *   "The Konka"     → "konka"
 */
export function venueKey(venue, city) {
  const raw = [venue, city].filter(Boolean).join(' ');
  const cleaned = deaccent(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(VENUE_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  // Sort tokens: "soweto konka" and "konka soweto" are the same place.
  return [...new Set(cleaned.split(' '))].sort().join(' ');
}

/** Title reduced to its identity — drops filler a promoter varies between posts. */
export function titleKey(title) {
  const TITLE_NOISE = /\b(the|a|an|live|official|presents?|feat(?:uring)?|with|and|vol|edition|part|x)\b/g;
  const t = deaccent(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(TITLE_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

/**
 * Fingerprint of an event: WHAT, WHERE, WHEN.
 *
 * Date is deliberately part of the key — the same party on two different nights
 * is two events, not a duplicate. Time is NOT: hosts routinely post "21:00" and
 * "9pm" and "doors 20:30" for the same night.
 */
export function eventFingerprint(event) {
  if (!event) return '';
  const d = String(event.event_date || '').slice(0, 10);
  const v = venueKey(event.address || event.venue, event.city);
  const t = titleKey(event.title);
  if (!d || (!v && !t)) return '';
  return `${d}|${v}|${t}`;
}

// Jaccard overlap of word sets — 1.0 identical, 0 nothing shared.
function overlap(a, b) {
  const A = new Set(String(a || '').split(' ').filter(Boolean));
  const B = new Set(String(b || '').split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

/**
 * Is `candidate` the same real-world event as `existing`?
 *
 * Exact fingerprints match → certain. Otherwise: same DAY, and the venue and
 * title are each close enough. Two thresholds, because a promoter reposting
 * varies the title ("AMAPIANO SUNSET" vs "Amapiano Sunset vol 2") far more than
 * they vary the venue.
 *
 * @returns {{ duplicate:boolean, confidence:number, reason:string }}
 */
export function isSameEvent(candidate, existing) {
  const none = { duplicate: false, confidence: 0, reason: '' };
  if (!candidate || !existing) return none;

  const dA = String(candidate.event_date || '').slice(0, 10);
  const dB = String(existing.event_date || '').slice(0, 10);
  if (!dA || dA !== dB) return none;              // different night = different event

  const fpA = eventFingerprint(candidate);
  const fpB = eventFingerprint(existing);
  if (fpA && fpA === fpB) {
    return { duplicate: true, confidence: 1, reason: 'same title, venue and date' };
  }

  const vSim = overlap(venueKey(candidate.address || candidate.venue, candidate.city),
                       venueKey(existing.address || existing.venue, existing.city));
  const tSim = overlap(titleKey(candidate.title), titleKey(existing.title));

  // Same venue + a recognisable title → almost certainly a repost.
  if (vSim >= 0.6 && tSim >= 0.5) {
    return { duplicate: true, confidence: Math.min(0.95, (vSim + tSim) / 2), reason: 'same venue and night, near-identical title' };
  }
  // Identical title at a differently-typed venue, same night → still a repost.
  if (tSim >= 0.85 && vSim > 0) {
    return { duplicate: true, confidence: 0.8, reason: 'same title and night' };
  }
  return none;
}

/**
 * Find an existing event that `candidate` duplicates. Returns the strongest
 * match, or null. Callers offer "this looks like X's event — join it instead of
 * reposting?" — we NEVER block a post on it, because a false positive that
 * silences a real host is far worse than a duplicate card.
 */
export function findDuplicate(candidate, events) {
  let best = null;
  for (const e of events || []) {
    if (!e || e.id === candidate?.id) continue;
    const r = isSameEvent(candidate, e);
    if (r.duplicate && (!best || r.confidence > best.confidence)) {
      best = { event: e, ...r };
    }
  }
  return best;
}

export default { venueKey, titleKey, eventFingerprint, isSameEvent, findDuplicate };
