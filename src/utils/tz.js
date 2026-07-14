/**
 * tz — an event happens at a PLACE, in that place's time.
 *
 * events.event_date is a bare date and events.event_time is bare text ("21:00").
 * On their own they carry no zone, so `new Date('2026-08-15T21:00')` is parsed in
 * whoever is LOOKING — a Lagos event viewed from New York was six hours wrong.
 * Countdowns, "Live now" and "Tonight" all silently lied across borders.
 *
 * events.timezone now stores the venue's IANA zone. These helpers turn
 * (date, time, zone) into a true instant, and back — using only Intl, so there
 * is no dependency, no data file, and no paid timezone API.
 */

/** The device's own IANA zone, e.g. "Africa/Johannesburg". */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg';
  } catch {
    return 'Africa/Johannesburg';
  }
}

/** True if the runtime actually supports this zone (bad strings must not throw). */
export function isValidZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const DTF_CACHE = new Map();
function formatterFor(tz) {
  let f = DTF_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    DTF_CACHE.set(tz, f);
  }
  return f;
}

/** What a given UTC instant reads as, on the wall clock in `tz`. */
function wallClockInZone(instantMs, tz) {
  const parts = formatterFor(tz).formatToParts(new Date(instantMs));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  // Intl renders midnight as hour 24 in some engines — normalise.
  const hour = get('hour') % 24;
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
}

/**
 * Turn a LOCAL wall-clock time in `tz` into the true UTC instant.
 *
 * There is no direct Intl API for this, so we invert it: guess that the local
 * time is UTC, measure how far off that guess reads in the target zone, and
 * correct. Twice — the second pass fixes the edge case where the first guess
 * lands on the other side of a DST boundary.
 *
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} timeStr 'HH:MM' (defaults to midnight)
 * @param {string} tz      IANA zone; falls back to the device's
 * @returns {number|null}  epoch ms, or null if unparseable
 */
export function zonedTimeToUtc(dateStr, timeStr, tz) {
  const d = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = /^\d{1,2}:\d{2}/.test(String(timeStr || '')) ? String(timeStr).slice(0, 5) : '00:00';
  const zone = isValidZone(tz) ? tz : deviceTimeZone();

  const [Y, M, D] = d.split('-').map(Number);
  const [h, m] = t.split(':').map(Number);
  const wanted = Date.UTC(Y, M - 1, D, h, m, 0);

  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const reads = wallClockInZone(guess, zone);
    const drift = reads - wanted;
    if (drift === 0) break;
    guess -= drift;
  }
  return guess;
}

/** The venue's local instant for an event row. Null if it has no usable date. */
export function eventInstant(event) {
  if (!event) return null;
  return zonedTimeToUtc(event.event_date, event.event_time, event.timezone);
}

/**
 * True when the viewer is in a different zone from the event — the UI should
 * then say the venue's local time explicitly, or people will show up wrong.
 */
export function isForeignZone(event) {
  const tz = event?.timezone;
  if (!isValidZone(tz)) return false;
  return tz !== deviceTimeZone();
}

/** e.g. "21:00 SAST" — the time as it reads AT THE VENUE. */
export function venueLocalTimeLabel(event) {
  const inst = eventInstant(event);
  if (inst == null) return '';
  const tz = isValidZone(event?.timezone) ? event.timezone : deviceTimeZone();
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
      timeZoneName: 'short',
    }).format(new Date(inst));
  } catch {
    return '';
  }
}

export default { deviceTimeZone, isValidZone, zonedTimeToUtc, eventInstant, isForeignZone, venueLocalTimeLabel };
