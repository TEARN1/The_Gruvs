import { rankSuperfans, fanTier, periodStart, isAnonCheckin } from '../src/services/superfans';

const evt = (id, date) => ({ id, title: `E${id}`, event_date: date });
const ci = (event_id, user_id, checked_in_at, identity_mode) => ({ event_id, user_id, checked_in_at, identity_mode });

describe('fanTier', () => {
  it('escalates by distinct events attended', () => {
    expect(fanTier(1)).toBe('newcomer');
    expect(fanTier(2)).toBe('regular');
    expect(fanTier(3)).toBe('true_fan');
    expect(fanTier(5)).toBe('superfan');
    expect(fanTier(12)).toBe('superfan');
  });
});

describe('isAnonCheckin — Ghost/anonymous never surfaces a fan', () => {
  it('flags ghost/anonymous/incognito', () => {
    expect(isAnonCheckin({ identity_mode: 'ghost' })).toBe(true);
    expect(isAnonCheckin({ identity_mode: 'Anonymous' })).toBe(true);
    expect(isAnonCheckin({ identity_mode: 'incognito' })).toBe(true);
  });
  it('treats public/unknown as visible', () => {
    expect(isAnonCheckin({ identity_mode: 'public' })).toBe(false);
    expect(isAnonCheckin({})).toBe(false);
  });
});

describe('rankSuperfans', () => {
  const events = [evt('e1', '2026-07-01'), evt('e2', '2026-07-05'), evt('e3', '2026-06-20'), evt('e4', '2026-05-10'), evt('e5', '2026-07-10'), evt('e6', '2026-07-12')];
  const profiles = { u1: { username: 'ace', avatar_url: 'a.png' }, u2: { username: 'bee' }, u3: { username: 'cee' } };

  it('ranks the most-frequent attendee first with the right tier', () => {
    const checkins = [
      // u1 attended 5 distinct events => superfan
      ci('e1', 'u1', '2026-07-01T20:00:00Z'), ci('e2', 'u1', '2026-07-05T20:00:00Z'),
      ci('e3', 'u1', '2026-06-20T20:00:00Z'), ci('e5', 'u1', '2026-07-10T20:00:00Z'),
      ci('e6', 'u1', '2026-07-12T20:00:00Z'),
      // u2 attended 2 distinct => regular
      ci('e1', 'u2', '2026-07-01T20:00:00Z'), ci('e2', 'u2', '2026-07-05T20:00:00Z'),
      // u3 attended 1 => newcomer
      ci('e1', 'u3', '2026-07-01T20:00:00Z'),
    ];
    const r = rankSuperfans({ events, checkins, profiles, period: 'all' });
    expect(r.fans[0].userId).toBe('u1');
    expect(r.fans[0].tier).toBe('superfan');
    expect(r.fans[0].events).toBe(5);
    expect(r.fans[0].username).toBe('ace');
    expect(r.fans[0].dueForReward).toBe(true);
    expect(r.superfans).toBe(1);
    expect(r.totalFans).toBe(3);
    // newcomer is not "due for reward"
    expect(r.fans.find(f => f.userId === 'u3').dueForReward).toBe(false);
  });

  it('excludes Ghost/anonymous check-ins from the leaderboard', () => {
    const checkins = [
      ci('e1', 'u1', '2026-07-01T20:00:00Z', 'ghost'),
      ci('e2', 'u1', '2026-07-05T20:00:00Z', 'ghost'),
      ci('e1', 'u2', '2026-07-01T20:00:00Z', 'public'),
    ];
    const r = rankSuperfans({ events, checkins, profiles, period: 'all' });
    expect(r.fans.map(f => f.userId)).toEqual(['u2']); // u1's ghost check-ins hidden
  });

  it('month period only counts check-ins since the 1st of the current month', () => {
    const now = new Date('2026-07-15T12:00:00Z').getTime();
    const checkins = [
      ci('e1', 'u1', '2026-07-02T20:00:00Z'), // in-month
      ci('e3', 'u1', '2026-06-20T20:00:00Z'), // last month — excluded
    ];
    const r = rankSuperfans({ events, checkins, profiles, period: 'month', now });
    expect(r.fans[0].events).toBe(1); // only the July check-in
  });

  it('computes share % of the host events attended', () => {
    const checkins = [ci('e1', 'u1', '2026-07-01T20:00:00Z'), ci('e2', 'u1', '2026-07-05T20:00:00Z'), ci('e3', 'u1', '2026-06-20T20:00:00Z')];
    const r = rankSuperfans({ events, checkins, profiles, period: 'all' });
    // 3 of 6 events => 50%
    expect(r.fans[0].sharePct).toBe(50);
  });

  it('is safe on empty input', () => {
    const r = rankSuperfans({});
    expect(r).toEqual({ period: 'all', totalFans: 0, superfans: 0, trueFans: 0, fans: [] });
  });

  it('carries a decay-weighted fidelity score + loyalty tier per fan', () => {
    const checkins = [
      ci('e1', 'u1', '2026-07-01T20:00:00Z'), ci('e2', 'u1', '2026-07-02T20:00:00Z'),
      ci('e1', 'u2', '2026-07-01T20:00:00Z'),
    ];
    const now = new Date('2026-07-04T12:00:00Z').getTime();
    const r = rankSuperfans({ events, checkins, profiles, now });
    const u1 = r.fans.find(f => f.userId === 'u1');
    const u2 = r.fans.find(f => f.userId === 'u2');
    expect(u1.fidelity).toBeGreaterThan(u2.fidelity); // more presence = more fidelity
    expect(u1.loyalty.key).toBeTruthy();
    expect(r.fans[0].userId).toBe('u1'); // fidelity leads the ranking
  });
});

describe('periodStart', () => {
  it('month → 1st of current month, year → Jan 1, all → 0', () => {
    const now = new Date('2026-07-15T12:00:00Z').getTime();
    expect(new Date(periodStart('month', now)).getDate()).toBe(1);
    expect(new Date(periodStart('year', now)).getMonth()).toBe(0);
    expect(periodStart('all', now)).toBe(0);
  });
});
