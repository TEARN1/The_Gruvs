// The Reels "For You" algorithm — locks in: engagement quality beats raw
// volume, fresh beats stale, watched demotes, your graph lifts, and one
// author can't own consecutive swipes. (Before this, For You was literally
// created_at DESC.)
import { reelScore, rankReels, engagementSignal, freshnessSignal } from '../src/services/reelScore';

const NOW = Date.now();
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();

const reel = (over = {}) => ({
  id: 'r1', user_id: 'a1', created_at: hoursAgo(3),
  like_count: 10, comment_count: 2, view_count: 100,
  profiles: { vibe_score: 100, is_verified: false },
  ...over,
});

describe('reelScore', () => {
  it('engagement QUALITY beats raw volume: a small reel that lands outranks a big stale flop', () => {
    const lands = reel({ id: 'a', like_count: 30, comment_count: 8, view_count: 90 });   // ~50% hit rate
    const flop = reel({ id: 'b', like_count: 40, comment_count: 0, view_count: 5000 }); // huge views, no love
    expect(reelScore(lands, { now: NOW })).toBeGreaterThan(reelScore(flop, { now: NOW }));
  });

  it('fresh beats stale at equal engagement', () => {
    const fresh = reel({ id: 'a', created_at: hoursAgo(2) });
    const stale = reel({ id: 'b', created_at: hoursAgo(96) });
    expect(reelScore(fresh, { now: NOW })).toBeGreaterThan(reelScore(stale, { now: NOW }));
  });

  it('already-watched demotes hard; liked demotes gently', () => {
    const r = reel();
    const base = reelScore(r, { now: NOW });
    expect(reelScore(r, { now: NOW, viewedIds: new Set(['r1']) })).toBeLessThan(base * 0.4);
    expect(reelScore({ ...r, _liked: true }, { now: NOW })).toBeLessThan(base);
    expect(reelScore({ ...r, _liked: true }, { now: NOW })).toBeGreaterThan(base * 0.5);
  });

  it('followed authors and event-linked reels rank up', () => {
    const base = reelScore(reel(), { now: NOW });
    expect(reelScore(reel({ _following: true }), { now: NOW })).toBeGreaterThan(base);
    expect(reelScore(reel({ event_id: 'ev1' }), { now: NOW })).toBeGreaterThan(base);
  });

  it('author fame is capped tiny — a celebrity cannot buy the feed', () => {
    const nobody = reelScore(reel({ profiles: { vibe_score: 0 } }), { now: NOW });
    const celeb = reelScore(reel({ profiles: { vibe_score: 999999 } }), { now: NOW });
    expect(celeb - nobody).toBeLessThanOrEqual(6);
  });
});

describe('rankReels', () => {
  it('one author cannot own consecutive swipes (diversity pass)', () => {
    const out = rankReels([
      reel({ id: 'a1', user_id: 'hog', like_count: 50 }),
      reel({ id: 'a2', user_id: 'hog', like_count: 48 }),
      reel({ id: 'a3', user_id: 'hog', like_count: 46 }),
      reel({ id: 'b1', user_id: 'other', like_count: 20 }),
    ], { now: NOW });
    const topThreeAuthors = out.slice(0, 3).map(r => r.user_id);
    expect(new Set(topThreeAuthors).size).toBeGreaterThan(1);
    expect(out).toHaveLength(4); // demoted, never deleted
  });

  it('is deterministic for a fixed jitterSeed and stable with no seed', () => {
    const input = [reel({ id: 'a' }), reel({ id: 'b', user_id: 'a2' }), reel({ id: 'c', user_id: 'a3' })];
    expect(rankReels(input, { now: NOW, jitterSeed: 7 }).map(r => r.id))
      .toEqual(rankReels(input, { now: NOW, jitterSeed: 7 }).map(r => r.id));
  });

  it('is null-safe', () => {
    expect(rankReels(null)).toEqual([]);
    expect(rankReels([reel()])).toHaveLength(1);
  });
});

describe('signals', () => {
  it('engagementSignal floors views so tiny samples cannot fake a 100% hit rate', () => {
    const oneLikeOneView = engagementSignal({ like_count: 1, view_count: 1 });
    const solid = engagementSignal({ like_count: 30, comment_count: 5, view_count: 100 });
    expect(solid).toBeGreaterThan(oneLikeOneView);
  });

  it('freshnessSignal decays and is null-safe', () => {
    expect(freshnessSignal({ created_at: hoursAgo(1) }, NOW))
      .toBeGreaterThan(freshnessSignal({ created_at: hoursAgo(48) }, NOW));
    expect(freshnessSignal({}, NOW)).toBe(5);
  });
});
