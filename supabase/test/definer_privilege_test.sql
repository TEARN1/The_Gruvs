-- ══════════════════════════════════════════════════════════════════════════════
--  definer_privilege_test.sql — guards two classes of privilege bug that both
--  shipped to production undetected. See SECURITY-AUDIT.md #22 and #23.
--
--  CLASS 1 — a SECURITY DEFINER function granted to a client role that takes a
--  target-user / target-row argument and never consults auth.uid(). DEFINER runs
--  as the owner and bypasses RLS, so such a grant hands every signed-in user the
--  owner's privileges over any row they can name. Four of these were live:
--  increment_wallet_balance, update_sis_score, soft_delete, restore_deleted.
--
--  CLASS 2 — a guard TRIGGER declared SECURITY DEFINER that tests `current_user`.
--  Inside a SECURITY DEFINER function `current_user` is the OWNER, not the
--  caller, so the guard never engages. protect_profile_trust_columns() shipped
--  this way and never pinned a single column — role='admin' was self-assignable.
--
--  Run: psql -v ON_ERROR_STOP=1 -f supabase/test/definer_privilege_test.sql
-- ══════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ── CLASS 2 first: any trigger guard that reads current_user must be INVOKER ──
DO $$
DECLARE r record; bad int := 0;
BEGIN
  FOR r IN
    SELECT p.proname, p.prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prorettype = 'trigger'::regtype
       AND p.prosrc ~ 'current_user'
  LOOP
    IF r.prosecdef THEN
      bad := bad + 1;
      RAISE WARNING
        'Trigger function %() is SECURITY DEFINER and tests current_user. Inside a '
        'SECURITY DEFINER function current_user is the OWNER, not the caller, so '
        'the guard can never engage. Declare it SECURITY INVOKER.', r.proname;
    ELSE
      RAISE NOTICE 'OK  %() is SECURITY INVOKER — current_user is the real caller', r.proname;
    END IF;
  END LOOP;

  IF bad > 0 THEN
    RAISE EXCEPTION '% trigger guard(s) can never fire — see the warnings above.', bad;
  END IF;
END $$;

-- ── CLASS 1: no client-executable DEFINER function may skip the caller check ──
DO $$
DECLARE r record; bad int := 0;
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef                                   -- SECURITY DEFINER
       AND p.prosrc !~ 'auth\.uid'                       -- never checks the caller
       AND p.prosrc ~* '\m(update|insert|delete)\M'      -- and writes something
       -- takes an argument naming someone/something other than the caller
       AND pg_get_function_identity_arguments(p.oid) ~*
             '\m(p_user_id|p_user|user_id|u_id|p_uid|p_target|target_user_id|p_owner|p_profile_id|p_table)\M'
       AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
         OR has_function_privilege('anon',          p.oid, 'EXECUTE'))
  LOOP
    bad := bad + 1;
    RAISE WARNING
      'public.%(%) is SECURITY DEFINER, writes, takes a target argument, never '
      'checks auth.uid(), and is EXECUTE-able by a client role. Any signed-in '
      'user can run it against any row they can name.', r.proname, r.args;
  END LOOP;

  IF bad > 0 THEN
    RAISE EXCEPTION
      '% client-executable SECURITY DEFINER function(s) have no caller check. '
      'Either add an auth.uid() check or REVOKE from anon/authenticated '
      '(see supabase/queries/definer_rpc_hardening.sql).', bad;
  END IF;
  RAISE NOTICE 'OK  no client-executable SECURITY DEFINER writer skips the caller check';
END $$;

\echo ''
\echo '════════════════════════════════════════════════════════════════════'
\echo ' DEFINER privilege guards: VERIFIED'
\echo '════════════════════════════════════════════════════════════════════'
