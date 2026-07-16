/**
 * Web Push (VAPID) — the PUBLIC application-server key. Safe to ship in the
 * client (that's its purpose). The matching PRIVATE key lives only as a
 * Supabase function secret (VAPID_PRIVATE_KEY) used by push-notify.
 */
export const WEB_PUSH_PUBLIC_KEY =
  'BFcGNc-yn3m7MgqI1y2e4uAfywbTL3pnkP6CtPTOBz247ddaL2MVZqUe_zBoybkaiiCeRa8uifTnc2zZfJ1VLZU';

/** Convert the base64url VAPID key into the Uint8Array PushManager expects. */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
