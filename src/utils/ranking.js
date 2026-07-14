/**
 * ranking — how the feed decides what you see, and why.
 *
 * This is the anti-engagement ranker. Social feeds rank by ATTENTION (likes,
 * comments, time-on-post) and end up promoting outrage and fakery. The Gruvs is
 * a real-time discovery UTILITY, so it ranks by the only things that matter when
 * you're deciding where to go tonight:
 *
 *   1. IS IT ON SOON?          an amazing party next month is useless right now
 *   2. IS IT NEAR ME?          40km away is a different city's problem
 *   3. IS IT ACTUALLY REAL?    verified presence (Touch Downs) beats promises
 *
 * Likes are deliberately NOT an input. A host can buy likes; they cannot buy
 * people physically standing in a room.
 *
 * Pure + deterministic (takes `now`), so the feed order is testable.
 */
import { eventInstant } from './tz';

const HOUR = 3600000;
const DAY = 86400000;

/** Great-circle distance in km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * IMMINENCE — the dominant signal. The Gruvs answers "what's on TONIGHT", so a
 * night starting in 3 hours must outrank a bigger one three weeks out.
 * Peaks while an event is live, stays high for tonight, decays over days.
 */
export function imminenceScore(event, now = Date.now()) {
  const start = eventInstant(event);
  if (start == null) return 0;
  const ms = start - now;

  // Already started: still live for ~6h (or until end_date), then worthless.
  if (ms <= 0) {
    const ranFor = -ms;
    if (ranFor < 6 * HOUR) return 1;      // LIVE NOW — the most useful thing we can show
    return 0;                              // over
  }
  if (ms < 6 * HOUR) return 0.95;          // starting within hours
  if (ms < DAY) return 0.8;                // tonight / tomorrow
  if (ms < 3 * DAY) return 0.55;
  if (ms < 7 * DAY) return 0.35;
  if (ms < 30 * DAY) return 0.15;
  return 0.05;                             // far future: real, but not now
}

/**
 * PROXIMITY — a SOFT weight, never a hard filter.
 * Deliberate: hard-filtering by distance hides small scenes and isolates people,
 * and visibility is a safety property here. A far event still shows, just lower.
 */
export function proximityScore(event, user) {
  const d = distanceKm(user?.lat, user?.lon, event?.lat, event?.lon);
  if (d == null) return 0.5;               // unknown → neutral, never penalised
  if (d <= 2) return 1;
  if (d <= 5) return 0.85;
  if (d <= 15) return 0.65;
  if (d <= 40) return 0.4;
  if (d <= 120) return 0.2;
  return 0.08;
}

/**
 * HONEST HEAT — verified presence only.
 *
 * Touch Downs are people who physically showed up: unbuyable, unfakeable.
 * RSVPs count for a little (intent is weak evidence). Likes count for NOTHING.
 * Decays with age so last month's big night stops crowding out tonight.
 */
export function heatScore(event, now = Date.now()) {
  const touchdowns = Number(event?.checkin_count ?? event?.touchdowns ?? 0) || 0;
  const rsvps = Number(event?.going ?? event?.rsvp_count ?? 0) || 0;

  // log so one huge event can't dominate the whole feed forever
  const presence = Math.log10(1 + touchdowns) / Math.log10(1 + 200);   // ~1.0 at 200 people
  const intent = Math.log10(1 + rsvps) / Math.log10(1 + 500);          // weaker ceiling

  const raw = Math.min(1, presence * 0.8 + intent * 0.2);

  // Age decay — heat is about NOW.
  const start = eventInstant(event);
  if (start == null) return raw;
  const ageDays = Math.max(0, (now - start) / DAY);
  const decay = ageDays <= 0 ? 1 : Math.exp(-ageDays / 3); // half-life ~2 days
  return raw * decay;
}

/**
 * HOST RELIABILITY — 0..1, neutral (0.5) when unknown.
 * A brand-new host is NOT penalised: they're given the benefit of the doubt, or
 * nobody could ever start. It only moves once there's evidence either way.
 */
export function reliabilityScore(event) {
  const r = event?.host_reliability;
  if (typeof r !== 'number' || !Number.isFinite(r)) return 0.5;
  return Math.max(0, Math.min(1, r));
}

/**
 * The feed score. Imminence dominates — this is a "what's on tonight" utility,
 * not a magazine.
 */
export function scoreEvent(event, { user, now = Date.now(), newHostBoost = true } = {}) {
  const imminence = imminenceScore(event, now);
  if (imminence === 0) return 0;                       // over — never rank it

  const proximity = proximityScore(event, user);
  const heat = heatScore(event, now);
  const reliability = reliabilityScore(event);

  let score =
    imminence * 0.45 +
    proximity * 0.25 +
    heat * 0.20 +
    reliability * 0.10;

  // A first-time host's event would otherwise never be seen — no heat, no
  // history, so no ranking, so no attendance, so no heat. That loop has to be
  // broken deliberately or the platform can never grow a new host.
  if (newHostBoost && (event?.host_event_count ?? 0) === 0) {
    score = Math.max(score, imminence * 0.5);
  }
  return score;
}

/**
 * Rank a feed.
 *
 * ANTI-MONOPOLY: one prolific host cannot own the feed. After a host's first two
 * events, their further events are pushed down — so a promoter posting 20 nights
 * can't bury every other scene in the city.
 */
export function rankFeed(events, { user, now = Date.now(), maxPerHost = 2 } = {}) {
  const scored = (events || [])
    .filter(Boolean)
    .map((e) => ({ e, s: scoreEvent(e, { user, now }) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const seen = new Map();
  const out = [];
  const overflow = [];
  for (const { e } of scored) {
    const host = e.author_id || 'unknown';
    const n = seen.get(host) || 0;
    if (n < maxPerHost) {
      seen.set(host, n + 1);
      out.push(e);
    } else {
      overflow.push(e);                    // demoted, never deleted
    }
  }
  return [...out, ...overflow];
}

/**
 * COLD START — a brand-new user with no follows and no history.
 * No personalisation needed: what's near, what's soon, who's reliable. Makes the
 * empty state genuinely useful instead of a blank wall.
 */
export function coldStartFeed(events, { user, now = Date.now() } = {}) {
  return rankFeed(events, { user, now, maxPerHost: 1 });
}

export default {
  distanceKm, imminenceScore, proximityScore, heatScore, reliabilityScore,
  scoreEvent, rankFeed, coldStartFeed,
};
