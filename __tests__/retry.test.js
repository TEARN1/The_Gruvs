/**
 * withRetry — exponential backoff, 4xx bail-out, Supabase error pattern.
 * Uses fake timers so tests run instantly.
 */
import { withRetry } from '../src/utils/retry';

jest.useFakeTimers();

const flushTimers = () => jest.runAllTimersAsync();

describe('withRetry', () => {
  afterEach(() => jest.clearAllTimers());

  it('returns the result immediately on first-attempt success', async () => {
    const fn = jest.fn().mockResolvedValue({ data: [1, 2, 3], error: null });
    const result = await withRetry(fn);
    expect(result).toEqual({ data: [1, 2, 3], error: null });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxAttempts on transient failures then returns last error', async () => {
    const err = new Error('network timeout');
    const fn = jest.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    await flushTimers();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ data: null, error: err });
  });

  it('returns immediately on 4xx Supabase error without retrying', async () => {
    const supabaseError = { status: 422, message: 'Unprocessable Entity' };
    const fn = jest.fn().mockResolvedValue({ data: null, error: supabaseError });

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(supabaseError);
  });

  it('retries on 5xx Supabase error', async () => {
    const serverError = { status: 503, message: 'Service Unavailable' };
    const fn = jest.fn().mockResolvedValue({ data: null, error: serverError });

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    await flushTimers();
    await promise;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('succeeds on second attempt after first failure', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValueOnce({ data: 'ok', error: null });

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    await flushTimers();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'ok', error: null });
  });

  it('respects maxAttempts: 1 — never retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    const promise = withRetry(fn, { maxAttempts: 1, baseDelayMs: 10 });
    await flushTimers();
    await promise;

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry when result has no error field', async () => {
    const fn = jest.fn().mockResolvedValue('plain string result');
    const result = await withRetry(fn);
    expect(result).toBe('plain string result');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
