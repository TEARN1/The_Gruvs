/**
 * attendance — RSVPs lie. Touch Downs don't.
 *
 * Everyone taps "going". Roughly half actually show up. Every events app in the
 * world prints the RSVP number and lets hosts plan security, stock and staff
 * against a fiction. The Gruvs is the only one that can do better, because it
 * has the other half of the equation: who VERIFIABLY walked in.
 *
 *   "42 going  ·  ~26 usually show"
 *
 * That second number is worth more to a host than the first, and it is the whole
 * reason to trust this app over a WhatsApp group.
 *
 * Pure + deterministic. No AI, no service calls.
 */

// With almost no history, a personal rate is noise. Until then, lean on the
// crowd average — and be honest that it's an estimate.
const MIN_HISTORY = 3;
export const DEFAULT_SHOW_RATE = 0.55;   // the industry-wide reality for free RSVPs

/**
 * A person's show-up rate: of the events they said they'd attend, how many did
 * they actually Touch Down at?
 *
 * @param {{rsvps:number, touchdowns:number}} history
 * @returns {{ rate:number, confident:boolean, sample:number }}
 */
export function showUpRate(history) {
  const rsvps = Math.max(0, Number(history?.rsvps) || 0);
  const touchdowns = Math.max(0, Number(history?.touchdowns) || 0);
  if (rsvps < MIN_HISTORY) {
    return { rate: DEFAULT_SHOW_RATE, confident: false, sample: rsvps };
  }
  // Can't show up more often than you said you would.
  const rate = Math.min(1, touchdowns / rsvps);
  return { rate, confident: true, sample: rsvps };
}

/**
 * How many people will REALISTICALLY be in the room.
 *
 * Uses each attendee's own rate where we know it, the crowd default where we
 * don't. "maybe" is worth much less than "going" — that's what "maybe" means.
 *
 * @param {Array<{status:string, rate?:number}>} rsvps
 * @returns {{ expected:number, going:number, maybe:number, confidence:'low'|'medium'|'high' }}
 */
export function expectedTurnout(rsvps) {
  const list = (rsvps || []).filter(Boolean);
  const going = list.filter((r) => r.status === 'going').length;
  const maybe = list.filter((r) => r.status === 'maybe').length;

  let expected = 0;
  let known = 0;
  for (const r of list) {
    if (r.status !== 'going' && r.status !== 'maybe') continue;
    const rate = Number.isFinite(r.rate) ? r.rate : DEFAULT_SHOW_RATE;
    if (Number.isFinite(r.rate)) known++;
    // A "maybe" is a coin-flip on top of their normal reliability.
    expected += r.status === 'going' ? rate : rate * 0.35;
  }

  const total = going + maybe;
  const coverage = total ? known / total : 0;
  const confidence = total < 5 ? 'low' : coverage > 0.6 ? 'high' : 'medium';

  return { expected: Math.round(expected), going, maybe, confidence };
}

/**
 * CAPACITY — the single most valuable thing a discovery app can tell someone is
 * "don't bother, it's full". Judged against EXPECTED turnout, not raw RSVPs,
 * because raw RSVPs would scream "sold out" at a half-empty room.
 *
 * @returns {{ state:'open'|'filling'|'likely_full'|'full', pct:number, label:string }}
 */
export function capacityState(event, expected) {
  const cap = Number(event?.capacity) || 0;
  if (!cap) return { state: 'open', pct: 0, label: '' };

  const arrived = Number(event?.checkin_count ?? event?.touchdowns ?? 0) || 0;
  // Once people are physically arriving, THAT is the truth — stop estimating.
  const basis = arrived > 0 ? arrived : Math.max(0, Number(expected) || 0);
  const pct = Math.min(150, Math.round((basis / cap) * 100));

  if (arrived >= cap) return { state: 'full', pct, label: 'At capacity' };
  if (pct >= 90) return { state: 'likely_full', pct, label: 'Likely full' };
  if (pct >= 70) return { state: 'filling', pct, label: 'Filling up' };
  return { state: 'open', pct, label: '' };
}

/**
 * The honest line under an event: what a host plans against, and what an
 * attendee decides on. Never invents precision it doesn't have.
 */
export function turnoutLabel(event, turnout) {
  const going = turnout?.going ?? 0;
  if (!going) return '';
  const expected = turnout?.expected ?? 0;
  // Don't state an estimate we have no basis for.
  if (turnout?.confidence === 'low') return `${going} going`;
  return `${going} going · ~${expected} usually show`;
}

export default { showUpRate, expectedTurnout, capacityState, turnoutLabel, DEFAULT_SHOW_RATE };
