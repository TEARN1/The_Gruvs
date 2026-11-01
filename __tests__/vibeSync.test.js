// Vibes are shared state: after a successful vibe/unvibe every subscribed
// screen hears the new state AND the server's real count, so the feed and the
// event page can't drift apart (the cause of wrong vibe counts).
jest.mock('../src/services/supabase', () => {
  const state = { vibeCount: 41 };
  const chain = (table) => {
    const q = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'upsert', 'insert', 'delete', 'update', 'single', 'gte', 'lte', 'neq', 'or', 'range']) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve({ data: table === 'events' ? { vibe_count: state.vibeCount, author_id: 'author-1' } : null, error: null });
    q.then = (res, rej) => Promise.resolve({ data: [], error: null }).then(res, rej);
    return q;
  };
  return {
    isSupabaseEnabled: true,
    __state: state,
    supabase: {
      from: chain,
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: { getSession: () => Promise.resolve({ data: { session: null } }), getUser: () => Promise.resolve({ data: { user: null } }) },
      channel: () => ({ on() { return this; }, subscribe: () => ({}) }),
      removeChannel: () => {},
    },
  };
});

import { VibeManager } from '../src/services/dataFlow';
import * as mock from '../src/services/supabase';

const settle = () => new Promise((r) => setTimeout(r, 20));

test('a vibe broadcasts the new state, then the server count', async () => {
  const seen = [];
  const off = VibeManager.subscribe((c) => seen.push(c));
  mock.__state.vibeCount = 42;
  const res = await VibeManager.sendVibe('ev-1', 'user-1', 'author-1');
  await settle();
  off();
  expect(res).toBe(true);
  expect(seen[0]).toEqual({ eventId: 'ev-1', userId: 'user-1', vibed: true });
  expect(seen.find((c) => typeof c.count === 'number')).toEqual({ eventId: 'ev-1', userId: 'user-1', vibed: true, count: 42 });
});

test('an immediate second vibe is reported as throttled, not success', async () => {
  await VibeManager.sendVibe('ev-2', 'user-1', 'author-1');
  expect(await VibeManager.sendVibe('ev-2', 'user-1', 'author-1')).toBe('throttled');
});

test('vibing your own event is refused', async () => {
  expect(await VibeManager.sendVibe('ev-3', 'author-1', 'author-1')).toBe('self');
});
