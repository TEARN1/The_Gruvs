/**
 * useIsAdmin — server-validated admin check with a safe bootstrap fallback.
 *
 * Returns: null while checking · true if admin · false if not.
 *
 * Order of trust:
 *   1. profiles.role = 'admin' (server-controlled) — the real boundary. This is
 *      the column the live DB has and the talent + security RLS policies check.
 *   2. If that query fails, fall back to the owner email so the owner is NEVER
 *      locked out mid-rollout.
 *
 * Once your account is set to role = 'admin', remove OWNER_EMAIL below to fully
 * close the hardcoded-email exposure (SECURITY-AUDIT.md finding #3). Until then
 * the email net keeps the gate working without breaking anything.
 *
 * NOTE: this only controls UI visibility. The true protection for admin actions
 * must live in the admin RPCs / RLS (they must re-check role server-side).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

// Transitional bootstrap only — remove once your account has role = 'admin'.
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
        // Live schema uses profiles.role ('admin'); this is also what the talent
        // + security RLS policies check, so the client and DB agree.
        const { data, error } = await supabase
          .from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (!alive) return;
        if (!error && data && typeof data.role === 'string') {
          // Server role is authoritative; email remains a bootstrap safety net.
          setIsAdmin(data.role === 'admin' || emailNet);
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
