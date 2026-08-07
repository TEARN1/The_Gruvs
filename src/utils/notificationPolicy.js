// ── Notification policy ───────────────────────────────────────────────────────
// Signal over noise (#185/#191). Decides whether a notification should INTERRUPT
// (OS/browser notification or push) vs sit quietly in the bell. Respects quiet
// hours and priority, so a 4am ping never fires unless it's genuinely urgent.
// In-app delivery (the bell) always happens; this only gates the interruptive
// layer. Pure.

// High = worth waking someone for; Low = never interruptive (vanity).
// 'beacon' is high by design: "I'm out — pull up" is only useful RIGHT NOW,
// and nightlife's quiet hours are exactly when beacons drop. 'call' has to be
// high for the same reason and more so — an unanswered call isn't a missed
// ping, it rings out and dies in ~35s (see CallContext's ringTimerRef), and
// default quiet hours (22:00-08:00) are exactly when most calls on a
// nightlife app will happen.
const HIGH = new Set(['message', 'event_day', 'crew_out', 'waitlist', 'sport_goal', 'sport_result', 'now_playing', 'beacon', 'call']);
const LOW  = new Set(['profile_view', 'view', 'reel_view']);

export function notificationPriority(type) {
  if (HIGH.has(type)) return 'high';
  if (LOW.has(type)) return 'low';
  return 'normal';
}

// Quiet hours default 22:00–08:00 local. prefs: { quietEnabled, quietStart, quietEnd }
export function isQuietHours(date = new Date(), prefs = {}) {
  if (prefs.quietEnabled === false) return false;
  const start = Number.isFinite(prefs.quietStart) ? prefs.quietStart : 22;
  const end   = Number.isFinite(prefs.quietEnd)   ? prefs.quietEnd   : 8;
  const h = date instanceof Date ? date.getHours() : new Date(date).getHours();
  // start<end = same-day window; start>end = wraps midnight (the usual case)
  return start < end ? (h >= start && h < end) : (h >= start || h < end);
}

// Should this notification interrupt the user RIGHT NOW?
export function shouldInterrupt(type, date = new Date(), prefs = {}) {
  const pri = notificationPriority(type);
  if (pri === 'low') return false;                       // vanity never interrupts
  if (isQuietHours(date, prefs)) return pri === 'high';  // quiet hours: only urgent
  return true;                                            // normal hours: normal + high
}
