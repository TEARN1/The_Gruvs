/**
 * nightPlanner — "where do we continue the fun?" engine.
 *
 * Two jobs, both pure / offline (no AI, no paid maps API — just time + haversine):
 *   1. suggestNextStops()  — when a Gruv is ending, where to go next (after-party
 *                            or a nearby later Gruv) to keep the night going.
 *   2. resolveClashes()    — two Gruvs tonight at the same time? Give a real plan:
 *                            catch BOTH back-to-back if the clock allows, else
 *                            recommend the better one (and say why).
 *   3. buildNightPlan()    — chain the night into an ordered itinerary of stops.
 *
 * Everything is deterministic and unit-tested so the plan is explainable.
 */

// ── Time parsing (mirrors src/utils/eventPhase shapes) ──────────────────────
const DEFAULT_DURATION_MS = 4 * 3600 * 1000;

export function startMs(event) {
  if (!event) return NaN;
  if (event.date_time) return new Date(event.date_time).getTime();
  if (event.event_date) return new Date(`${event.event_date}T${event.event_time || '20:00'}`).getTime();
  if (event.date) return new Date(event.date).getTime();
  return NaN;
}
export function endMs(event) {
  const s = startMs(event);
  if (isNaN(s)) return NaN;
  if (event.end_date) return new Date(`${event.end_date}T${event.end_time || '23:59'}`).getTime();
  if (event.end_time && event.event_date) return new Date(`${event.event_date}T${event.end_time}`).getTime();
  return s + DEFAULT_DURATION_MS;
}

// ── Distance (haversine, km) ────────────────────────────────────────────────
const toRad = (d) => (d * Math.PI) / 180;
export function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v == null || isNaN(v))) return null;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AFTERPARTY_RE = /after[\s-]?party|after[\s-]?move|2nd\s?stop|continue|late night|afters\b/i;
const isAfterpartyish = (e) =>
  AFTERPARTY_RE.test(e?.title || '') || AFTERPARTY_RE.test(e?.description || '') ||
  /night ?life|club|party|lounge/i.test(e?.category || '');

/** Do two events overlap in time? */
export function overlaps(a, b) {
  const aS = startMs(a), aE = endMs(a), bS = startMs(b), bE = endMs(b);
  if ([aS, aE, bS, bE].some(isNaN)) return false;
  return aS < bE && bS < aE;
}

/**
 * Score a candidate as the NEXT stop after `current` ends.
 * @returns {{ event, score:number, distanceKm:(number|null), reasons:string[] }} or null if unsuitable
 */
export function scoreNextStop(current, candidate, { now = Date.now(), userLat, userLon } = {}) {
  if (!candidate || candidate.id === current?.id) return null;
  const curEnd = endMs(current);
  const candStart = startMs(candidate);
  if (isNaN(candStart)) return null;

  // Must be reachable as a "next": starts within [curEnd - 45m, curEnd + 4h],
  // and hasn't already ended.
  const ref = isNaN(curEnd) ? now : curEnd;
  const gapMs = candStart - ref;
  if (endMs(candidate) < now) return null;                 // already over
  if (gapMs < -45 * 60 * 1000 || gapMs > 4 * 3600 * 1000) return null;

  const reasons = [];
  let score = 0;

  // Timing: best when it starts right as the current one winds down.
  const gapMin = Math.abs(gapMs) / 60000;
  const timeScore = Math.max(0, 1 - gapMin / 240); // 0..1 over a 4h window
  score += timeScore * 0.45;
  if (gapMin <= 60) reasons.push('starts right after this one');

  // Distance: closer is better (if we know both points).
  const lat = candidate.lat ?? candidate.latitude;
  const lon = candidate.lon ?? candidate.longitude;
  const distanceKm = haversineKm(userLat, userLon, lat, lon);
  if (distanceKm != null) {
    score += Math.max(0, 1 - distanceKm / 25) * 0.3; // 0..1 over 25km
    if (distanceKm <= 5) reasons.push('close by');
  }

  // Buzz: popular spots keep the night alive.
  const buzz = Number(candidate.vibe_count || candidate.going || 0);
  score += Math.min(1, buzz / 100) * 0.15;
  if (buzz >= 50) reasons.push('buzzing right now');

  // After-party feel.
  if (isAfterpartyish(candidate)) { score += 0.1; reasons.push('after-party vibe'); }

  return { event: candidate, score: Math.round(score * 100) / 100, distanceKm, reasons };
}

/** Ranked next-stop suggestions to continue the night. */
export function suggestNextStops(current, candidates = [], opts = {}, limit = 3) {
  return (candidates || [])
    .map(c => scoreNextStop(current, c, opts))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Two (or more) clashing events tonight → a concrete plan.
 * @returns {{ type:'both'|'pick'|'free', order?:Event[], pick?:Event, alt?:Event, reason:string }}
 */
export function resolveClashes(events = [], { now = Date.now(), userLat, userLon } = {}) {
  const todays = (events || [])
    .filter(e => !isNaN(startMs(e)) && endMs(e) >= now)
    .sort((a, b) => startMs(a) - startMs(b));

  if (todays.length < 2) return { type: 'free', reason: 'No clashes — your night is wide open.' };

  const [a, b] = todays;
  if (!overlaps(a, b)) {
    return { type: 'both', order: [a, b], reason: 'Both fit — hit the first, then roll to the second.' };
  }

  // They overlap. Can you still catch the tail of one then the start of the other?
  // (the later-starting one begins before the earlier ends, but you can leave early)
  const aEnd = endMs(a), bStart = startMs(b);
  if (bStart >= aEnd - 60 * 60 * 1000) {
    return { type: 'both', order: [a, b], reason: 'Tight but doable — duck out of the first an hour in and catch the second.' };
  }

  // True clash → recommend the stronger pick.
  const rank = (e) => {
    let s = Number(e.vibe_count || e.going || 0) / 100;
    const lat = e.lat ?? e.latitude, lon = e.lon ?? e.longitude;
    const d = haversineKm(userLat, userLon, lat, lon);
    if (d != null) s += Math.max(0, 1 - d / 25);
    return s;
  };
  const pick = rank(a) >= rank(b) ? a : b;
  const alt = pick === a ? b : a;
  const closer = haversineKm(userLat, userLon, pick.lat ?? pick.latitude, pick.lon ?? pick.longitude);
  const why = [];
  if (Number(pick.vibe_count || pick.going || 0) > Number(alt.vibe_count || alt.going || 0)) why.push('more people going');
  if (closer != null && closer <= 10) why.push('closer to you');
  return {
    type: 'pick',
    pick,
    alt,
    reason: why.length ? `Go with "${pick.title}" — ${why.join(' and ')}.` : `Both clash; "${pick.title}" is the stronger call tonight.`,
  };
}

/** Greedy non-overlapping itinerary for the night (earliest-ending first). */
export function buildNightPlan(events = [], { now = Date.now() } = {}) {
  const upcoming = (events || [])
    .filter(e => !isNaN(startMs(e)) && endMs(e) >= now)
    .sort((a, b) => endMs(a) - endMs(b));
  const stops = [];
  let lastEnd = -Infinity;
  for (const e of upcoming) {
    if (startMs(e) >= lastEnd) { stops.push(e); lastEnd = endMs(e); }
  }
  return stops.sort((a, b) => startMs(a) - startMs(b));
}

export default { suggestNextStops, scoreNextStop, resolveClashes, buildNightPlan, overlaps, haversineKm, startMs, endMs };
