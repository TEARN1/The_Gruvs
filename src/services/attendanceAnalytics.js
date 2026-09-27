/**
 * attendanceAnalytics — the B2B moat: "who really came."
 *
 * Everything here is derived from REAL data (events + live_checkins + going
 * RSVPs) — no estimates, no invented numbers (Truth Protocol + no-fake-data).
 * This is what Meta/Google structurally cannot sell: proof a body showed up.
 *
 * aggregateAttendance() is a pure function (unit-tested); getOwnerAttendance()
 * fetches a business owner's events and rolls them up.
 */
import { supabase } from './supabase';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * @param {{events:Array, checkins:Array, rsvps:Array}} input
 *   events:   [{ id, title, event_date }]
 *   checkins: [{ event_id, user_id, checked_in_at }]
 *   rsvps:    [{ event_id, user_id, status }]  (going only)
 */
export function aggregateAttendance({ events = [], checkins = [], rsvps = [] } = {}) {
  const eventIds = new Set(events.map(e => e.id));
  const ci = checkins.filter(c => eventIds.has(c.event_id));
  const going = rsvps.filter(r => r.status === 'going' && eventIds.has(r.event_id));

  const totalCheckins = ci.length;
  const attendees = new Set(ci.map(c => c.user_id));
  const totalAttendees = attendees.size;
  const totalGoing = going.length;

  // Show-up rate: of people who said "going", how many actually Touched Down.
  // Null when there were no RSVPs (can't compute a rate from nothing).
  const showUpRate = totalGoing > 0 ? Math.round((totalCheckins / totalGoing) * 100) : null;

  // Repeat visitors: users who Touched Down at 2+ of this business's events.
  const eventsPerUser = new Map();
  for (const c of ci) {
    if (!eventsPerUser.has(c.user_id)) eventsPerUser.set(c.user_id, new Set());
    eventsPerUser.get(c.user_id).add(c.event_id);
  }
  const regulars = [];
  let repeatVisitors = 0;
  for (const [user_id, evs] of eventsPerUser) {
    if (evs.size > 1) { repeatVisitors += 1; regulars.push({ user_id, visits: evs.size }); }
  }
  regulars.sort((a, b) => b.visits - a.visits);
  const repeatRate = totalAttendees > 0 ? Math.round((repeatVisitors / totalAttendees) * 100) : 0;

  // Busiest night of the week (by check-in volume).
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const c of ci) {
    const d = new Date(c.checked_in_at);
    if (!isNaN(d.getTime())) dayCounts[d.getDay()] += 1;
  }
  const maxDay = Math.max(...dayCounts);
  const busiestDay = maxDay > 0 ? DOW[dayCounts.indexOf(maxDay)] : null;

  // Per-event breakdown (most-attended first).
  const perEvent = events.map(e => {
    const ec = ci.filter(c => c.event_id === e.id);
    return {
      id: e.id,
      title: e.title,
      event_date: e.event_date,
      attendees: new Set(ec.map(c => c.user_id)).size,
      going: going.filter(r => r.event_id === e.id).length,
    };
  }).sort((a, b) => b.attendees - a.attendees);

  return {
    eventsCount: events.length,
    totalAttendees,
    totalCheckins,
    totalGoing,
    showUpRate,
    repeatVisitors,
    repeatRate,
    busiestDay,
    regulars: regulars.slice(0, 10),
    perEvent: perEvent.slice(0, 12),
  };
}

/** Fetch + aggregate verified attendance for a business owner's own events. */
export async function getOwnerAttendance(userId) {
  if (!userId) return aggregateAttendance({});
  try {
    const { data: events } = await supabase
      .from('events')
      .select('id, title, event_date')
      .eq('author_id', userId)
      .limit(200);
    if (!events?.length) return aggregateAttendance({ events: [] });

    const ids = events.map(e => e.id);
    const [{ data: checkins }, { data: rsvps }] = await Promise.all([
      supabase.from('live_checkins').select('event_id, user_id, checked_in_at').in('event_id', ids).limit(5000),
      supabase.from('event_rsvps').select('event_id, user_id, status').in('event_id', ids).eq('status', 'going').limit(5000),
    ]);
    return aggregateAttendance({ events, checkins: checkins || [], rsvps: rsvps || [] });
  } catch {
    return aggregateAttendance({});
  }
}

export default { aggregateAttendance, getOwnerAttendance };