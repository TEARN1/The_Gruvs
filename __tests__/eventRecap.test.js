import { buildEventRecap } from '../src/utils/eventRecap';

describe('buildEventRecap — hype vs reality', () => {
  it('rewards a high show rate as the real deal', () => {
    const r = buildEventRecap({ rsvpd: 100, showed: 85 });
    expect(r.showRate).toBe(85);
    expect(r.tone).toBe('real');
    expect(r.noShows).toBe(15);
  });

  it('calls out hype that outran reality (low show rate, real RSVP base)', () => {
    const r = buildEventRecap({ rsvpd: 200, showed: 40 });
    expect(r.showRate).toBe(20);
    expect(r.verdict).toBe('Hype outran reality');
    expect(r.tone).toBe('soft');
    expect(r.noShows).toBe(160);
  });

  it('counts overflow when more showed than RSVPd', () => {
    const r = buildEventRecap({ rsvpd: 10, showed: 25 });
    expect(r.overflow).toBe(15);
    expect(r.noShows).toBe(0);
  });

  it('has no show rate without RSVPs, but still reports who showed', () => {
    const r = buildEventRecap({ rsvpd: 0, showed: 12 });
    expect(r.showRate).toBeNull();
    expect(r.verdict).toBe('12 showed up');
  });

  it('reports an empty room honestly', () => {
    const r = buildEventRecap({ rsvpd: 30, showed: 0 });
    expect(r.tone).toBe('none');
    expect(r.verdict).toBe('No verified turnout');
  });

  it('clamps garbage / negative input', () => {
    const r = buildEventRecap({ rsvpd: -5, showed: 'x', vibes: null });
    expect(r).toMatchObject({ rsvpd: 0, showed: 0, vibes: 0, showRate: null });
    expect(buildEventRecap()).toMatchObject({ showed: 0 });
  });
});
