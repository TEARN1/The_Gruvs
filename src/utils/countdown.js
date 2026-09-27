/**
 * countdown — how long until a Gruv starts, in words a human would use.
 *
 * Hosts and Vibers should never have to work out "is that this weekend?" from a
 * raw date. This turns (event_date, event_time) into the same phrasing people
 * already use: "Tonight", "Tomorrow", "In 3 days", "Live now", "Ended".
 *
 * Pure + deterministic (takes `now`), so it is fully testable and has no timers.
 * Callers that want a live-ticking display re-render on an interval; the moment
 * an event is more than an hour away, day-granularity is all that changes, so a
 * 60s tick is plenty.
 */
import { eventInstant, zonedTimeToUtc } from './tz';

/**
 * Combine an event's date + time into a real instant, IN THE VENUE'S TIMEZONE.
 *
 * This used to do `new Date('2026-08-15T21:00')`, which parses in the VIEWER's
 * zone — so a Lagos event viewed from New York counted down six hours wrong, and
 * "Live now" fired at the wrong moment. An event happens where it happens.
 */
export function eventStart(event) {
  if (!event) return null;
  const ms = eventInstant(event);           // honours event.timezone
  return ms == null ? null : new Date(ms);
}

const MIN = 60000, HOUR = 3600000, DAY = 86400000;

/** Whole calendar days between two Dates, ignoring time-of-day. */
function calendarDaysBetween(from, to) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY);
}

/**
 * @param {object} event         needs { event_date, event_time?, end_date? }
 * @param {Date|number} [now]
 * @returns {{ label, days, hours, minutes, ms, state }}
 *   state: 'live' | 'today' | 'tomorrow' | 'soon' | 'future' | 'past'
 *   `days` is CALENDAR days — "tomorrow at 9am" is 1 day, not 0, even at 23:00.
 */
export function countdown(event, now = Date.now()) {
  const start = eventStart(event);
  const nowDt = now instanceof Date ? now : new Date(now);
  if (!start) return { label: '', days: null, hours: null, minutes: null, ms: null, state: 'unknown' };

  const ms = start.getTime() - nowDt.getTime();

  // Still on? Use end_date if given, else assume a night runs ~6h.
  const endsAt = event.end_date && /^\d{4}-\d{2}-\d{2}/.test(String(event.end_date))
    ? (zonedTimeToUtc(event.end_date, '23:59', event.timezone) ?? start.getTime() + 6 * HOUR)
    : start.getTime() + 6 * HOUR;

  if (ms <= 0) {
    if (nowDt.getTime() <= endsAt) return { label: 'Live now', days: 0, hours: 0, minutes: 0, ms, state: 'live' };
    return { label: 'Ended', days: null, hours: null, minutes: null, ms, state: 'past' };
  }

  const days = calendarDaysBetween(nowDt, start);
  const hours = Math.floor(ms / HOUR);
  const minutes = Math.floor((ms % HOUR) / MIN);

  let label;
  if (ms < HOUR) label = minutes <= 1 ? 'Starting now' : `In ${minutes} min`;
  else if (days === 0) label = hours <= 1 ? 'Within the hour' : `Tonight — in ${hours}h`;
  else if (days === 1) label = 'Tomorrow';
  else if (days <= 6) label = `In ${days} days`;
  else if (days === 7) label = 'In a week';
  else if (days < 14) label = `In ${days} days`;
  else if (days < 60) {
    const weeks = Math.round(days / 7);
    label = `In ${weeks} week${weeks === 1 ? '' : 's'}`;
  } else {
    const months = Math.round(days / 30);
    label = `In ${months} month${months === 1 ? '' : 's'}`;
  }

  const state = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days <= 6 ? 'soon' : 'future';
  return { label, days, hours, minutes, ms, state };
}

/** Precise "3d 04h 12m" — for a detail-page hero counter. */
export function countdownParts(event, now = Date.now()) {
  const start = eventStart(event);
  if (!start) return null;
  const ms = start.getTime() - (now instanceof Date ? now.getTime() : now);
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / HOUR),
    minutes: Math.floor((ms % HOUR) / MIN),
    seconds: Math.floor((ms % MIN) / 1000),
  };
}

export default { countdown, countdownParts, eventStart };
