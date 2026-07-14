/**
 * Timezone correctness. An event happens at a PLACE, in that place's time.
 *
 * Before this, event_date + event_time were parsed with `new Date('...T21:00')`,
 * which resolves in the VIEWER's zone. A Lagos event viewed from New York counted
 * down six hours wrong and "Live now" fired at the wrong moment. Silent, and it
 * only appears once you have two countries — which The Gruvs now does.
 */
import { zonedTimeToUtc, eventInstant, isValidZone, deviceTimeZone, venueLocalTimeLabel } from '../src/utils/tz';
import { countdown } from '../src/utils/countdown';

describe('zonedTimeToUtc', () => {
  it('resolves a wall-clock time in a named zone to the right instant', () => {
    // 21:00 in Johannesburg (UTC+2, no DST) === 19:00 UTC
    expect(zonedTimeToUtc('2026-08-15', '21:00', 'Africa/Johannesburg'))
      .toBe(Date.UTC(2026, 7, 15, 19, 0));
    // 21:00 in Lagos (UTC+1) === 20:00 UTC
    expect(zonedTimeToUtc('2026-08-15', '21:00', 'Africa/Lagos'))
      .toBe(Date.UTC(2026, 7, 15, 20, 0));
    // 21:00 in UTC
    expect(zonedTimeToUtc('2026-08-15', '21:00', 'UTC'))
      .toBe(Date.UTC(2026, 7, 15, 21, 0));
  });

  it('handles a zone that is behind UTC', () => {
    // 21:00 New York in August is EDT (UTC-4) === 01:00 UTC the NEXT day
    expect(zonedTimeToUtc('2026-08-15', '21:00', 'America/New_York'))
      .toBe(Date.UTC(2026, 7, 16, 1, 0));
  });

  it('respects DST — the same wall time is a different instant in summer vs winter', () => {
    const summer = zonedTimeToUtc('2026-07-15', '21:00', 'Europe/London'); // BST, UTC+1
    const winter = zonedTimeToUtc('2026-01-15', '21:00', 'Europe/London'); // GMT, UTC+0
    expect(summer).toBe(Date.UTC(2026, 6, 15, 20, 0));
    expect(winter).toBe(Date.UTC(2026, 0, 15, 21, 0));
  });

  it('defaults time to midnight and never throws on junk', () => {
    expect(zonedTimeToUtc('2026-08-15', null, 'UTC')).toBe(Date.UTC(2026, 7, 15, 0, 0));
    expect(zonedTimeToUtc('not-a-date', '21:00', 'UTC')).toBeNull();
    expect(zonedTimeToUtc('2026-08-15', '21:00', 'Mars/Olympus')).not.toBeNull(); // bad zone → device zone
  });

  it('validates zones without throwing', () => {
    expect(isValidZone('Africa/Johannesburg')).toBe(true);
    expect(isValidZone('Nope/Nowhere')).toBe(false);
    expect(isValidZone(null)).toBe(false);
    expect(isValidZone(undefined)).toBe(false);
  });

  it('always reports a device zone', () => {
    expect(typeof deviceTimeZone()).toBe('string');
    expect(deviceTimeZone().length).toBeGreaterThan(0);
  });
});

describe('countdown is timezone-correct', () => {
  // THE BUG: a Lagos event at 21:00, seen 1 hour before it starts. Without a
  // zone the viewer's clock decided, and the countdown was hours out.
  it('counts down to the venue\'s local start, not the viewer\'s', () => {
    const event = { event_date: '2026-08-15', event_time: '21:00', timezone: 'Africa/Lagos' };
    const oneHourBefore = Date.UTC(2026, 7, 15, 19, 0); // 20:00 in Lagos
    const c = countdown(event, oneHourBefore);
    expect(c.label).toBe('Within the hour');
    expect(c.state).toBe('today');
  });

  it('says Live now only once the venue\'s local start has passed', () => {
    const event = { event_date: '2026-08-15', event_time: '21:00', timezone: 'America/New_York' };
    // 21:00 New York = 01:00 UTC on the 16th. At 00:00 UTC it has NOT started.
    expect(countdown(event, Date.UTC(2026, 7, 16, 0, 0)).state).not.toBe('live');
    // An hour later, it has.
    expect(countdown(event, Date.UTC(2026, 7, 16, 2, 0)).state).toBe('live');
  });

  it('falls back safely when an old event has no timezone', () => {
    const legacy = { event_date: '2026-08-15', event_time: '21:00' }; // pre-migration row
    expect(countdown(legacy, Date.UTC(2026, 7, 1)).state).toBe('future');
  });
});

describe('venueLocalTimeLabel', () => {
  it('renders the time as it reads AT THE VENUE', () => {
    const label = venueLocalTimeLabel({ event_date: '2026-08-15', event_time: '21:00', timezone: 'Africa/Johannesburg' });
    expect(label).toMatch(/^21:00/); // 21:00 in Joburg, whatever zone the viewer is in
  });
  it('is empty for an event with no date', () => {
    expect(venueLocalTimeLabel({})).toBe('');
  });
});
