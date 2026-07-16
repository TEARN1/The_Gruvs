import { checkinVerdict, movementPlausible } from '../src/utils/checkinGuard';

const KONKA = { lat: -26.2678, lon: 27.8586 };     // Soweto
const CPT = { lat: -33.9249, lon: 18.4241 };       // Cape Town, ~1260km away

describe('checkinVerdict — proximity is the meaning of Touch Down', () => {
  it('verifies a check-in AT the venue', () => {
    const v = checkinVerdict({ lat: -26.2679, lon: 27.8587 }, KONKA);
    expect(v.verified).toBe(true);
    expect(v.allow).toBe(true);
    expect(v.reason).toBe('at_venue');
  });

  it('accepts nearby (parking, queue down the block) as real', () => {
    // ~1km away
    const v = checkinVerdict({ lat: -26.2588, lon: 27.8586 }, KONKA);
    expect(v.verified).toBe(true);
    expect(v.reason).toBe('nearby');
  });

  // The couch check-in: positively placed far → rejected. This is the spoof.
  it('rejects a check-in that is verifiably far from the venue', () => {
    const v = checkinVerdict(CPT, KONKA);
    expect(v.allow).toBe(false);
    expect(v.verified).toBe(false);
    expect(v.reason).toBe('too_far');
  });

  // Web GPS is loose: allow a wider radius but mark it UNVERIFIED (not couch-far).
  it('allows-but-unverified between the tight geofence and a looser web radius', () => {
    // ~4km from venue: rejected at default (2km), but allowed unverified at 10km (web).
    const fourKm = { lat: -26.3040, lon: 27.8586 };
    expect(checkinVerdict(fourKm, KONKA).allow).toBe(false);                       // native
    const web = checkinVerdict(fourKm, KONKA, { maxMeters: 10000 });               // web
    expect(web.allow).toBe(true);
    expect(web.verified).toBe(false);
    expect(web.reason).toBe('nearby');
  });

  // Visibility is safety — never hard-block when we simply can't verify.
  it('allows (unverified) when location is unknown, never punishes', () => {
    expect(checkinVerdict({}, KONKA)).toMatchObject({ allow: true, verified: false, reason: 'unverifiable' });
    expect(checkinVerdict(KONKA, {})).toMatchObject({ allow: true, verified: false, reason: 'unverifiable' });
    expect(checkinVerdict(null, null)).toMatchObject({ allow: true, verified: false });
  });
});

describe('movementPlausible — impossible travel is a spoof', () => {
  it('flags Johannesburg → Cape Town in minutes', () => {
    const prev = { ...KONKA, checked_in_at: new Date('2026-08-15T20:00:00Z').toISOString() };
    const next = { ...CPT, at: new Date('2026-08-15T20:08:00Z').getTime() }; // 8 min later
    const r = movementPlausible(prev, next);
    expect(r.plausible).toBe(false);
  });

  it('allows a real flight-speed gap over hours', () => {
    const prev = { ...KONKA, checked_in_at: new Date('2026-08-15T12:00:00Z').toISOString() };
    const next = { ...CPT, at: new Date('2026-08-15T15:00:00Z').getTime() }; // 3h — a real flight
    expect(movementPlausible(prev, next).plausible).toBe(true);
  });

  it('never flags two check-ins in the same city minutes apart', () => {
    const prev = { ...KONKA, checked_in_at: new Date('2026-08-15T20:00:00Z').toISOString() };
    const next = { lat: -26.2600, lon: 27.8600, at: new Date('2026-08-15T20:05:00Z').getTime() };
    expect(movementPlausible(prev, next).plausible).toBe(true);
  });

  it('does not judge on missing data or clock skew', () => {
    expect(movementPlausible(null, KONKA).plausible).toBe(true);
    expect(movementPlausible({ ...KONKA, checked_in_at: 'now' }, { ...CPT, at: NaN }).plausible).toBe(true);
  });
});
