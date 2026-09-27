/**
 * attendanceAnalytics — the proof-of-who-came aggregation. All real, derived
 * from check-ins; no invented numbers; honest empty/null states.
 */
import { aggregateAttendance } from '../src/services/attendanceAnalytics';

const ev = (id, title, date) => ({ id, title, event_date: date });
const ci = (event_id, user_id, when) => ({ event_id, user_id, checked_in_at: when });

describe('aggregateAttendance', () => {
  it('is all-zero / honest on empty input', () => {
    const a = aggregateAttendance({});
    expect(a.totalAttendees).toBe(0);
    expect(a.totalCheckins).toBe(0);
    expect(a.showUpRate).toBeNull();      // no RSVPs → no rate (not a fake 0%)
    expect(a.busiestDay).toBeNull();
    expect(a.perEvent).toEqual([]);
  });

  it('counts distinct attendees and total Touch Downs', () => {
    const events = [ev('e1', 'Night A', '2026-06-10'), ev('e2', 'Night B', '2026-06-12')];
    const checkins = [
      ci('e1', 'u1', '2026-06-10T22:00:00Z'),
      ci('e1', 'u2', '2026-06-10T22:30:00Z'),
      ci('e2', 'u1', '2026-06-12T23:00:00Z'), // u1 again → repeat visitor
    ];
    const a = aggregateAttendance({ events, checkins, rsvps: [] });
    expect(a.totalCheckins).toBe(3);
    expect(a.totalAttendees).toBe(2);       // u1, u2
    expect(a.repeatVisitors).toBe(1);       // u1 across 2 events
    expect(a.repeatRate).toBe(50);          // 1 of 2
    expect(a.eventsCount).toBe(2);
  });

  it('computes RSVP -> showed-up rate from going RSVPs only', () => {
    const events = [ev('e1', 'A', '2026-06-10')];
    const checkins = [ci('e1', 'u1', '2026-06-10T22:00:00Z'), ci('e1', 'u2', '2026-06-10T22:00:00Z')];
    const rsvps = [
      { event_id: 'e1', user_id: 'u1', status: 'going' },
      { event_id: 'e1', user_id: 'u2', status: 'going' },
      { event_id: 'e1', user_id: 'u3', status: 'going' },
      { event_id: 'e1', user_id: 'u4', status: 'maybe' }, // ignored
    ];
    const a = aggregateAttendance({ events, checkins, rsvps });
    expect(a.totalGoing).toBe(3);
    expect(a.showUpRate).toBe(67);          // 2 of 3 going actually showed
  });

  it('ignores check-ins for events not in the set, and ranks per-event', () => {
    const events = [ev('e1', 'A', '2026-06-10'), ev('e2', 'B', '2026-06-11')];
    const checkins = [
      ci('e1', 'u1', '2026-06-10T22:00:00Z'),
      ci('e2', 'u1', '2026-06-11T22:00:00Z'),
      ci('e2', 'u2', '2026-06-11T22:00:00Z'),
      ci('eX', 'u9', '2026-06-11T22:00:00Z'), // not this business → excluded
    ];
    const a = aggregateAttendance({ events, checkins, rsvps: [] });
    expect(a.totalCheckins).toBe(3);
    expect(a.perEvent[0].id).toBe('e2');    // most attended first
    expect(a.perEvent[0].attendees).toBe(2);
  });
});