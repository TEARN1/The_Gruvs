import { countdown, countdownParts, eventStart } from '../src/utils/countdown';

const NOW = new Date('2026-07-13T18:00:00'); // Monday 18:00
const ev = (date, time, extra = {}) => ({ event_date: date, event_time: time, ...extra });

describe('countdown', () => {
  it('says Tonight for later the same day', () => {
    expect(countdown(ev('2026-07-13', '22:00'), NOW).label).toBe('Tonight — in 4h');
    expect(countdown(ev('2026-07-13', '22:00'), NOW).state).toBe('today');
  });

  it('counts minutes when it is nearly on', () => {
    expect(countdown(ev('2026-07-13', '18:30'), NOW).label).toBe('In 30 min');
  });

  // The trap: at 23:00, an event 2 hours away is TOMORROW, not "in 2h".
  it('uses calendar days, not elapsed hours', () => {
    const late = new Date('2026-07-13T23:00:00');
    const c = countdown(ev('2026-07-14', '01:00'), late);
    expect(c.days).toBe(1);
    expect(c.label).toBe('Tomorrow');
  });

  it('handles days, weeks and months', () => {
    expect(countdown(ev('2026-07-16', '20:00'), NOW).label).toBe('In 3 days');
    expect(countdown(ev('2026-07-20', '20:00'), NOW).label).toBe('In a week');
    expect(countdown(ev('2026-08-10', '20:00'), NOW).label).toBe('In 4 weeks');
    expect(countdown(ev('2026-10-13', '20:00'), NOW).label).toBe('In 3 months');
  });

  it('is Live now while the event is still running', () => {
    const c = countdown(ev('2026-07-13', '16:00'), NOW); // started 2h ago
    expect(c.state).toBe('live');
    expect(c.label).toBe('Live now');
  });

  it('respects end_date for multi-day events', () => {
    const c = countdown(ev('2026-07-11', '10:00', { end_date: '2026-07-15' }), NOW);
    expect(c.state).toBe('live'); // a festival mid-run
  });

  it('is Ended once it is over', () => {
    expect(countdown(ev('2026-07-01', '20:00'), NOW).state).toBe('past');
  });

  it('never throws on missing or junk dates', () => {
    expect(countdown(null, NOW).label).toBe('');
    expect(countdown(ev('', ''), NOW).state).toBe('unknown');
    expect(countdown(ev('not-a-date', '20:00'), NOW).state).toBe('unknown');
    expect(eventStart({ event_date: '2026-07-13' })).toBeInstanceOf(Date); // time optional
  });
});

describe('countdownParts', () => {
  it('breaks the wait into d/h/m/s', () => {
    expect(countdownParts(ev('2026-07-16', '22:30'), NOW)).toEqual({
      days: 3, hours: 4, minutes: 30, seconds: 0,
    });
  });
  it('is null once the event has started', () => {
    expect(countdownParts(ev('2026-07-13', '17:00'), NOW)).toBeNull();
  });
});
