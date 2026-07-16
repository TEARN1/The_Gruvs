/**
 * eventGuard — catch the obviously-wrong event before it publishes.
 *
 * Deterministic sanity checks. No AI, no moderation queue, no judgement about
 * taste. It only catches things that are objectively broken or objectively
 * dangerous:
 *
 *   • a date in the past                (typo — nobody can attend)
 *   • a price 50x the local norm        ("R25000" is a fat finger, not a party)
 *   • a pin 500km from the stated city  (geocoder grabbed the wrong "Springfield")
 *   • an under-18 event at a nightclub  (the one legal hard gate)
 *
 * DESIGN RULE: this WARNS, it does not BLOCK — except for the age gate, which is
 * a legal line. A false positive that silences a real host is worse than a typo
 * that gets published, because the host never comes back. Every check returns a
 * reason the host can read and dismiss.
 */
import { distanceKm } from './geo';
import { zonedTimeToUtc } from './tz';

export const SEVERITY = { BLOCK: 'block', WARN: 'warn' };

// Rough sanity ceilings by category, in the event's own currency. These are not
// price policing — they're 10-50x above a normal ticket, so only typos trip them.
const PRICE_CEILING = {
  nightlife: 5000,
  music: 20000,     // stadium tours are genuinely expensive
  sport: 20000,
  festival: 20000,
  comedy: 5000,
  art: 5000,
  food: 5000,
  default: 20000,
};

/**
 * @param {object} event  { title, event_date, event_time, timezone, price, lat, lon, city, category, age_min }
 * @param {object} [ctx]  { cityLat, cityLon, now }
 * @returns {Array<{ code, severity, message }>}  empty = clean
 */
export function checkEvent(event, ctx = {}) {
  const issues = [];
  if (!event) return issues;
  const now = ctx.now ?? Date.now();

  // ── A date in the past. Nobody can attend it; it's a typo every time.
  const start = zonedTimeToUtc(event.event_date, event.event_time, event.timezone);
  if (start != null && start < now - 60 * 60 * 1000) {
    issues.push({
      code: 'past_date',
      severity: SEVERITY.WARN,
      message: 'This date has already passed — did you mean a future date?',
    });
  }

  // ── Absurd price. Almost always a missing decimal or an extra zero.
  const price = Number(event.price);
  if (Number.isFinite(price) && price > 0) {
    const ceiling = PRICE_CEILING[event.category] ?? PRICE_CEILING.default;
    if (price > ceiling) {
      issues.push({
        code: 'price_outlier',
        severity: SEVERITY.WARN,
        message: `${price} looks unusually high for this kind of event — is that right?`,
      });
    }
  }

  // ── The pin is nowhere near the city the host typed. The geocoder picked the
  //    wrong match (there are 30+ "Springfield"s), and people will drive to the
  //    wrong province.
  if (Number.isFinite(ctx.cityLat) && Number.isFinite(ctx.cityLon) &&
      Number.isFinite(event.lat) && Number.isFinite(event.lon)) {
    const d = distanceKm(event.lat, event.lon, ctx.cityLat, ctx.cityLon);
    if (d != null && d > 150) {
      issues.push({
        code: 'pin_far_from_city',
        severity: SEVERITY.WARN,
        message: `The map pin is about ${Math.round(d)}km from ${event.city} — check the location.`,
      });
    }
  }

  // ── AGE: the one legal hard gate. An alcohol/nightlife event cannot admit
  //    minors. This is the single check that BLOCKS, because it is the law and
  //    not a matter of judgement.
  const ageMin = Number(event.age_min ?? event.ageMin ?? 0);
  const isNightlife = event.category === 'nightlife' || /\b(club|bar|rave|party)\b/i.test(event.title || '');
  if (isNightlife && ageMin > 0 && ageMin < 18) {
    issues.push({
      code: 'underage_nightlife',
      severity: SEVERITY.BLOCK,
      message: 'A nightlife event cannot set a minimum age under 18.',
    });
  }

  return issues;
}

/** True if anything returned is a hard block. */
export const hasBlocker = (issues) => (issues || []).some((i) => i.severity === SEVERITY.BLOCK);

/**
 * TOUR ROUTE SANITY — pure arithmetic on the stops the host just typed.
 * Two stops 1,400km apart on back-to-back nights is a typo, not a tour; so is
 * the same date twice.
 */
export function checkTourStops(stops) {
  const issues = [];
  const valid = (stops || []).filter((s) => s?.date instanceof Date && !isNaN(s.date));

  // Same date twice — the host duplicated a row and forgot to change it.
  const byDate = new Map();
  for (const s of valid) {
    const key = s.date.toDateString();
    if (byDate.has(key)) {
      issues.push({
        code: 'duplicate_stop_date',
        severity: SEVERITY.WARN,
        message: `Two stops are both on ${key} — is that intentional?`,
      });
    }
    byDate.set(key, s);
  }

  // Impossible travel between consecutive stops.
  const sorted = [...valid].sort((a, b) => a.date - b.date);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    const km = distanceKm(a.lat, a.lon, b.lat, b.lon);
    if (km == null) continue;
    const days = Math.max(0, Math.round((b.date - a.date) / 86400000));
    if (days <= 1 && km > 800) {
      issues.push({
        code: 'impossible_travel',
        severity: SEVERITY.WARN,
        message: `${Math.round(km)}km between stops with ${days === 0 ? 'no' : 'one'} day in between — double-check these dates.`,
      });
    }
  }
  return issues;
}

export default { checkEvent, checkTourStops, hasBlocker, SEVERITY };
