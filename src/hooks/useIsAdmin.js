/**
 * useIsAdmin — server-validated admin check with a safe bootstrap fallback.
 *
 * Returns: null while checking · true if admin · false if not.
 *
 * Order of trust:
 *   1. profiles.is_admin (server-controlled flag) — the real boundary.
 *   2. If that column doesn't exist yet, or the query fails, fall back to the
 *      owner email so the owner is NEVER locked out mid-rollout.
 *
 * Once you deploy the is_admin column (scripts/security-rls-fixes.sql §3) and set
 * your own account to is_admin = true, remove OWNER_EMAIL below to fully close
 * the hardcoded-email exposure (SECURITY-AUDIT.md finding #3). Until then the
 * email net keeps the gate working without breaking anything.
 *
 * NOTE: this only controls UI visibility. The true protection for admin actions
 * must live in the admin RPCs / RLS (they must re-check is_admin server-side).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

// Transitional bootstrap only — remove once is_admin is live (see above).
const OWNER_EMAIL = 'asemahlenkwali@gmail.com';

export function useIsAdmin(enabled = true) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      if (!user) { if (alive) setIsAdmin(false); return; }
      const emailNet = user.email === OWNER_EMAIL;
      try {
        const { data, error } = await supabase
          .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        if (!alive) return;
        if (!error && data && typeof data.is_admin === 'boolean') {
          // Server flag is authoritative; email remains a bootstrap safety net.
          setIsAdmin(data.is_admin === true || emailNet);
          return;
        }
      } catch { /* column missing / network — fall through to bootstrap */ }
      if (alive) setIsAdmin(emailNet);
    })();
    return () => { alive = false; };
  }, [user, enabled]);

  return isAdmin;
}

export default useIsAdmin;
