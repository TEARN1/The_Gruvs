import { resilientRead } from '../src/utils/resilience';
import { loadEventsCatalog, __setEventsCatalogForTests } from '../src/services/eventsCatalog';

describe('resilientRead last-resort fallback', () => {
  const fail = () => Promise.reject(new Error('db down'));
  it('calls a function fallback instead of returning the function', async () => {
    const out = await resilientRead(fail, fail, fail, async () => ({ events: [{ id: 'x' }] }), 'test');
    expect(out).toEqual({ events: [{ id: 'x' }] });
  });
  it('still returns a plain value fallback', async () => {
    expect(await resilientRead(fail, fail, fail, [], 'test')).toEqual([]);
  });
});

describe('loadEventsCatalog', () => {
  afterEach(() => { __setEventsCatalogForTests(null); delete global.fetch; });
  it('fetches once and caches', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'gp_1' }]) }));
    expect(await loadEventsCatalog()).toEqual([{ id: 'gp_1' }]);
    expect(await loadEventsCatalog()).toEqual([{ id: 'gp_1' }]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('fails quietly to an empty list', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
    expect(await loadEventsCatalog()).toEqual([]);
  });
});

describe('rejected key or token is not retried', () => {
  it.each([
    [{ message: 'Invalid API key' }],
    [{ message: 'JWT expired', code: 'PGRST301' }],
    [{ message: 'No API key found in request' }],
  ])('%j goes straight to the fallback', async (err) => {
    let calls = 0;
    const tier = async () => { calls++; return { data: null, error: err }; };
    const t0 = Date.now();
    const out = await resilientRead(tier, tier, tier, async () => 'fallback', 'test');
    expect(out).toBe('fallback');
    expect(calls).toBe(1);                 // no retries, no other tiers
    expect(Date.now() - t0).toBeLessThan(200);
  });
});
