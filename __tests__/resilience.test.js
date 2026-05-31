import { attemptWithBackoff, resilient } from '../src/utils/resilience';

describe('attemptWithBackoff', () => {
  it('returns the result on first success', async () => {
    const fn = jest.fn(async () => 'ok');
    await expect(attemptWithBackoff(fn, 3, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure then succeeds', async () => {
    let n = 0;
    const fn = jest.fn(async () => {
      if (n++ < 1) throw new Error('network timeout');
      return 'recovered';
    });
    await expect(attemptWithBackoff(fn, 3, 1)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all attempts', async () => {
    const fn = jest.fn(async () => { throw new Error('network down'); });
    await expect(attemptWithBackoff(fn, 2, 1)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a fatal 4xx error', async () => {
    const fn = jest.fn(async () => { const e = new Error('permission denied'); e.status = 403; throw e; });
    await expect(attemptWithBackoff(fn, 3, 1)).rejects.toThrow(/permission denied/);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('resilient (tier cascade)', () => {
  it('returns the first tier that succeeds', async () => {
    const t1 = jest.fn(async () => 'tier1');
    const t2 = jest.fn(async () => 'tier2');
    await expect(resilient([t1, t2], { attemptsPerTier: 1, baseMs: 1 })).resolves.toBe('tier1');
    expect(t2).not.toHaveBeenCalled();
  });

  it('falls through to the next tier when the first fails', async () => {
    const t1 = jest.fn(async () => { throw new Error('network error'); });
    const t2 = jest.fn(async () => 'tier2');
    await expect(resilient([t1, t2], { attemptsPerTier: 1, baseMs: 1 })).resolves.toBe('tier2');
    expect(t1).toHaveBeenCalled();
    expect(t2).toHaveBeenCalled();
  });

  it('returns fallbackValue when every tier fails', async () => {
    const t1 = jest.fn(async () => { throw new Error('network error'); });
    const t2 = jest.fn(async () => { throw new Error('network error'); });
    await expect(
      resilient([t1, t2], { attemptsPerTier: 1, baseMs: 1, fallbackValue: null })
    ).resolves.toBeNull();
  });
});
