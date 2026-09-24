/**
 * referral — make an invite link actually attach someone to whoever invited them.
 *
 * ReferralCard has been handing out ?ref= links, and the door-sign QR
 * (BD_PLAYBOOK §4.5) puts one on a physical sign at a venue — but nothing read
 * the parameter, so every invite and every door scan attributed to nobody.
 *
 * Two steps, deliberately split: the landing page CAPTURES the code (the visitor
 * usually isn't signed up yet — that's the whole point), and the claim happens
 * after their profile exists. The gap between those is why it's persisted.
 */
import { supabase } from './supabase';
import { refFromUrl } from '../utils/doorCode';

const KEY = 'gruvs_pending_ref_v1';

const store = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch { /* private mode / storage blocked */ }
  return null;
})();

/** Read ?ref= off the landing URL and hold it until the user has a profile. */
export function captureRef(url) {
  const href = url ?? (typeof window !== 'undefined' ? window.location?.href : null);
  const code = refFromUrl(href);
  if (!code || !store) return null;
  try {
    // First link wins. Someone who arrived through a host's door sign and later
    // clicks a different link still belongs to the host who actually brought them.
    if (!store.getItem(KEY)) store.setItem(KEY, code);
  } catch { /* storage full/blocked — attribution is best-effort, never blocking */ }
  return code;
}

/**
 * Attach the signed-in user to their referrer. Safe to call on every sign-in:
 * claim_referral only succeeds on the first claim, so a repeat is a no-op rather
 * than a way to inflate someone's referral count.
 */
export async function claimPendingRef() {
  if (!store) return false;
  let code = null;
  try { code = store.getItem(KEY); } catch { return false; }
  if (!code) return false;
  try {
    const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
    // Clear on a definitive answer (claimed, or refused as already-attributed /
    // unknown code). Only a transport error keeps it for the next sign-in.
    if (!error) {
      try { store.removeItem(KEY); } catch { /* nothing we can do */ }
      return data === true;
    }
  } catch { /* offline — try again next sign-in */ }
  return false;
}

export default { captureRef, claimPendingRef };
