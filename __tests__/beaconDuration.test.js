import { minutesFor, formatRemaining, durationLabel, MAX_BEACON_MINUTES, BEACON_DURATIONS } from '../src/utils/beaconDuration';

describe('beaconDuration — how long "Find me" stays on', () => {
  it('offers 1 hour up to 2 days, and never more than 2 days', () => {
    expect(BEACON_DURATIONS.map((d) => d.key)).toEqual(['1h', '4h', 'tonight', '1d', '2d']);
    expect(minutesFor('1h')).toBe(60);
    expect(minutesFor('2d')).toBe(MAX_BEACON_MINUTES);
    expect(MAX_BEACON_MINUTES).toBe(48 * 60);
  });

  it('"Tonight" runs to 06:00 the next morning', () => {
    expect(minutesFor('tonight', new Date('2026-10-24T21:00:00'))).toBe(9 * 60);
  });

  it('"Tonight" after midnight still ends at 06:00, not a day later', () => {
    expect(minutesFor('tonight', new Date('2026-10-25T02:00:00'))).toBe(4 * 60);
  });

  it('falls back to 1 hour for an unknown choice', () => {
    expect(minutesFor('forever')).toBe(60);
  });

  it('says what is left in plain words', () => {
    expect(formatRemaining(45)).toBe('45 min');
    expect(formatRemaining(200)).toBe('3h 20m');
    expect(formatRemaining(120)).toBe('2h');
    expect(formatRemaining(26 * 60)).toBe('1 day 2h');
    expect(formatRemaining(48 * 60)).toBe('2 days');
  });

  it('labels the length for the "pull up" message', () => {
    expect(durationLabel(60)).toBe('1 hour');
    expect(durationLabel(240)).toBe('4 hours');
    expect(durationLabel(2880)).toBe('2 days');
  });
});
