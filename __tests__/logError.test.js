// logError must be invisible-on-failure, PII-safe, deduped, and capped.
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

import { logError } from '../src/utils/logError';
import * as mock from '../src/services/supabase';

const flush = () => new Promise(r => setTimeout(r, 0));

describe('logError', () => {
  beforeEach(() => { mock.__inserts.length = 0; });

  it('never throws, even on garbage input', () => {
    expect(() => logError('X', null)).not.toThrow();
    expect(() => logError('X', { message: 'boom' }, { a: 1 })).not.toThrow();
    expect(() => logError()).not.toThrow();
  });

  it('records label + message + safe scalar context', async () => {
    logError('CheckIn.touchDown', { message: 'insert failed', code: '42703' }, { eventId: 'e1', attempt: 2 });
    await flush();
    const row = mock.__inserts.at(-1);
    expect(row.label).toBe('CheckIn.touchDown');
    expect(row.message).toContain('insert failed');
    expect(row.context).toEqual({ eventId: 'e1', attempt: 2 });
  });

  it('strips PII keys and drops nested objects from context', async () => {
    logError('Y', 'oops', { email: 'a@b.com', lat: -26, token: 'xyz', nested: { x: 1 }, code: 'PGRST202' });
    await flush();
    const row = mock.__inserts.at(-1);
    expect(row.context).toEqual({ code: 'PGRST202' });
    expect(row.context.email).toBeUndefined();
    expect(row.context.lat).toBeUndefined();
    expect(row.context.nested).toBeUndefined();
  });

  it('dedupes identical label+message within the window', async () => {
    mock.__inserts.length = 0;
    logError('Dup', 'same');
    logError('Dup', 'same');
    logError('Dup', 'same');
    await flush();
    expect(mock.__inserts.length).toBe(1);
  });
});
