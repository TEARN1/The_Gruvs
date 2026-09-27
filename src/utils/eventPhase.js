// ── Event lifecycle phase engine ──────────────────────────────────────────────
// Single source of truth for which phase a Gruv is in, so business offers, gig
// matching, and contextual ads all agree. Phase keys match the booking/targeting
// keys used across the app: 'pre_event' | 'during_event' | 'post_event'.
//
// Timing (agreed in the product vision):
//   PRE    — from intent until the event starts / you Touch Down.
//            sub-windows: 'days_before' (plan: tickets/outfit/stay) →
//                         'getting_ready' (final ~36h: grooming/pre-drinks/ride)
//   DURING — from event start (or your Touch Down) until it ends.
//   POST   — after it ends / you leave.
//            sub-windows: 'immediate' (leaving now: ride home/food/after-party) →
//                         'next_day' (the photos, recap, reviews, next event)

const DEFAULT_DURATION_HOURS = 4;   // assumed length when no end time is set
const POST_IMMEDIATE_HOURS   = 6;   // "leaving now" window after the event ends
const GETTING_READY_HOURS     = 36; // final stretch = grooming / pre-drinks / ride

// Build the event's start Date from its various date/time shapes.
const eventStart = (event) => {
  if (!event) return null;
  if (event.date_time)  return new Date(event.date_time);
  if (event.event_date) return new Date(`${event.event_date}T${event.event_time || '20:00'}`);
  if (event.date)       return new Date(event.date);
  return null;
};

// Build the event's end Date (explicit end, else start + default duration).
const eventEnd = (event, start) => {
  if (!event || !start) return null;
  if (event.end_date) return new Date(`${event.end_date}T${event.end_time || '23:59'}`);
  if (event.end_time && event.event_date) return new Date(`${event.event_date}T${event.end_time}`);
  return new Date(start.getTime() + DEFAULT_DURATION_HOURS * 3600 * 1000);
};

/**
 * @returns {{ phase: 'pre_event'|'during_event'|'post_event', window: string }}
 * `checkedIn` (a real Touch Down) forces DURING regardless of clock drift,
 * until the post-immediate window closes.
 */
export const getEventPhase = (event, { checkedIn = false, now = Date.now() } = {}) => {
  const start = eventStart(event);
  if (!start || isNaN(start.getTime())) return { phase: 'pre_event', window: 'days_before' };

  const end   = eventEnd(event, start);
  const startMs = start.getTime();
  const endMs   = end.getTime();

  // A confirmed Touch Down means you're IN it, even if the clock disagrees.
  if (checkedIn && now <= endMs + POST_IMMEDIATE_HOURS * 3600 * 1000) {
    return { phase: 'during_event', window: 'live' };
  }

  if (now < startMs) {
    const hoursToStart = (startMs - now) / 3600000;
    return { phase: 'pre_event', window: hoursToStart <= GETTING_READY_HOURS ? 'getting_ready' : 'days_before' };
  }
  if (now <= endMs) {
    return { phase: 'during_event', window: 'live' };
  }
  const hoursSinceEnd = (now - endMs) / 3600000;
  return { phase: 'post_event', window: hoursSinceEnd <= POST_IMMEDIATE_HOURS ? 'immediate' : 'next_day' };
};

// Convenience: just the phase key (back-compat with the old getPhase()).
export const getEventPhaseKey = (event, opts) => getEventPhase(event, opts).phase;

// Human label + accent per phase (used by offer/ad UI).
export const PHASE_META = {
  pre_event:    { label: 'BEFORE THE GRUV', icon: 'clock', color: '#8b5cf6' },
  during_event: { label: 'IN THE GRUV',     icon: 'zap',   color: '#00f2ff' },
  post_event:   { label: 'POST GRUV',       icon: 'star',  color: '#10b981' },
};
