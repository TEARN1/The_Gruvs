jest.mock('../src/services/supabase', () => {
  const inserts = [];
  return {
    isSupabaseEnabled: true,
    __inserts: inserts,
    supabase: {
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
      from: () => ({ insert: (row) => { inserts.push(row); return Promise.resolve({}); } }),
    },
  };
});

import { track } from '../src/utils/analytics';
import * as mock from '../src/services/supabase';
const flush = () => new Promise(r => setTimeout(r, 0));

describe('track', () => {
  beforeEach(() => { mock.__inserts.length = 0; });

  it('never throws on bad input', () => {
    expect(() => track()).not.toThrow();
    expect(() => track('x', null)).not.toThrow();
    expect(() => track('x', { a: 1 })).not.toThrow();
  });

  it('records event + scalar props + a session id', async () => {
    track('touch_down', { eventId: 'e1', category: 'nightlife' });
    await flush();
    const row = mock.__inserts.at(-1);
    expect(row.event).toBe('touch_down');
    expect(row.props).toEqual({ eventId: 'e1', category: 'nightlife' });
    expect(typeof row.session_id).toBe('string');
  });

  it('strips PII keys and non-scalars from props', async () => {
    track('signup', { email: 'a@b.com', lat: -26, name: 'x', nested: { y: 1 }, interests: 3 });
    await flush();
    expect(mock.__inserts.at(-1).props).toEqual({ interests: 3 });
  });
});
