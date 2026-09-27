import { hostReliability, reliabilityLabel } from '../src/utils/hostScore';

describe('hostReliability', () => {
  // No history is NOT bad history. Punishing a new host makes it impossible to
  // ever become a trusted one — the whole platform depends on new hosts starting.
  it('is neutral for a brand-new host, never punishing', () => {
    const r = hostReliability([]);
    expect(r.score).toBe(0.5);
    expect(r.confident).toBe(false);
  });

  it('rewards a host who starts on time and draws a crowd', () => {
    const good = hostReliability([
      { start_delay_min: 5, rsvp_count: 40, checkin_count: 30, is_past: true },
      { start_delay_min: 10, rsvp_count: 60, checkin_count: 45, is_past: true },
      { start_delay_min: 0, rsvp_count: 20, checkin_count: 18, is_past: true },
    ]);
    expect(good.score).toBeGreaterThan(0.7);
    expect(good.confident).toBe(true);
    expect(good.delivered).toBe(3);
  });

  it('marks down a host whose events start hours late', () => {
    const late = hostReliability([
      { start_delay_min: 120, rsvp_count: 40, checkin_count: 10, is_past: true },
      { start_delay_min: 150, rsvp_count: 50, checkin_count: 8, is_past: true },
      { start_delay_min: 100, rsvp_count: 30, checkin_count: 5, is_past: true },
    ]);
    expect(late.score).toBeLessThan(0.5);
  });

  // Honesty over perfection: cancelling with real notice is fair play.
  it('does not punish an early, honest cancellation', () => {
    const honest = hostReliability([
      { status: 'cancelled', cancel_notice_hours: 48, is_past: true },
      { start_delay_min: 5, rsvp_count: 20, checkin_count: 15, is_past: true },
      { start_delay_min: 10, rsvp_count: 30, checkin_count: 20, is_past: true },
    ]);
    const noShow = hostReliability([
      { status: 'cancelled', cancel_notice_hours: 0, is_past: true },
      { status: 'cancelled', cancel_notice_hours: 0, is_past: true },
      { status: 'cancelled', cancel_notice_hours: 0, is_past: true },
    ]);
    expect(honest.score).toBeGreaterThan(noShow.score);
    expect(noShow.score).toBeLessThan(0.3);
  });

  // A ghost event — advertised, nobody ever Touched Down — is a red flag.
  it('penalises events that advertised but never happened', () => {
    const ghost = hostReliability([
      { rsvp_count: 30, checkin_count: 0, is_past: true },
      { rsvp_count: 40, checkin_count: 0, is_past: true },
      { rsvp_count: 25, checkin_count: 0, is_past: true },
    ]);
    expect(ghost.score).toBeLessThan(0.4);
  });

  it('is a hint, not a verdict, below 3 events', () => {
    expect(hostReliability([{ start_delay_min: 5, rsvp_count: 10, checkin_count: 9, is_past: true }]).confident).toBe(false);
  });

  it('never throws on junk', () => {
    expect(hostReliability(null).score).toBe(0.5);
    expect(hostReliability([{}, null]).score).toBe(0.5);
  });
});

describe('reliabilityLabel', () => {
  it('says nothing until it is confident', () => {
    expect(reliabilityLabel({ score: 0.9, confident: false })).toBe('');
    expect(reliabilityLabel(null)).toBe('');
  });
  it('badges a reliable host', () => {
    expect(reliabilityLabel({ score: 0.9, confident: true, sample: 8, delivered: 7 }))
      .toMatch(/reliable/i);
  });
});
