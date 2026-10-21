/**
 * doorCode — Touch Down v2: proof of presence with a rotating door code.
 *
 * The host (or a co-host / scanner) shows a 6-digit code on a screen at the
 * door; it changes every 30 seconds and is derived on the server from a secret
 * the app never sees. A guest types it in and the server records the check-in
 * as verify_level 2, "verified at the door".
 * Server side: supabase/migrations/20261007000100_touch_down_v2_door_code.sql.
 */
import { supabase } from './supabase';

const REASONS = {
  wrong_or_expired_code: "That code didn't match. Codes change every 30 seconds — check the screen and try again.",
  too_many_attempts: 'Too many tries. Wait a few minutes, then ask the door for the current code.',
};

/** Host side: the current code and how many seconds it has left. */
export async function getDoorCode(eventId) {
  const { data, error } = await supabase.rpc('get_door_code', { p_event_id: eventId });
  if (error) {
    const msg = /door staff|42501/.test(`${error.message} ${error.code}`)
      ? 'Only the host or door staff can show the door code.'
      : "Couldn't load the door code. Check your connection.";
    throw new Error(msg);
  }
  return { code: String(data?.code || ''), secondsLeft: Number(data?.seconds_left) || 30, period: Number(data?.period) || 30 };
}

/** Keep digits only, max 6. */
export const cleanCode = (raw) => String(raw || '').replace(/\D/g, '').slice(0, 6);

/**
 * Guest side. Returns { ok: true } or { ok: false, message } — never throws for
 * a wrong code, only for being signed out / offline (message set either way).
 */
export async function touchDownWithCode(eventId, rawCode, coords = null) {
  const code = cleanCode(rawCode);
  if (code.length !== 6) return { ok: false, message: 'The door code has 6 digits.' };
  const { data, error } = await supabase.rpc('touch_down_with_code', {
    p_event_id: eventId,
    p_code: code,
    p_lat: Number.isFinite(coords?.latitude) ? coords.latitude : null,
    p_lon: Number.isFinite(coords?.longitude) ? coords.longitude : null,
  });
  if (error) return { ok: false, message: "Couldn't reach the server. Check your signal and try again." };
  if (data?.ok) return { ok: true, level: data.level };
  return { ok: false, message: REASONS[data?.reason] || "That didn't work. Try the current code." };
}
