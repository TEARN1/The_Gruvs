import { pickEventReason } from '../src/utils/eventReason';

describe('pickEventReason — legible discovery', () => {
  it('prioritises Crew going above everything else', () => {
    const r = pickEventReason({ here_count: 50, vibe_count: 100 }, { crewGoingCount: 3 });
    expect(r).toEqual({ icon: 'users', label: '3 of your Crew going' });
  });

  it('shows verified "here now" when a real crowd is present', () => {
    expect(pickEventReason({ here_count: 12 }, {})).toEqual({ icon: 'map-pin', label: '12 here now' });
  });

  it('does NOT show "here now" for a tiny/unverified crowd', () => {
    // 3 here is below the 5 threshold → falls through (no strong reason here)
    expect(pickEventReason({ here_count: 3 }, {})).toBeNull();
  });

  it('falls to "Rising near you" on strong buzz', () => {
    expect(pickEventReason({ vibe_count: 20, going: 15 }, {}).label).toBe('Rising near you');
  });

  it('shows distance when close', () => {
    expect(pickEventReason({ lat: 0, lon: 0 }, { userLat: 0, userLon: 0 }).label).toBe('Right by you');
    const r = pickEventReason({ lat: 0.018, lon: 0 }, { userLat: 0, userLon: 0 }); // ~2km
    expect(r.icon).toBe('navigation');
    expect(r.label).toMatch(/km away/);
  });

  it('matches "Your scene" via self-declared interests (category or tag)', () => {
    expect(pickEventReason({ category: 'amapiano' }, { userInterests: ['amapiano'] }))
      .toEqual({ icon: 'heart', label: 'Your scene' });
    expect(pickEventReason({ tags: ['techno'] }, { userInterests: ['techno'] }).label).toBe('Your scene');
  });

  it('shows timing when nothing stronger applies', () => {
    const now = Date.parse('2026-06-23T18:00:00');
    expect(pickEventReason({ event_date: '2026-06-23', event_time: '22:00' }, { now }))
      .toEqual({ icon: 'clock', label: 'Tonight' });
    expect(pickEventReason({ event_date: '2026-06-25', event_time: '22:00' }, { now }).label)
      .toBe('This weekend');
  });

  it('returns null for nothing notable / bad input', () => {
    expect(pickEventReason({}, {})).toBeNull();
    expect(pickEventReason(null, {})).toBeNull();
    expect(pickEventReason(undefined)).toBeNull();
  });
});
