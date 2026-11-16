/**
 * useIsAdmin — server-validated admin check with a safe bootstrap fallback.
 *
 * Returns: null while checking · true if admin · false if not.
 *
 * Trust: profiles.role = 'admin' (server-controlled) — the real boundary, and
 * the same column the talent + security RLS policies check, so the client and
 * the DB agree. Anything else (query error, missing column, no session) resolves
 * to false: this gate fails CLOSED.
 *
 * The hardcoded-owner-email fallback that used to live here is gone — that was
 * SECURITY-AUDIT.md finding #3 (the owner's real email shipped in the public web
 * bundle). Do not reintroduce it; grant access with `profiles.role = 'admin'`.
 *
 * NOTE: this only controls UI visibility. The true protection for admin actions
 * must live in the admin RPCs / RLS (they must re-check role server-side).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

export function useIsAdmin(enabled = true) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      if (!user) { if (alive) setIsAdmin(false); return; }
      try {
        // Live schema uses profiles.role ('admin'); this is also what the talent
        // + security RLS policies check, so the client and DB agree.
        const { data, error } = await supabase
          .from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (!alive) return;
        if (!error && data && typeof data.role === 'string') {
          setIsAdmin(data.role === 'admin');
          return;
        }
      } catch { /* column missing / network — fall through to default */ }
      if (alive) setIsAdmin(false);
    })();
    return () => { alive = false; };
  }, [user, enabled]);

  return isAdmin;
}

export default useIsAdmin;
