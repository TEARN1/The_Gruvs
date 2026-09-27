/**
 * resilience — extended tests for resilientRead, resilientWrite, cacheTier.
 * Complements the existing resilience.test.js which covers attemptWithBackoff.
 */
import {
  resilientRead,
  resilientWrite,
  cacheTier,
  supabaseQueryTiers,
} from '../src/utils/resilience';

jest.useFakeTimers();
const flush = () => jest.runAllTimersAsync();

describe('resilientRead', () => {
  it('returns primary result on first success', async () => {
    const primary  = jest.fn().mockResolvedValue([1, 2, 3]);
    const simple   = jest.fn().mockResolvedValue([1]);
    const fromCache = jest.fn();

    const result = await resilientRead(primary, simple, fromCache, []);
    expect(result).toEqual([1, 2, 3]);
    expect(simple).not.toHaveBeenCalled();
    expect(fromCache).not.toHaveBeenCalled();
  });

  it('falls through to secondary when primary fails', async () => {
    const primary  = jest.fn().mockRejectedValue(new Error('timeout'));
    const simple   = jest.fn().mockResolvedValue(['minimal']);
    const fromCache = jest.fn();

    const promise = resilientRead(primary, simple, fromCache, []);
    await flush();
    const result = await promise;

    expect(result).toEqual(['minimal']);
    expect(fromCache).not.toHaveBeenCalled();
  });

  it('falls through to cache when both network tiers fail', async () => {
    const primary  = jest.fn().mockRejectedValue(new Error('down'));
    const simple   = jest.fn().mockRejectedValue(new Error('down'));
    const fromCache = jest.fn().mockReturnValue(['cached']);

    const promise = resilientRead(primary, simple, fromCache, []);
    await flush();
    const result = await promise;

    expect(result).toEqual(['cached']);
  });

  it('returns emptyResult when all tiers fail', async () => {
    const primary  = jest.fn().mockRejectedValue(new Error('x'));
    const simple   = jest.fn().mockRejectedValue(new Error('x'));
    const fromCache = jest.fn().mockImplementation(() => { throw new Error('miss'); });

    const promise = resilientRead(primary, simple, fromCache, []);
    await flush();
    const result = await promise;

    expect(result).toEqual([]);
  });
});

describe('resilientWrite', () => {
  it('succeeds with primary write', async () => {
    const primary  = jest.fn().mockResolvedValue({ data: { id: '1' }, error: null });
    const fallback = jest.fn();
    const queue    = jest.fn();

    const result = await resilientWrite(primary, fallback, queue, 'test write');
    expect(result).toEqual({ data: { id: '1' }, error: null });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back to fallback write when primary fails', async () => {
    const primary  = jest.fn().mockRejectedValue(new Error('write error'));
    const fallback = jest.fn().mockResolvedValue({ data: { id: '1' }, error: null });
    const queue    = jest.fn();

    const promise = resilientWrite(primary, fallback, queue, 'test write');
    await flush();
    const result = await promise;

    expect(result).toEqual({ data: { id: '1' }, error: null });
  });

  it('queues locally when both writes fail', async () => {
    const primary  = jest.fn().mockRejectedValue(new Error('x'));
    const fallback = jest.fn().mockRejectedValue(new Error('x'));
    const queue    = jest.fn();

    const promise = resilientWrite(primary, fallback, queue, 'test write');
    await flush();
    const result = await promise;

    expect(result).toEqual({ queued: true });
  });
});

describe('cacheTier', () => {
  it('returns value from cache when key exists', () => {
    const cache = { getStale: jest.fn().mockReturnValue({ id: 'abc' }) };
    const tier = cacheTier(cache, 'my-key');
    expect(tier()).toEqual({ id: 'abc' });
    expect(cache.getStale).toHaveBeenCalledWith('my-key');
  });

  it('throws on cache miss', () => {
    const cache = { getStale: jest.fn().mockReturnValue(null) };
    const tier = cacheTier(cache, 'missing-key');
    expect(() => tier()).toThrow('Cache miss: missing-key');
  });

  it('falls back to get() when getStale is not available', () => {
    const cache = { get: jest.fn().mockReturnValue('value') };
    const tier = cacheTier(cache, 'k');
    expect(tier()).toBe('value');
  });
});

describe('supabaseQueryTiers', () => {
  it('builds three tiers with progressively simpler selects', () => {
    const buildQuery = jest.fn((t, select) => `${t}:${select}`);
    const tiers = supabaseQueryTiers('events', {
      fullSelect: 'id,title,profiles(*)',
      simpleSelect: 'id,title',
      buildQuery,
    });

    expect(tiers).toHaveLength(3);
    expect(tiers[0]()).toBe('events:id,title,profiles(*)');
    expect(tiers[1]()).toBe('events:id,title');
    expect(tiers[2]()).toBe('events:id, created_at');
  });
});
