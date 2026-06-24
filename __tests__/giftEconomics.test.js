import { buildGiftBreakdown, describeGift, STORE_CUT } from '../src/utils/giftEconomics';

describe('buildGiftBreakdown — transparent split', () => {
  it('web channel (no store tax): 100 coins @0.20, 50% share', () => {
    const b = buildGiftBreakdown(100, { coinPrice: 0.20, channel: 'web', platformShare: 0.5 });
    expect(b).toMatchObject({ gross: 20, storeFee: 0, net: 20, platformFee: 10, creatorEarns: 10, creatorPct: 50 });
  });

  it('iOS channel: the 30% store tax visibly erodes the creator share', () => {
    const b = buildGiftBreakdown(100, { coinPrice: 0.20, channel: 'ios', platformShare: 0.5 });
    expect(b.storeFee).toBe(6);          // 30% of R20
    expect(b.net).toBe(14);
    expect(b.creatorEarns).toBe(7);      // half of R14
    expect(b.creatorPct).toBe(35);       // creator nets only 35% via IAP
  });

  it('conserves money exactly: storeFee + platformFee + creatorEarns === gross', () => {
    for (const channel of ['web', 'ios', 'android']) {
      const b = buildGiftBreakdown(137, { coinPrice: 0.18, channel });
      expect(b.storeFee + b.platformFee + b.creatorEarns).toBeCloseTo(b.gross, 2);
    }
  });

  it('zero / garbage coins yield a clean zero, never NaN', () => {
    expect(buildGiftBreakdown(0)).toMatchObject({ gross: 0, creatorEarns: 0, creatorPct: 0 });
    expect(buildGiftBreakdown('x')).toMatchObject({ gross: 0, creatorPct: 0 });
    expect(buildGiftBreakdown(-50)).toMatchObject({ coins: 0, gross: 0 });
  });

  it('clamps absurd shares and floors fractional coins', () => {
    const b = buildGiftBreakdown(10.9, { coinPrice: 1, platformShare: 5 });
    expect(b.coins).toBe(10);            // floored
    expect(b.platformShare).toBe(1);     // clamped to 100%
    expect(b.creatorEarns).toBe(0);
  });

  it('describeGift renders one honest line', () => {
    expect(describeGift(100, { coinPrice: 0.20, channel: 'web' })).toBe('You pay 20.00 · host gets 10.00 (50%)');
  });

  it('STORE_CUT reflects the real platform economics', () => {
    expect(STORE_CUT.web).toBe(0);
    expect(STORE_CUT.ios).toBe(0.30);
  });
});
