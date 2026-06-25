/**
 * PanicMode — the discreet "disappear now" safety action (#136).
 * One call makes a user vanish from every presence surface at once:
 *   • identity → ghost (uncrossable, anonymous)
 *   • is_discoverable → false (drops out of Find Them / targeting)
 *   • beacon off
 *   • all live check-ins deleted (removed from every "here now" / Crossed Paths)
 * Reversible via restore(). No paid services — just profile + presence writes.
 */
import { supabase } from './supabase';

// Exported for testing + reuse — the exact state changes each action makes.
export const PANIC_PATCH   = { identity_mode: 'ghost',  is_discoverable: false, is_beacon_active: false };
export const RESTORE_PATCH = { identity_mode: 'public', is_discoverable: true };

export const PanicMode = {
  async disappear(userId) {
    if (!userId) return { ok: false };
    let ok = true;
    try {
      const { error } = await supabase.from('profiles').update(PANIC_PATCH).eq('id', userId);
      if (error) throw error;
    } catch { ok = false; }
    // Wipe live presence so they leave every "here now" list immediately.
    try { await supabase.from('live_checkins').delete().eq('user_id', userId); } catch { /* best-effort */ }
    return { ok };
  },

  async restore(userId, mode = 'public') {
    if (!userId) return { ok: false };
    try {
      const { error } = await supabase.from('profiles')
        .update({ ...RESTORE_PATCH, identity_mode: mode || 'public' }).eq('id', userId);
      if (error) throw error;
      return { ok: true };
    } catch { return { ok: false }; }
  },
};
