/**
 * mfa — user-facing two-factor authentication (TOTP), item #997/#950.
 *
 * Wraps Supabase's MFA API into the four things the UI needs: enroll (get a QR +
 * secret), verify (confirm the 6-digit code), status (is 2FA on?), and disable.
 * A user who turns this on can't be taken over by a stolen/reused password alone
 * — the single biggest account-security upgrade available to them.
 *
 * Thin + guarded: every call returns { ok, ... } and never throws, so the UI can
 * message cleanly. The pure isValidTotpCode() is unit-tested; the enroll/verify
 * round-trips need a live smoke-test (they talk to Supabase Auth).
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';

/** A TOTP code is exactly 6 digits. Reject early so we don't waste a challenge. */
export function isValidTotpCode(code) {
  return /^\d{6}$/.test(String(code || '').trim());
}

/** Start enrollment → returns the QR (otpauth URI) + secret for the authenticator app. */
export async function enrollTotp(friendlyName = 'The Gruvs') {
  try {
    // A stale unverified factor of the same name blocks re-enrolment — clear it.
    try {
      const { data: list } = await supabase.auth.mfa.listFactors();
      const stale = (list?.totp || []).find((f) => f.status === 'unverified');
      if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });
    } catch { /* best-effort cleanup */ }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
    if (error) throw error;
    return {
      ok: true,
      factorId: data.id,
      uri: data.totp?.uri || null,       // otpauth://… → render as a QR
      secret: data.totp?.secret || null, // for manual entry
      qrSvg: data.totp?.qr_code || null, // Supabase-rendered SVG (web)
    };
  } catch (e) {
    logError('Mfa.enroll', e);
    return { ok: false, error: e?.message || 'Could not start 2FA setup.' };
  }
}

/** Confirm the code from the authenticator app → completes enrolment. */
export async function verifyTotp(factorId, code) {
  if (!factorId) return { ok: false, error: 'Start setup first.' };
  if (!isValidTotpCode(code)) return { ok: false, error: 'Enter the 6-digit code from your app.' };
  try {
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) throw chErr;
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
    if (error) throw error;   // wrong code → surfaced to the user
    return { ok: true };
  } catch (e) {
    logError('Mfa.verify', e, { code: 'redacted' });
    return { ok: false, error: e?.message || 'That code didn’t match — try again.' };
  }
}

/** Is 2FA currently enabled for this user? */
export async function mfaStatus() {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    const verified = (data?.totp || []).filter((f) => f.status === 'verified');
    return { ok: true, enabled: verified.length > 0, factorId: verified[0]?.id || null };
  } catch (e) {
    logError('Mfa.status', e);
    return { ok: false, enabled: false, factorId: null };
  }
}

/** Turn 2FA off. */
export async function disableMfa(factorId) {
  if (!factorId) return { ok: false, error: 'No 2FA factor to remove.' };
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    logError('Mfa.disable', e);
    return { ok: false, error: e?.message || 'Could not turn off 2FA.' };
  }
}

export default { isValidTotpCode, enrollTotp, verifyTotp, mfaStatus, disableMfa };
