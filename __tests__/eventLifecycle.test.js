import { lifecycleState, isDiscoverable, isLive, isRecent, eventsToClose } from '../src/utils/eventLifecycle';

const ev = (over = {}) => ({ id: 'e', event_date: '2026-08-15', event_time: '20:00', timezone: 'UTC', ...over });

// 20:00 UTC on 2026-08-15
const START = Date.UTC(2026, 7, 15, 20, 0);

describe('lifecycleState', () => {
  it('is upcoming before it starts', () => {
    expect(lifecycleState(ev(), START - 3600000)).toBe('upcoming');
  });

  it('is live while it is running', () => {
    expect(lifecycleState(ev(), START + 3600000)).toBe('live'); // 1h in
  });

  it('is recent just after it ends', () => {
    // default run is 6h, so 8h after start is past end but within the recent window
    expect(lifecycleState(ev(), START + 8 * 3600000)).toBe('recent');
  });

  it('is ended once it is history', () => {
    expect(lifecycleState(ev(), START + 30 * 3600000)).toBe('ended');
  });

  // An event happens in the VENUE's zone, not the viewer's.
  it('is timezone-correct', () => {
    const lagos = ev({ timezone: 'Africa/Lagos' }); // 20:00 Lagos = 19:00 UTC
    expect(lifecycleState(lagos, Date.UTC(2026, 7, 15, 19, 30))).toBe('live');
    expect(lifecycleState(lagos, Date.UTC(2026, 7, 15, 18, 30))).toBe('upcoming');
  });

  it('respects a multi-day end_date', () => {
    const festival = ev({ end_date: '2026-08-17' });
    expect(lifecycleState(festival, Date.UTC(2026, 7, 16, 12, 0))).toBe('live'); // mid-festival
  });

  it('is unknown with no usable date', () => {
    expect(lifecycleState({}, START)).toBe('unknown');
  });
});

describe('isDiscoverable', () => {
  it('keeps upcoming and live events, drops the past', () => {
    expect(isDiscoverable(ev(), START - 1000)).toBe(true);   // upcoming
    expect(isDiscoverable(ev(), START + 1000)).toBe(true);   // live
    expect(isDiscoverable(ev(), START + 30 * 3600000)).toBe(false); // ended
  });
});

describe('isLive / isRecent', () => {
  it('flags live and recent windows', () => {
    expect(isLive(ev(), START + 1000)).toBe(true);
    expect(isRecent(ev(), START + 8 * 3600000)).toBe(true);
  });
});

describe('eventsToClose', () => {
  it('returns only the ids of events that are truly over and not already closed', () => {
    const events = [
      ev({ id: 'live' }),
      ev({ id: 'past1', event_date: '2026-08-01' }),
      ev({ id: 'past2', event_date: '2026-08-02', status: 'ended' }), // already closed
      ev({ id: 'cancelled', event_date: '2026-08-02', status: 'cancelled' }),
    ];
    const ids = eventsToClose(events, START + 3600000);
    expect(ids).toEqual(['past1']); // live not over; ended/cancelled skipped
  });

  it('never throws on junk', () => {
    expect(eventsToClose(null)).toEqual([]);
    expect(eventsToClose([null, {}])).toEqual([]);
  });
});
