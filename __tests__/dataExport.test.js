/**
 * Right to access / portability (POPIA s.23). collectUserData gathers only the
 * signed-in user's OWN rows; downloadJson must degrade safely off-web.
 */
jest.mock('../src/services/supabase', () => {
  // Minimal chainable stub: from(t).select().eq(col, val) → { data, error }.
  const rows = { profiles: [{ id: 'u1', username: 'thabo' }], events: [{ id: 'e1', author_id: 'u1' }] };
  // A thenable, chainable builder — like the real supabase-js query builder,
  // which only executes on await (so .eq().limit() both return the builder).
  const make = (table) => {
    const result = { data: rows[table] || [], error: null };
    const q = { _t: table };
    q.select = () => q;
    q.limit = () => q;
    q.eq = () => q;
    q.then = (resolve) => resolve(result);
    return q;
  };
  return { supabase: { from: (t) => make(t) } };
});

import { collectUserData, downloadJson } from '../src/services/dataExport';

describe('collectUserData', () => {
  it('returns a stamped export of the user\'s own rows', async () => {
    const out = await collectUserData('u1');
    expect(out.user_id).toBe('u1');
    expect(typeof out.exported_at).toBe('string');
    expect(out.data.profiles).toEqual({ id: 'u1', username: 'thabo' }); // single row unwrapped
    expect(out.data.events).toEqual([{ id: 'e1', author_id: 'u1' }]);
  });

  it('is safe with no user', async () => {
    const out = await collectUserData(null);
    expect(out.data).toEqual({});
  });
});

describe('downloadJson', () => {
  it('returns false off-web (no DOM) instead of throwing', () => {
    const realDoc = global.document;
    // node test env: document is undefined → must not throw
    delete global.document;
    expect(downloadJson({ a: 1 })).toBe(false);
    if (realDoc) global.document = realDoc;
  });
});
