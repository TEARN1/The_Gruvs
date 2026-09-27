import { venueKey, titleKey, eventFingerprint, isSameEvent, findDuplicate } from '../src/utils/eventKey';

describe('venueKey', () => {
  it('collapses the many ways one venue gets typed', () => {
    const k = venueKey('Konka', 'Soweto');
    expect(venueKey('KONKA Soweto', '')).toBe(k);
    expect(venueKey('Konka, Soweto', '')).toBe(k);
    expect(venueKey('The Konka Club', 'Soweto')).toBe(k);
    expect(venueKey('konka', 'soweto')).toBe(k);
  });

  it('is word-order independent', () => {
    expect(venueKey('Soweto Konka', '')).toBe(venueKey('Konka Soweto', ''));
  });

  it('ignores accents', () => {
    expect(venueKey('Café Rouge', 'Paris')).toBe(venueKey('Cafe Rouge', 'Paris'));
  });

  it('keeps different venues different', () => {
    expect(venueKey('Konka', 'Soweto')).not.toBe(venueKey('Taboo', 'Sandton'));
  });
});

describe('eventFingerprint', () => {
  it('is the same for the same night at the same place', () => {
    const a = { title: 'Amapiano Sunset', address: 'Konka', city: 'Soweto', event_date: '2026-08-15' };
    const b = { title: 'AMAPIANO SUNSET', address: 'KONKA, Soweto', city: '', event_date: '2026-08-15' };
    expect(eventFingerprint(a)).toBe(eventFingerprint(b));
  });

  // The same party next week is a NEW event, not a duplicate. Weekly residencies
  // would otherwise be silently collapsed into one.
  it('treats a different night as a different event', () => {
    const a = { title: 'Amapiano Sunset', address: 'Konka', city: 'Soweto', event_date: '2026-08-15' };
    const b = { ...a, event_date: '2026-08-22' };
    expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
  });
});

describe('isSameEvent', () => {
  const base = { title: 'Amapiano Sunset', address: 'Konka', city: 'Soweto', event_date: '2026-08-15' };

  it('catches an exact repost', () => {
    const r = isSameEvent(base, { ...base, id: 'x' });
    expect(r.duplicate).toBe(true);
    expect(r.confidence).toBe(1);
  });

  it('catches a repost with a varied title', () => {
    const repost = { title: 'Amapiano Sunset vol 2', address: 'KONKA Soweto', city: '', event_date: '2026-08-15' };
    expect(isSameEvent(repost, base).duplicate).toBe(true);
  });

  it('never merges two different parties on the same night', () => {
    const other = { title: 'Rock Night', address: 'Taboo', city: 'Sandton', event_date: '2026-08-15' };
    expect(isSameEvent(other, base).duplicate).toBe(false);
  });

  it('never merges the same party on different nights', () => {
    expect(isSameEvent({ ...base, event_date: '2026-08-22' }, base).duplicate).toBe(false);
  });
});

describe('findDuplicate', () => {
  it('returns the strongest match, or null', () => {
    const existing = [
      { id: '1', title: 'Rock Night', address: 'Taboo', city: 'Sandton', event_date: '2026-08-15' },
      { id: '2', title: 'Amapiano Sunset', address: 'Konka', city: 'Soweto', event_date: '2026-08-15' },
    ];
    const hit = findDuplicate(
      { title: 'AMAPIANO SUNSET', address: 'Konka Soweto', event_date: '2026-08-15' },
      existing,
    );
    expect(hit?.event.id).toBe('2');
    expect(findDuplicate({ title: 'Jazz Brunch', address: 'The Orbit', event_date: '2026-09-01' }, existing)).toBeNull();
  });

  it('never matches an event against itself', () => {
    const e = { id: '1', title: 'X', address: 'Y', event_date: '2026-08-15' };
    expect(findDuplicate(e, [e])).toBeNull();
  });

  // Was event.address || event.venue — `venue` (bare) is never a real event
  // column, so venue_name was invisible to duplicate detection and a repost
  // carrying only venue_name (no address) could never be caught.
  it('catches a repost identified only by venue_name, not address', () => {
    const existing = [
      { id: '1', title: 'Amapiano Sunset', venue_name: 'Konka', city: 'Soweto', event_date: '2026-08-15' },
    ];
    const hit = findDuplicate(
      { title: 'AMAPIANO SUNSET', venue_name: 'Konka Soweto', event_date: '2026-08-15' },
      existing,
    );
    expect(hit?.event.id).toBe('1');
  });

  // PostEventModal writes the literal placeholder 'See poster' into `address`
  // for a poster-mode event with no address entered — that must never be
  // treated as a real, matchable venue between two unrelated events.
  it('never treats the poster-mode placeholder address as a real venue match', () => {
    const existing = [
      { id: '1', title: 'Rock Night', address: 'See poster', event_date: '2026-08-15' },
    ];
    const hit = findDuplicate(
      { title: 'Totally Different Party', address: 'See poster', event_date: '2026-08-15' },
      existing,
    );
    expect(hit).toBeNull();
  });
});
