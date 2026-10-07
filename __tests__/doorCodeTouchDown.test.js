jest.mock('../src/services/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '../src/services/supabase';
import { getDoorCode, touchDownWithCode, cleanCode } from '../src/services/doorCode';

beforeEach(() => supabase.rpc.mockReset());

describe('cleanCode', () => {
  it('keeps digits only, max 6', () => {
    expect(cleanCode('12 34-56')).toBe('123456');
    expect(cleanCode('1234567')).toBe('123456');
    expect(cleanCode(null)).toBe('');
  });
});

describe('touchDownWithCode', () => {
  it('refuses a short code without calling the server', async () => {
    expect(await touchDownWithCode('e1', '123')).toEqual({ ok: false, message: 'The door code has 6 digits.' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('sends the cleaned code and coordinates', async () => {
    supabase.rpc.mockResolvedValue({ data: { ok: true, level: 2 }, error: null });
    const r = await touchDownWithCode('e1', '123 456', { latitude: -26.1, longitude: 28.0 });
    expect(r).toEqual({ ok: true, level: 2 });
    expect(supabase.rpc).toHaveBeenCalledWith('touch_down_with_code', { p_event_id: 'e1', p_code: '123456', p_lat: -26.1, p_lon: 28.0 });
  });

  it('works without location', async () => {
    supabase.rpc.mockResolvedValue({ data: { ok: true, level: 2 }, error: null });
    await touchDownWithCode('e1', '123456', null);
    expect(supabase.rpc.mock.calls[0][1]).toMatchObject({ p_lat: null, p_lon: null });
  });

  it.each([
    ['wrong_or_expired_code', /didn't match/],
    ['too_many_attempts', /Too many tries/],
  ])('explains %s', async (reason, re) => {
    supabase.rpc.mockResolvedValue({ data: { ok: false, reason }, error: null });
    const r = await touchDownWithCode('e1', '123456');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(re);
  });

  it('reports a network failure', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'fetch failed' } });
    expect((await touchDownWithCode('e1', '123456')).message).toMatch(/server/);
  });
});

describe('getDoorCode', () => {
  it('returns the code and countdown', async () => {
    supabase.rpc.mockResolvedValue({ data: { code: '042917', seconds_left: 12, period: 30 }, error: null });
    expect(await getDoorCode('e1')).toEqual({ code: '042917', secondsLeft: 12, period: 30 });
  });
  it('explains a permission refusal', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'only the host or door staff can show the door code', code: '42501' } });
    await expect(getDoorCode('e1')).rejects.toThrow('Only the host or door staff');
  });
});
