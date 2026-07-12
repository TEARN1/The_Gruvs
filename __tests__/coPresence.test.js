import { describeSharedPresence } from '../src/services/coPresence';

describe('coPresence — the proof-of-presence intro', () => {
  it('says nothing when the two have never actually met', () => {
    expect(describeSharedPresence([])).toBeNull();
    expect(describeSharedPresence(null)).toBeNull();
    expect(describeSharedPresence(undefined)).toBeNull();
  });

  it('names the shared event when they both Touched Down', () => {
    const out = describeSharedPresence([
      { id: 'e1', title: 'iNdumiso Travelers', event_date: '2026-09-25' },
    ]);
    expect(out.title).toBe('iNdumiso Travelers');
    expect(out.eventId).toBe('e1');
    expect(out.more).toBe(0);
    expect(out.text).toContain('You both Touched Down at iNdumiso Travelers');
  });

  it('counts the extra events without over-claiming', () => {
    const out = describeSharedPresence([
      { id: 'e1', title: 'Night One', event_date: '2026-09-25' },
      { id: 'e2', title: 'Night Two', event_date: '2026-08-01' },
      { id: 'e3', title: 'Night Three', event_date: '2026-07-01' },
    ]);
    expect(out.title).toBe('Night One'); // most recent leads
    expect(out.more).toBe(2);
    expect(out.text).toContain('and 2 more');
  });

  it('survives an event with no date (never renders "undefined")', () => {
    const out = describeSharedPresence([{ id: 'e1', title: 'Undated Gruv' }]);
    expect(out.when).toBeNull();
    expect(out.text).not.toMatch(/undefined|null|NaN/i);
    expect(out.text).toBe('You both Touched Down at Undated Gruv');
  });
});
