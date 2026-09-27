/**
 * checkinGuard — protect the one metric the whole app rests on.
 *
 * Touch Down means "I am physically here, right now." It's the Truth Protocol's
 * core: crowdsourced REALITY that a promoter can't fake. But the check-in path
 * recorded whatever GPS the client sent, with no proximity check — so anyone
 * could Touch Down at a venue from their couch and inflate a "live" crowd. That
 * quietly turns verified presence back into the spin the app exists to replace.
 *
 * This evaluates whether a check-in is physically plausible. Pure + deterministic.
 *
 * DESIGN, tied to the app's safety principles:
 *  • Visibility is a safety property — we do NOT hard-block on missing data.
 *    No venue coords, or no user coords (permission denied, bad indoor signal),
 *    → 'unverifiable': the Touch Down still counts, just not as VERIFIED.
 *  • Only a check-in we can POSITIVELY place far from the venue is rejected —
 *    that's a real spoof signal, not an absence of one.
 *  • The geofence is generous (festivals, big venues, GPS drift) — the goal is
 *    to stop casual couch check-ins, not to fight a determined attacker who
 *    fakes coordinates at the venue (that's what the `verified` flag downstream,
 *    plus rate limits and pattern detection, are for).
 */
import { distanceKm } from './geo';

// Metres. Generous — a stadium/festival footprint plus GPS wobble.
const AT_VENUE_M = 500;
const NEARBY_M = 2000;    // close enough to be real (parking, queue down the block)

/**
 * @param {{lat,lon}} user    the device's reported location
 * @param {{lat,lon}} venue   the event's location
 * @param {object} [opts]
 * @param {number} [opts.maxMeters]  hard reject beyond this (default NEARBY_M).
 *   Callers pass a looser value on web, where GPS via WiFi/IP is inaccurate.
 * @returns {{ verified:boolean, allow:boolean, distanceM:number|null, reason:string }}
 *   reason: 'at_venue' | 'nearby' | 'too_far' | 'unverifiable'
 */
export function checkinVerdict(user, venue, { maxMeters = NEARBY_M } = {}) {
  const hasUser = Number.isFinite(user?.lat) && Number.isFinite(user?.lon);
  const hasVenue = Number.isFinite(venue?.lat) && Number.isFinite(venue?.lon);

  // Can't verify → don't punish. Counts, but not as verified presence.
  if (!hasUser || !hasVenue) {
    return { verified: false, allow: true, distanceM: null, reason: 'unverifiable' };
  }

  const km = distanceKm(user.lat, user.lon, venue.lat, venue.lon);
  const m = km == null ? null : km * 1000;
  if (m == null) return { verified: false, allow: true, distanceM: null, reason: 'unverifiable' };

  // "Verified presence" is the tight geofence; the allow gate can be looser
  // (web GPS slop) — a check-in can be allowed-but-unverified between the two.
  const rounded = Math.round(m);
  if (m <= AT_VENUE_M) return { verified: true, allow: true, distanceM: rounded, reason: 'at_venue' };
  if (m <= NEARBY_M) return { verified: true, allow: true, distanceM: rounded, reason: 'nearby' };
  if (m <= maxMeters) return { verified: false, allow: true, distanceM: rounded, reason: 'nearby' };

  // Positively placed far from the venue → this is not a real presence.
  return { verified: false, allow: false, distanceM: rounded, reason: 'too_far' };
}

/**
 * Impossible-movement check across a user's recent check-ins. Someone who
 * "Touched Down" in Johannesburg and then Cape Town eight minutes later is
 * spoofing — no human covers 1,200km in the gap.
 *
 * @param {{lat,lon,checked_in_at}} prev   their previous check-in
 * @param {{lat,lon,at}} next               the new one (at = epoch ms)
 * @param {number} maxKmh                   plausible max travel speed
 * @returns {{ plausible:boolean, impliedKmh:number|null }}
 */
export function movementPlausible(prev, next, maxKmh = 900 /* a flight */) {
  if (!prev || !Number.isFinite(prev.lat) || !Number.isFinite(prev.lon)) return { plausible: true, impliedKmh: null };
  if (!Number.isFinite(next?.lat) || !Number.isFinite(next?.lon)) return { plausible: true, impliedKmh: null };
  const prevAt = new Date(prev.checked_in_at).getTime();
  const nextAt = Number.isFinite(next.at) ? next.at : Date.now();
  const hours = (nextAt - prevAt) / 3600000;
  if (!(hours > 0)) return { plausible: true, impliedKmh: null };  // same instant / clock skew — don't judge
  const km = distanceKm(prev.lat, prev.lon, next.lat, next.lon);
  if (km == null) return { plausible: true, impliedKmh: null };
  const kmh = km / hours;
  // Only flag when BOTH the distance is real and the speed is superhuman —
  // two check-ins in the same city minutes apart are fine (kmh looks high on a
  // tiny distance, so require a meaningful hop too).
  if (km < 25) return { plausible: true, impliedKmh: Math.round(kmh) };
  return { plausible: kmh <= maxKmh, impliedKmh: Math.round(kmh) };
}

export default { checkinVerdict, movementPlausible };
