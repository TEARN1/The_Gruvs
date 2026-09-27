import { aggregatePosterInsights } from '../src/services/posterInsights';

const L = (user_id, created_at) => ({ user_id, created_at });
const R = (user_id, created_at, reaction_key = 'fire') => ({ user_id, created_at, reaction_key });
const C = (user_id, checked_in_at, identity_mode) => ({ user_id, checked_in_at, identity_mode });

describe('aggregatePosterInsights', () => {
  const profiles = { u1: { username: 'ace', avatar_url: 'a.png' }, u2: { username: 'bee' }, u3: { username: 'cee' } };

  it('totals every real signal', () => {
    const r = aggregatePosterInsights({
      likes: [L('u1', '2026-07-01'), L('u2', '2026-07-02')],
      reactions: [R('u1', '2026-07-01')],
      checkins: [C('u1', '2026-07-03'), C('u3', '2026-07-03')],
      views: [{ user_id: 'u1', view_count: 3 }, { user_id: 'u9', view_count: 2 }],
      profiles,
    });
    expect(r.totals.likes).toBe(2);
    expect(r.totals.reactions).toBe(1);
    expect(r.totals.touchdowns).toBe(2);
    expect(r.totals.views).toBe(5);
    expect(r.totals.reach).toBe(2); // distinct viewers u1, u9
  });

  it('ranks the biggest engager first and marks real fans (touch down OR 2+ signals)', () => {
    const r = aggregatePosterInsights({
      likes: [L('u1', '2026-07-01'), L('u2', '2026-07-01')],
      reactions: [R('u1', '2026-07-01')],
      checkins: [C('u1', '2026-07-02')], // u1: like+reaction+touchdown => top, real fan
      profiles,
    });
    expect(r.topFans[0].userId).toBe('u1');
    expect(r.topFans[0].likes).toBe(1);
    expect(r.topFans[0].reactions).toBe(1);
    expect(r.topFans[0].touchdowns).toBe(1);
    expect(r.topFans[0].isRealFan).toBe(true);
    expect(r.topFans[0].username).toBe('ace');
    // u2 only single like => not a real fan
    const u2 = r.topFans.find(f => f.userId === 'u2');
    expect(u2.isRealFan).toBe(false);
    expect(r.realFanCount).toBe(1);
  });

  it('counts anonymous Touch Downs in the total but never names them', () => {
    const r = aggregatePosterInsights({
      checkins: [C('u1', '2026-07-02', 'ghost'), C('u2', '2026-07-02', 'public')],
      profiles,
    });
    expect(r.totals.touchdowns).toBe(2); // both counted in total
    expect(r.topFans.map(f => f.userId)).toEqual(['u2']); // ghost not attributed
  });

  it('builds a likes-over-time series of the requested length', () => {
    const now = new Date('2026-07-15T12:00:00Z').getTime();
    const r = aggregatePosterInsights({
      likes: [L('u1', '2026-07-15T09:00:00Z'), L('u2', '2026-07-15T10:00:00Z'), L('u3', '2026-07-14T10:00:00Z')],
      now, days: 7,
    });
    expect(r.likesOverTime).toHaveLength(7);
    expect(r.likesOverTime[r.likesOverTime.length - 1].count).toBe(2); // today
    expect(r.likesOverTime[r.likesOverTime.length - 2].count).toBe(1); // yesterday
  });

  it('is safe on empty input', () => {
    const r = aggregatePosterInsights({});
    expect(r.totals).toEqual({ likes: 0, reactions: 0, touchdowns: 0, views: 0, reach: 0, fans: 0 });
    expect(r.topFans).toEqual([]);
    expect(r.realFanCount).toBe(0);
  });
});
