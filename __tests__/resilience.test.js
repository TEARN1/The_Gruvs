import { attemptWithBackoff, resilient, isSchemaMiss } from '../src/utils/resilience';

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

describe('isSchemaMiss (missing RPC/table/column)', () => {
  it('flags a missing RPC by PGRST202 code', () => {
    expect(isSchemaMiss({ code: 'PGRST202', message: 'Could not find the function public.follow_user' })).toBe(true);
  });
  it('flags missing table/column PGRST20x codes', () => {
    expect(isSchemaMiss({ code: 'PGRST205' })).toBe(true);
    expect(isSchemaMiss({ code: 'PGRST204' })).toBe(true);
  });
  it('flags by "schema cache" message', () => {
    expect(isSchemaMiss({ message: 'Could not find X in the schema cache' })).toBe(true);
  });
  it('does NOT flag ordinary network/permission errors', () => {
    expect(isSchemaMiss({ message: 'network timeout' })).toBe(false);
    expect(isSchemaMiss({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isSchemaMiss({})).toBe(false);
  });
});

describe('missing-RPC fallback (the follow / reshare / check-in fix)', () => {
  it('does NOT retry a missing RPC — fails that attempt once', async () => {
    const missingRpc = jest.fn(async () => { const e = new Error('Could not find the function'); e.code = 'PGRST202'; throw e; });
    await expect(attemptWithBackoff(missingRpc, 3, 1)).rejects.toThrow();
    expect(missingRpc).toHaveBeenCalledTimes(1); // no wasted retries
  });

  it('falls straight through to the working table tier on a missing RPC', async () => {
    const rpcTier = jest.fn(async () => { const e = new Error('Could not find the function public.follow_user'); e.code = 'PGRST202'; throw e; });
    const tableTier = jest.fn(async () => true);
    await expect(
      resilient([rpcTier, tableTier], { attemptsPerTier: 3, baseMs: 1 })
    ).resolves.toBe(true);
    expect(rpcTier).toHaveBeenCalledTimes(1); // tried once, no retries
    expect(tableTier).toHaveBeenCalledTimes(1); // cascade continued
  });
});
