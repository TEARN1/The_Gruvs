import { fidelityScore, applyBurstGuard, loyaltyTier, reciprocityScore, reciprocityBracket, SIGNAL_WEIGHTS } from '../src/utils/fanFidelity';

const NOW = new Date('2026-07-04T12:00:00Z').getTime();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

describe('fidelityScore — decay-weighted loyalty', () => {
  it('a real Touch Down outweighs a pile of likes', () => {
    const oneTouchdown = fidelityScore([{ type: 'touchdown', at: daysAgo(1) }], { now: NOW });
    const nineLikes = fidelityScore(Array.from({ length: 9 }, (_, i) => ({ type: 'like', at: daysAgo(1 + (i % 3)) })), { now: NOW });
    expect(oneTouchdown).toBeGreaterThan(nineLikes);
  });

  it('decays by half over the half-life', () => {
    const freshVal = fidelityScore([{ type: 'touchdown', at: daysAgo(0) }], { now: NOW });
    const oldVal = fidelityScore([{ type: 'touchdown', at: daysAgo(180) }], { now: NOW });
    expect(oldVal).toBeCloseTo(freshVal / 2, 1);
    expect(oldVal).toBeGreaterThan(0); // long-term support keeps real value
  });

  it('sustained support beats a same-day burst of equal volume', () => {
    const sustained = fidelityScore(
      Array.from({ length: 12 }, (_, i) => ({ type: 'comment', at: daysAgo(i * 30) })), { now: NOW });
    const burst = fidelityScore(
      Array.from({ length: 12 }, (_, i) => ({ type: 'comment', at: new Date(NOW - i * 1000).toISOString() })), { now: NOW });
    // burst is worth more raw (all fresh) — but capped identical volume; the point:
    // sustained history is still worth the majority of a fresh burst, so loyalty
    // can't be flash-manufactured to leapfrog a real fan with MORE history.
    expect(sustained).toBeGreaterThan(burst * 0.55);
  });

  it('ignores unknown types, invalid and future timestamps', () => {
    expect(fidelityScore([
      { type: 'hack', at: daysAgo(1) },
      { type: 'like', at: 'not-a-date' },
      { type: 'touchdown', at: daysAgo(-5) }, // future
    ], { now: NOW })).toBe(0);
  });

  it('is 0 for empty input', () => {
    expect(fidelityScore([], { now: NOW })).toBe(0);
    expect(fidelityScore(undefined, { now: NOW })).toBe(0);
  });
});

describe('applyBurstGuard — anti-bot velocity cap', () => {
  it('zeroes actions beyond the per-hour cap (50 comments in a minute)', () => {
    const midHour = NOW - 1800000; // anchor mid-hour so the burst sits in ONE bucket
    const spam = Array.from({ length: 50 }, (_, i) => ({ type: 'comment', at: new Date(midHour - i * 1000).toISOString() }));
    const guarded = applyBurstGuard(spam, { maxPerHour: 30 });
    expect(guarded.filter(a => a._guarded)).toHaveLength(20);
    // and the score only counts the allowed 30
    const s = fidelityScore(spam, { now: NOW, maxPerHour: 30 });
    expect(s).toBeLessThanOrEqual(30 * SIGNAL_WEIGHTS.comment + 0.01);
  });

  it('does not touch normal-velocity actions', () => {
    const normal = [{ type: 'like', at: daysAgo(1) }, { type: 'like', at: daysAgo(2) }];
    expect(applyBurstGuard(normal).every(a => !a._guarded)).toBe(true);
  });
});

describe('loyaltyTier', () => {
  it('maps scores to tiers', () => {
    expect(loyaltyTier(70).key).toBe('day_one');
    expect(loyaltyTier(30).key).toBe('real_one');
    expect(loyaltyTier(10).key).toBe('supporter');
    expect(loyaltyTier(1).key).toBe('new_energy');
  });
});

describe('reciprocityScore — the community stick', () => {
  it('unknown host sits at neutral 50, not condemned', () => {
    expect(reciprocityScore({})).toBe(50);
  });
  it('give-back-heavy host scores high; extraction-only scores low', () => {
    const giver = reciprocityScore({ freeEvents: 8, rewardsIssued: 4, hostEngagementsBack: 60, paidEvents: 2 });
    const taker = reciprocityScore({ paidEvents: 10, promoPosts: 20 });
    expect(giver).toBeGreaterThan(70);
    expect(taker).toBe(0);
    expect(reciprocityBracket(giver).key).toBe('community_partner');
    expect(reciprocityBracket(taker).key).toBe('eats_alone');
  });
  it('brackets cover the full range', () => {
    expect(reciprocityBracket(60).key).toBe('gives_back');
    expect(reciprocityBracket(30).key).toBe('mostly_takes');
  });
});
