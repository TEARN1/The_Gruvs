/**
 * getReelsFeed must distinguish a genuinely empty feed (return []) from a total
 * load failure (throw, so the screen shows retry) — and must never fabricate
 * mock reels. (Item 41.)
 */
jest.mock('../src/services/supabase', () => {
  let result = { data: [], error: null };
  const makeQB = () => {
    const qb = {};
    ['select', 'neq', 'limit', 'order', 'in', 'ilike', 'eq', 'is'].forEach((m) => { qb[m] = () => qb; });
    qb.then = (resolve) => resolve(result); // awaitable
    return qb;
  };
  return {
    supabase: { from: () => makeQB() },
    __setResult: (r) => { result = r; },
  };
});

import { ReelsRepository } from '../src/services/reelsDataFlow';
import * as supa from '../src/services/supabase';

describe('ReelsRepository.getReelsFeed', () => {
  it('returns an empty array for an empty (but successful) feed', async () => {
    supa.__setResult({ data: [], error: null });
    const out = await ReelsRepository.getReelsFeed({ tab: 'foryou' });
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(0);
  });

  it('returns real rows when the query succeeds', async () => {
    supa.__setResult({ data: [{ id: 'r1', media_url: 'x.mp4', user_id: 'u1' }], error: null });
    const out = await ReelsRepository.getReelsFeed({ tab: 'foryou' });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('r1');
  });

  it('throws (not fake-empty) when every tier fails', async () => {
    supa.__setResult({ data: null, error: { message: 'network down' } });
    await expect(ReelsRepository.getReelsFeed({ tab: 'foryou' })).rejects.toBeTruthy();
  });
});