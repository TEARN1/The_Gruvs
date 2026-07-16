// F5 — the person-to-person relevance engine. Locks in the core promise:
// relevance (shared rooms, shared interests, mutuals, proximity, recency)
// beats fame, unknowns stay neutral, and trust scales but never buys reach.
import { personScore, rankPeople, interestOverlap, proximitySignal, recencySignal } from '../src/services/peopleScore';

const viewer = { id: 'me', interests: ['Music', 'Art', 'Tech'], lat: -26.2, lon: 28.04 }; // JHB

describe('personScore', () => {
  it('relevance beats fame: a compatible nobody outranks an irrelevant celebrity', () => {
    const compatible = { id: 'a', interests: ['Music', 'Art'], vibe_score: 10, lat: -26.21, lon: 28.05 };
    const celebrity = { id: 'b', interests: ['Golf'], vibe_score: 50000, lat: 40.7, lon: -74 };
    expect(personScore(viewer, compatible)).toBeGreaterThan(personScore(viewer, celebrity));
  });

  it('real-world co-presence dominates: people you keep meeting rank highest', () => {
    const stranger = { id: 'a', interests: ['Music'] };
    const familiar = { id: 'b', interests: [] };
    expect(personScore(viewer, familiar, { coPresenceCount: 8 }))
      .toBeGreaterThan(personScore(viewer, stranger));
  });

  it('unknown attributes are NEUTRAL — no null-permissive matching', () => {
    const unknown = { id: 'a' }; // no interests, no location, no SIS
    const known = { id: 'b', interests: ['Music'], lat: -26.21, lon: 28.05 };
    // unknown must not score as if it matched everything…
    expect(personScore(viewer, known)).toBeGreaterThan(personScore(viewer, unknown));
    // …but must still get a sane non-zero neutral score (never hidden)
    expect(personScore(viewer, unknown)).toBeGreaterThan(0);
  });

  it('trust (SIS) scales bounded — it amplifies relevance, never buys reach', () => {
    const base = { id: 'a', interests: ['Music', 'Art'], lat: -26.21, lon: 28.05 };
    const low = personScore(viewer, { ...base, social_integrity_score: 0 });
    const high = personScore(viewer, { ...base, social_integrity_score: 100 });
    expect(high).toBeGreaterThan(low);
    expect(high / low).toBeLessThanOrEqual(1.48); // 1.25/0.85 bound
  });

  it('reciprocity: someone who follows you (unreciprocated) gets a pull', () => {
    const p = { id: 'a', interests: ['Music'] };
    expect(personScore(viewer, p, { followsViewer: true }))
      .toBeGreaterThan(personScore(viewer, p));
  });
});

describe('rankPeople', () => {
  it('sorts by relevance and stamps _personScore', () => {
    const out = rankPeople(viewer, [
      { id: 'far-celeb', interests: ['Golf'], vibe_score: 99999 },
      { id: 'kindred', interests: ['Music', 'Tech'], lat: -26.2, lon: 28.05 },
    ]);
    expect(out[0].id).toBe('kindred');
    expect(typeof out[0]._personScore).toBe('number');
  });

  it('is null-safe on garbage input', () => {
    expect(rankPeople(viewer, null)).toEqual([]);
    expect(rankPeople(undefined, [{ id: 'a' }])).toHaveLength(1);
  });

  it('reads extras from a Map or a plain object', () => {
    const cands = [{ id: 'a' }, { id: 'b' }];
    const viaMap = rankPeople(viewer, cands, new Map([['b', { mutualCount: 20 }]]));
    const viaObj = rankPeople(viewer, cands, { b: { mutualCount: 20 } });
    expect(viaMap[0].id).toBe('b');
    expect(viaObj[0].id).toBe('b');
  });
});

describe('signal helpers', () => {
  it('interestOverlap weighs first interests highest and caps', () => {
    expect(interestOverlap(['Music'], ['Music'])).toBeGreaterThan(interestOverlap(['Art', 'Music'], ['Art2', 'Music']));
    expect(interestOverlap(null, ['Music'])).toBe(0);
    expect(interestOverlap(['a', 'b', 'c'], ['a', 'b', 'c'])).toBeLessThanOrEqual(35);
  });

  it('proximitySignal: unknown location is neutral, never a penalty floor', () => {
    expect(proximitySignal(viewer, {})).toBe(7);
    expect(proximitySignal(viewer, { lat: -26.2, lon: 28.041 })).toBe(15);
    expect(proximitySignal(viewer, { lat: 40.7, lon: -74 })).toBe(2);
  });

  it('recencySignal: online > today > long-gone; unknown mild-neutral', () => {
    const now = Date.now();
    expect(recencySignal({ is_online: true }, now)).toBe(12);
    expect(recencySignal({ last_seen: new Date(now - 3600e3).toISOString() }, now)).toBe(8);
    expect(recencySignal({ last_seen: new Date(now - 40 * 86400e3).toISOString() }, now)).toBe(1);
    expect(recencySignal({}, now)).toBe(4);
  });
});
