import {
  distanceKm, imminenceScore, proximityScore, heatScore, scoreEvent, rankFeed, coldStartFeed,
} from '../src/utils/ranking';

const NOW = Date.UTC(2026, 7, 15, 12, 0); // 15 Aug 2026, 12:00 UTC
const JHB = { lat: -26.2041, lon: 28.0473 };

const ev = (over = {}) => ({
  id: 'e', title: 'Gruv', event_date: '2026-08-15', event_time: '20:00',
  timezone: 'UTC', lat: JHB.lat, lon: JHB.lon, author_id: 'h1', ...over,
});

describe('distanceKm', () => {
  it('measures real distance', () => {
    // Johannesburg → Cape Town ≈ 1260km
    const d = distanceKm(-26.2041, 28.0473, -33.9249, 18.4241);
    expect(d).toBeGreaterThan(1200);
    expect(d).toBeLessThan(1320);
  });
  it('returns null on missing coords rather than a wrong number', () => {
    expect(distanceKm(null, 1, 2, 3)).toBeNull();
  });
});

describe('imminence dominates — this is a "what is on TONIGHT" utility', () => {
  it('ranks tonight above a bigger event next month', () => {
    const tonight = ev({ event_time: '20:00' });                       // in 8h
    const nextMonth = ev({ event_date: '2026-09-20', checkin_count: 500 }); // huge, but far
    expect(scoreEvent(tonight, { user: JHB, now: NOW }))
      .toBeGreaterThan(scoreEvent(nextMonth, { user: JHB, now: NOW }));
  });

  it('a live event outranks everything', () => {
    const live = ev({ event_time: '10:00' }); // started 2h ago
    expect(imminenceScore(live, NOW)).toBe(1);
  });

  it('an event that is over scores zero and never ranks', () => {
    const over = ev({ event_date: '2026-08-10' });
    expect(imminenceScore(over, NOW)).toBe(0);
    expect(scoreEvent(over, { user: JHB, now: NOW })).toBe(0);
  });
});

describe('proximity is a SOFT weight, never a hard filter', () => {
  it('prefers near, but a far event still scores', () => {
    const near = proximityScore({ lat: JHB.lat, lon: JHB.lon }, JHB);
    const far = proximityScore({ lat: -33.92, lon: 18.42 }, JHB); // Cape Town
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0); // NEVER zero — hiding events isolates scenes
  });

  it('never penalises an event whose location we do not know', () => {
    expect(proximityScore({}, JHB)).toBe(0.5); // neutral, not zero
  });
});

describe('honest heat — verified presence, not likes', () => {
  it('rewards Touch Downs far more than RSVPs', () => {
    const attended = heatScore(ev({ checkin_count: 100, going: 0 }), NOW);
    const promised = heatScore(ev({ checkin_count: 0, going: 100 }), NOW);
    expect(attended).toBeGreaterThan(promised);
  });

  it('ignores likes entirely — they are buyable, presence is not', () => {
    const withLikes = heatScore(ev({ likes: 100000, vibe_count: 100000 }), NOW);
    const without = heatScore(ev({}), NOW);
    expect(withLikes).toBe(without);
  });

  it('decays so last week stops crowding out tonight', () => {
    const fresh = heatScore(ev({ checkin_count: 100, event_date: '2026-08-15', event_time: '10:00' }), NOW);
    const old = heatScore(ev({ checkin_count: 100, event_date: '2026-08-08', event_time: '10:00' }), NOW);
    expect(fresh).toBeGreaterThan(old);
  });
});

describe('rankFeed', () => {
  it('stops one host from owning the whole feed', () => {
    const hoggers = [1, 2, 3, 4, 5].map((i) => ev({ id: `h${i}`, author_id: 'promoter' }));
    const other = ev({ id: 'other', author_id: 'someone-else' });
    const ranked = rankFeed([...hoggers, other], { user: JHB, now: NOW, maxPerHost: 2 });
    const top3 = ranked.slice(0, 3).map((e) => e.author_id);
    expect(top3.filter((a) => a === 'promoter').length).toBeLessThanOrEqual(2);
    expect(ranked).toHaveLength(6); // demoted, never deleted
  });

  it('drops events that are over', () => {
    const ranked = rankFeed([ev({ id: 'past', event_date: '2026-01-01' }), ev({ id: 'soon' })], { user: JHB, now: NOW });
    expect(ranked.map((e) => e.id)).toEqual(['soon']);
  });

  // A first-time host has no heat and no history — without a deliberate boost
  // they'd never be seen, so they'd never get attendance, so they'd never get
  // heat. That loop has to be broken or the platform can never grow a host.
  it('gives a brand-new host a floor so they can ever be discovered', () => {
    const rookie = ev({ id: 'rookie', author_id: 'new', host_event_count: 0, checkin_count: 0 });
    expect(scoreEvent(rookie, { user: JHB, now: NOW })).toBeGreaterThan(0.3);
  });
});

describe('coldStartFeed', () => {
  it('gives a brand-new user a useful feed with no history at all', () => {
    const events = [
      ev({ id: 'far', lat: -33.92, lon: 18.42 }),
      ev({ id: 'near' }),
    ];
    const feed = coldStartFeed(events, { user: JHB, now: NOW });
    expect(feed[0].id).toBe('near');
  });
});
