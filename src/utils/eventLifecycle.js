/**
 * eventLifecycle — where an event is in time, and what to do about it.
 *
 * Two problems this solves:
 *  • The feed shows events that already happened, because nothing "closes" them.
 *    A discovery utility that surfaces last week's party is broken.
 *  • The app needs ONE honest answer to "is this on now?" — for the countdown,
 *    the live banner, and whether Touch Down should even be offered.
 *
 * Timezone-correct (an event happens in the VENUE's zone, not the viewer's).
 * Pure + deterministic.
 */
import { eventInstant } from './tz';
import { zonedTimeToUtc } from './tz';

const HOUR = 3600000;

// How long after its start an event is assumed to still be running, when it has
// no explicit end. A night runs long; a daytime market does not — but without
// more signal, one honest default beats guessing per-category.
const DEFAULT_RUN_MS = 6 * HOUR;
// After this much past the end, it's not "just ended", it's history.
const RECENT_MS = 12 * HOUR;

/**
 * @returns {'upcoming'|'live'|'recent'|'ended'|'unknown'}
 *   upcoming — hasn't started
 *   live     — happening now
 *   recent   — just ended (still worth a recap / "how was it?")
 *   ended    — history; drop from discovery
 */
export function lifecycleState(event, now = Date.now()) {
  const start = eventInstant(event);
  if (start == null) return 'unknown';

  const end = (event?.end_date && /^\d{4}-\d{2}-\d{2}/.test(String(event.end_date)))
    ? (zonedTimeToUtc(event.end_date, '23:59', event.timezone) ?? start + DEFAULT_RUN_MS)
    : start + DEFAULT_RUN_MS;

  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  if (now <= end + RECENT_MS) return 'recent';
  return 'ended';
}

/** Should this event still appear in discovery feeds? */
export function isDiscoverable(event, now = Date.now()) {
  const s = lifecycleState(event, now);
  return s === 'upcoming' || s === 'live';
}

/** Is the event on right now (drives the LIVE badge and Touch Down)? */
export const isLive = (event, now = Date.now()) => lifecycleState(event, now) === 'live';

/** Just finished — the window where a recap and "how was it?" make sense. */
export const isRecent = (event, now = Date.now()) => lifecycleState(event, now) === 'recent';

/**
 * Which events a background sweep should mark closed. Pure — returns the ids to
 * update; the caller does the write. Never touches an already-closed row.
 */
export function eventsToClose(events, now = Date.now()) {
  return (events || [])
    .filter((e) => e && e.status !== 'ended' && e.status !== 'cancelled')
    .filter((e) => lifecycleState(e, now) === 'ended')
    .map((e) => e.id)
    .filter(Boolean);
}

export default { lifecycleState, isDiscoverable, isLive, isRecent, eventsToClose };
