/**
 * 2FA (#997). The enroll/verify round-trips talk to Supabase Auth and need a live
 * smoke-test; here we pin the pure gate + the guard behaviour (never throws,
 * validates the code before spending a challenge, rejects missing factors).
 */
jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: jest.fn(() => Promise.resolve({ data: { totp: [] }, error: null })),
        enroll: jest.fn(() => Promise.resolve({ data: { id: 'f1', totp: { uri: 'otpauth://x', secret: 'ABC', qr_code: '<svg/>' } }, error: null })),
        challenge: jest.fn(() => Promise.resolve({ data: { id: 'c1' }, error: null })),
        verify: jest.fn(() => Promise.resolve({ error: null })),
        unenroll: jest.fn(() => Promise.resolve({ error: null })),
      },
    },
  },
}));

import { isValidTotpCode, enrollTotp, verifyTotp, mfaStatus, disableMfa } from '../src/services/mfa';

describe('isValidTotpCode', () => {
  it('accepts exactly 6 digits, rejects everything else', () => {
    expect(isValidTotpCode('123456')).toBe(true);
    expect(isValidTotpCode('12345')).toBe(false);
    expect(isValidTotpCode('1234567')).toBe(false);
    expect(isValidTotpCode('12a456')).toBe(false);
    expect(isValidTotpCode('')).toBe(false);
    expect(isValidTotpCode(null)).toBe(false);
  });
});

describe('mfa service — guards', () => {
  it('enroll returns the QR uri + secret', async () => {
    const r = await enrollTotp();
    expect(r.ok).toBe(true);
    expect(r.factorId).toBe('f1');
    expect(r.uri).toBe('otpauth://x');
    expect(r.secret).toBe('ABC');
  });

  // Don't spend a challenge on an obviously-bad code.
  it('verify rejects a malformed code before calling Supabase', async () => {
    const r = await verifyTotp('f1', '123');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/6-digit/);
  });

  it('verify needs a factor id', async () => {
    expect((await verifyTotp(null, '123456')).ok).toBe(false);
  });

  it('verify succeeds on a valid code', async () => {
    expect((await verifyTotp('f1', '123456')).ok).toBe(true);
  });

  it('status reports disabled when there are no verified factors', async () => {
    const s = await mfaStatus();
    expect(s.enabled).toBe(false);
  });

  it('disable needs a factor id', async () => {
    expect((await disableMfa(null)).ok).toBe(false);
  });
});
