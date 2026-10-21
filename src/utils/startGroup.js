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
 * Group events under one header per time bucket, buckets in time order
 * (Tonight → Tomorrow → This week …), undated events last with no header.
 *
 * Within a bucket the incoming order is kept, so a ranked feed (e.g. the guest
 * "most exciting first" order) still ranks inside each group. Earlier this only
 * added a header where the bucket changed, assuming a date-sorted list. A ranked
 * list interleaves buckets, so the feed showed "Next week / Later this month /
 * Next week …" dozens of times, every header sharing one React key.
 */
export function insertStartHeaders(events, now = Date.now()) {
  const list = (Array.isArray(events) ? events : []).filter(Boolean);
  if (list.length < 2) return list; // headers on a 1-item list are noise
  const groups = new Map(BUCKETS.map(b => [b.key, []]));
  const undated = [];
  for (const e of list) {
    const g = startGroup(e, now);
    if (g) groups.get(g.key).push(e); else undated.push(e);
  }
  const out = [];
  for (const b of BUCKETS) {
    const items = groups.get(b.key);
    if (!items.length) continue;
    out.push({ _header: b.label, id: `hdr-${b.key}` });
    out.push(...items);
  }
  return out.concat(undated);
}

export default { startGroup, insertStartHeaders };
