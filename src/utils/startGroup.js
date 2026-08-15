/**
 * startGroup — "starts in N" grouping for the Upcoming feed (Coming Soon).
 *
 * Upcoming was one flat date-ascending wall; you couldn't see at a glance
 * what's TONIGHT vs next month. This groups events under honest time headers.
 * Pure + deterministic (takes `now`).
 */

const DAY = 86400000;

const startMs = (e) => {
  if (!e?.event_date) return null;
  const t = new Date(`${String(e.event_date).slice(0, 10)}T${e.event_time || '20:00'}:00`).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Ordered buckets. `test` gets (startMs, now, daysAhead). */
const BUCKETS = [
  { key: 'live',     label: 'Live now',          test: (t, now) => t <= now && now - t < 8 * 3600000 },
  { key: 'today',    label: 'Tonight',           test: (t, now, d) => t > now && d === 0 },
  { key: 'tomorrow', label: 'Tomorrow',          test: (t, now, d) => d === 1 },
  { key: 'week',     label: 'This week',         test: (t, now, d) => d >= 2 && d <= 7 },
  { key: 'next',     label: 'Next week',         test: (t, now, d) => d > 7 && d <= 14 },
  { key: 'month',    label: 'Later this month',  test: (t, now, d) => d > 14 && d <= 31 },
  { key: 'later',    label: 'On the horizon',    test: () => true },
];

/** Which bucket an event belongs to; null for undated (grouped last, unlabeled). */
export function startGroup(event, now = Date.now()) {
  const t = startMs(event);
  if (t == null) return null;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(t); startOfDay.setHours(0, 0, 0, 0);
  const daysAhead = Math.round((startOfDay - startOfToday) / DAY);
  return BUCKETS.find(b => b.test(t, now, daysAhead)) || BUCKETS[BUCKETS.length - 1];
}

/**
 * Insert header pseudo-items ({ _header, id }) into a date-ASCENDING event
 * list wherever the bucket changes. Events keep their order; undated events
 * fall at the end under no header. List renderers branch on `_header`.
 *
 * Each bucket emits its header AT MOST ONCE. This previously compared only
 * against the immediately-previous bucket, which silently assumed the input
 * really was sorted ascending. When it isn't, the same bucket recurs
 * non-contiguously (…month, week, month…) and the old code emitted `hdr-month`
 * twice — two React children with the same key, which React warns is
 * "unsupported and could change in a future version" (children duplicated
 * and/or omitted) inside the Upcoming VirtualizedList.
 *
 * That is not hypothetical: collapseTourStops() keeps a tour's survivor at the
 * GROUP's original position while choosing the nearest-upcoming stop as that
 * survivor, so a tour card can sit early in the list carrying a later date and
 * break the ordering. Deduping is behaviour-identical for a correctly sorted
 * list and merely defensive otherwise.
 */
export function insertStartHeaders(events, now = Date.now()) {
  const list = (Array.isArray(events) ? events : []).filter(Boolean);
  if (list.length < 2) return list; // headers on a 1-item list are noise
  const out = [];
  const emitted = new Set();
  for (const e of list) {
    const g = startGroup(e, now);
    if (g && !emitted.has(g.key)) {
      out.push({ _header: g.label, id: `hdr-${g.key}` });
      emitted.add(g.key);
    }
    out.push(e);
  }
  return out;
}

export default { startGroup, insertStartHeaders };
