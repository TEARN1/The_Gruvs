/**
 * hostScore — the Truth Score. Does a host deliver what they promise?
 *
 * This is the one thing WhatsApp, Facebook Events and every ticketing site
 * structurally CANNOT build, because none of them have verified presence. The
 * Gruvs knows what a host advertised AND what actually happened (via Touch
 * Downs), so the gap between the two is a number — and that number is the reason
 * to trust a stranger's event.
 *
 *   "Starts on time · 8 events · 4-in-a-row delivered"
 *
 * Pure + deterministic. Feeds ranking.reliabilityScore (which was hardcoded to
 * neutral until now). No AI.
 *
 * DESIGN RULES
 *  • EARNED, never bought. Every input is behaviour, not payment.
 *  • A new host is NEUTRAL (0.5), never punished — no history is not bad history,
 *    and punishing it would make it impossible to ever become a trusted host.
 *  • Honesty is rewarded over perfection: a host who CANCELS EARLY keeps their
 *    score; a no-show is what costs.
 *  • Recent behaviour matters more than ancient history (a host can reform).
 */

const NEUTRAL = 0.5;

// How well one past event matched its promise. 0..1, or null if we can't tell.
function eventTruth(ev) {
  if (!ev) return null;

  // A cancellation is judged on HONESTY, not on the fact of cancelling.
  if (ev.status === 'cancelled' || ev.cancelled_at) {
    const noticeH = Number(ev.cancel_notice_hours);
    if (Number.isFinite(noticeH)) {
      if (noticeH >= 24) return 0.8;   // cancelled with real notice — that's fair
      if (noticeH >= 3) return 0.45;   // late, but they told people
      return 0.1;                       // day-of / no-show — this is what costs
    }
    return 0.3;                         // cancelled, notice unknown
  }

  const signals = [];

  // Did it start on time? (first Touch Down vs advertised start)
  if (Number.isFinite(ev.start_delay_min)) {
    const d = ev.start_delay_min;
    // A little late is normal nightlife; an hour+ is a broken promise.
    signals.push(d <= 15 ? 1 : d <= 45 ? 0.6 : d <= 90 ? 0.3 : 0.1);
  }

  // Did the crowd show? (Touch Downs vs RSVPs) — only meaningful with real RSVPs.
  const rsvps = Number(ev.rsvp_count) || 0;
  const arrived = Number(ev.checkin_count) || 0;
  if (rsvps >= 5) {
    const ratio = arrived / rsvps;
    // We're not asking for 100% — a healthy show rate is ~0.5. Reward >=0.5,
    // and don't over-punish a low turnout (that's partly the crowd, not the host).
    signals.push(Math.max(0.2, Math.min(1, ratio / 0.6)));
  } else if (arrived > 0) {
    signals.push(0.7);                  // people showed up; weak-but-positive
  }

  // Did the event actually happen at all? (any verified presence)
  if (arrived === 0 && ev.is_past) {
    signals.push(0.25);                 // advertised, nobody Touched Down — a ghost
  }

  if (!signals.length) return null;     // not enough to judge — stays neutral
  return signals.reduce((a, b) => a + b, 0) / signals.length;
}

/**
 * A host's reliability from their past events.
 *
 * @param {Array} pastEvents  each: { status, cancelled_at, cancel_notice_hours,
 *                            start_delay_min, rsvp_count, checkin_count, is_past }
 * @returns {{ score:number, confident:boolean, sample:number, delivered:number }}
 */
export function hostReliability(pastEvents) {
  const judged = (pastEvents || [])
    .map((e) => ({ ev: e, t: eventTruth(e) }))
    .filter((x) => x.t != null);

  if (!judged.length) {
    return { score: NEUTRAL, confident: false, sample: 0, delivered: 0 };
  }

  // Recency weighting: the newest event counts most. `judged` is assumed
  // roughly chronological; weight later entries higher.
  let weighted = 0;
  let weight = 0;
  judged.forEach((x, i) => {
    const w = 1 + i * 0.15;            // gentle recency lift
    weighted += x.t * w;
    weight += w;
  });
  const score = Math.max(0, Math.min(1, weighted / weight));

  // "Delivered" = events that scored well — the streak a badge can show.
  const delivered = judged.filter((x) => x.t >= 0.6).length;

  return {
    score,
    confident: judged.length >= 3,      // below this it's a hint, not a verdict
    sample: judged.length,
    delivered,
  };
}

/** Short, honest badge for a host. '' when there isn't enough to say anything. */
export function reliabilityLabel(rel) {
  if (!rel || !rel.confident) return '';
  const pct = Math.round(rel.score * 100);
  if (pct >= 85) return `Reliable host · ${rel.sample} events`;
  if (pct >= 65) return `${rel.delivered}/${rel.sample} delivered as promised`;
  if (pct >= 40) return `${rel.sample} events hosted`;
  return `Mixed track record · ${rel.sample} events`;
}

export default { hostReliability, reliabilityLabel };
