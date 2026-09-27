/**
 * Manager-level integration tests — the manager → Supabase layer, with the
 * client mocked. These lock in the bugs fixed this session: write managers must
 * THROW on a Supabase `{ error }` (an RLS denial) instead of silently treating
 * it as success. That swallow-the-error bug is what broke Follow and DMs.
 *
 * A 'permission denied' error is classified fatal by the resilience engine, so
 * it short-circuits without backoff — keeping these tests fast & deterministic.
 */

// ── Chainable, awaitable Supabase query-builder mock ─────────────────────────
let resultQueue = [];
const setResults = (...results) => { resultQueue = results; };
const nextResult = () => (resultQueue.length > 1 ? resultQueue.shift() : (resultQueue[0] || { data: null, error: null }));

const makeBuilder = () => {
  const r = nextResult();
  const b = {};
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in',
   'order', 'limit', 'gte', 'lte', 'not', 'or', 'ilike', 'contains', 'overlaps']
    .forEach(m => { b[m] = jest.fn(() => b); });
  b.single = jest.fn(() => Promise.resolve(r));
  b.maybeSingle = jest.fn(() => Promise.resolve(r));
  // Make the builder itself awaitable (for terminal calls without .single()).
  b.then = (resolve, reject) => Promise.resolve(r).then(resolve, reject);
  return b;
};

const mockFrom = jest.fn(() => makeBuilder());
const mockRpc = jest.fn(() => Promise.resolve(nextResult()));

jest.mock('../src/services/supabase', () => ({
  supabase: { from: (...a) => mockFrom(...a), rpc: (...a) => mockRpc(...a) },
  isSupabaseEnabled: true,
}));

import { UserManager, MessageManager, InviteManager } from '../src/services/dataFlow';

const OK = { data: { id: 'x' }, error: null };
const DENIED = { data: null, error: { message: 'permission denied for table' } }; // fatal → no backoff

beforeEach(() => { resultQueue = []; mockFrom.mockClear(); mockRpc.mockClear(); });

describe('UserManager.follow', () => {
  it('resolves when the write succeeds', async () => {
    setResults(OK);
    await expect(UserManager.follow('u1', 'u2')).resolves.toBe(true);
  });

  it('THROWS on an RLS denial instead of faking success (regression)', async () => {
    setResults(DENIED);
    await expect(UserManager.follow('u1', 'u2')).rejects.toBeTruthy();
  });

  it('treats a duplicate-row error on the plain-insert tier as success', async () => {
    // Tier 1 upsert fails transiently → tier 2 plain insert hits a unique
    // violation, which must be swallowed (already following) not thrown.
    setResults(
      { data: null, error: { message: 'temporary network glitch' } }, // tier1 attempts
      { data: null, error: { message: 'duplicate key value violates unique constraint' } },
    );
    await expect(UserManager.follow('u1', 'u2')).resolves.toBe(true);
  }, 15000);
});

describe('UserManager.unfollow', () => {
  it('resolves when the delete succeeds', async () => {
    setResults({ data: null, error: null });
    await expect(UserManager.unfollow('u1', 'u2')).resolves.toBe(true);
  });

  it('THROWS on an RLS denial (regression)', async () => {
    setResults(DENIED);
    await expect(UserManager.unfollow('u1', 'u2')).rejects.toBeTruthy();
  });
});

describe('MessageManager.send', () => {
  it('resolves with a row when the insert succeeds', async () => {
    // 1st from() = prior-accepted check (no prior), 2nd = the insert.
    setResults({ data: null, error: null }, { data: { id: 'm1', body: 'hi' }, error: null });
    const res = await MessageManager.send('s1', 'r1', 'hi');
    expect(res).toBeTruthy();
  });

  it('THROWS when every insert tier is denied (regression — DMs used to silently vanish)', async () => {
    setResults({ data: null, error: null }, DENIED);
    await expect(MessageManager.send('s2', 'r2', 'hi')).rejects.toBeTruthy();
  });

  it('sanitises + still sends a plain text body', async () => {
    setResults({ data: null, error: null }, { data: { id: 'm2' }, error: null });
    await expect(MessageManager.send('s3', 'r3', '  hello  ')).resolves.toBeTruthy();
  });
});

describe('InviteManager.inviteToEvent', () => {
  it('invites each recipient and skips the host themselves', async () => {
    setResults({ data: null, error: null });
    const sent = await InviteManager.inviteToEvent('e1', 'My Gruv', ['u1', 'u2', 'host1'], 'host1', 'Host');
    expect(sent).toBe(2); // host1 excluded
  });

  it('returns 0 for an empty recipient list', async () => {
    const sent = await InviteManager.inviteToEvent('e1', 'My Gruv', [], 'host1', 'Host');
    expect(sent).toBe(0);
  });
});