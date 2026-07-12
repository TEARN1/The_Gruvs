import { fetchWithTimeout } from '../src/utils/fetchWithTimeout';

describe('fetchWithTimeout', () => {
  const realFetch = global.fetch;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); global.fetch = realFetch; });

  it('returns the response when the host answers in time', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));
    await expect(fetchWithTimeout('https://x.test')).resolves.toEqual({ ok: true, status: 200 });
  });

  // The whole point: a host that accepts the socket and goes quiet must NOT
  // leave the promise pending forever — otherwise the caller's offline/cache
  // fallback in its catch block never runs and the spinner never stops.
  it('aborts a host that never responds, instead of hanging forever', async () => {
    global.fetch = jest.fn((url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('AbortError')));
    }));
    const p = fetchWithTimeout('https://never-answers.test', {}, 10000);
    const assertion = expect(p).rejects.toThrow();
    await jest.advanceTimersByTimeAsync(10001);
    await assertion;
  });

  it('passes the abort signal through so fetch can be cancelled', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
    await fetchWithTimeout('https://x.test');
    expect(global.fetch.mock.calls[0][1].signal).toBeDefined();
  });

  it('honours a caller-supplied signal as well as the deadline', async () => {
    global.fetch = jest.fn((url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('AbortError')));
    }));
    const caller = new AbortController();
    const p = fetchWithTimeout('https://x.test', { signal: caller.signal }, 60000);
    const assertion = expect(p).rejects.toThrow();
    caller.abort();          // caller cancels long before our deadline
    await assertion;
  });
});
