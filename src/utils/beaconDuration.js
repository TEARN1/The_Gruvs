/**
 * beaconDuration.js — how long "Find me" stays on.
 *
 * It used to be a fixed hour. People going out for a weekend, or travelling,
 * asked to stay findable longer — and to know exactly when it stops. The
 * server caps every beacon at 2 days (trg_clamp_beacon_expiry), so nothing
 * here can make someone findable for longer than that.
 */
export const MAX_BEACON_MINUTES = 48 * 60;

export const BEACON_DURATIONS = [
  { key: '1h', label: '1 hour', minutes: 60 },
  { key: '4h', label: '4 hours', minutes: 240 },
  { key: 'tonight', label: 'Tonight', minutes: null }, // until 06:00
  { key: '1d', label: '1 day', minutes: 24 * 60 },
  { key: '2d', label: '2 days', minutes: MAX_BEACON_MINUTES },
];

/** Minutes for a duration key. "Tonight" runs to the next 06:00 local time. */
export function minutesFor(key, now = new Date()) {
  const opt = BEACON_DURATIONS.find((d) => d.key === key) || BEACON_DURATIONS[0];
  let mins = opt.minutes;
  if (mins == null) {
    const end = new Date(now);
    end.setHours(6, 0, 0, 0);
    if (end <= now) end.setDate(end.getDate() + 1);
    mins = Math.round((end - now) / 60000);
  }
  return Math.max(30, Math.min(MAX_BEACON_MINUTES, mins));
}

/** "45 min", "3h 20m", "1 day 4h" — what is left on a live beacon. */
export function formatRemaining(mins) {
  if (mins == null || !Number.isFinite(mins)) return '';
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) {
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }
  const d = Math.floor(m / (24 * 60)), h = Math.floor((m % (24 * 60)) / 60);
  return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h}h` : ''}`;
}

/** "1 hour", "4 hours", "2 days" — for the "pull up" message to mutuals. */
export function durationLabel(mins) {
  const m = Math.round(mins || 0);
  if (m >= 24 * 60 && m % (24 * 60) === 0) { const d = m / (24 * 60); return `${d} day${d === 1 ? '' : 's'}`; }
  if (m >= 60) { const h = Math.round(m / 60); return `${h} hour${h === 1 ? '' : 's'}`; }
  return `${m} min`;
}

export default BEACON_DURATIONS;
