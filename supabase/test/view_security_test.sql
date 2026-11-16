-- ══════════════════════════════════════════════════════════════════════════════
--  view_security_test.sql — pins how each public view resolves row visibility.
--
--  A Postgres view runs with the privileges of its OWNER unless
--  `security_invoker = true`. So the setting decides whether the view respects
--  the caller's RLS or bypasses it — and it is NOT inherited through
--  CREATE OR REPLACE. Any later redefinition silently resets it to the default
--  (definer). definer_views_audit.sql found exactly that regression on
--  public_profiles and left it unsolved: "Any future CREATE OR REPLACE will
--  revert it again." This test is the fix — it makes the intent enforceable
--  instead of a comment.
--
--  Both directions are bugs:
--    • a view that SHOULD be invoker flipping to definer  → bypasses RLS, leaks
--    • public_profiles flipping to invoker                → `anon` has no SELECT
--      policy on profiles, so it errors "permission denied for table profiles"
--      on every signed-out page load and guest browsing dies
--
--  Run: psql -v ON_ERROR_STOP=1 -f supabase/test/view_security_test.sql
-- ══════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

DO $$
DECLARE
  v        record;
  invoker  boolean;
  expected boolean;
  checked  int := 0;
BEGIN
  FOR v IN
    SELECT * FROM (VALUES
      -- view name          , must be security_invoker?
      -- DEFINER on purpose: the curated column list is the control, and anon
      -- cannot read public.profiles directly. Flipping this breaks guests.
      ('public_profiles'    , false)
    ) AS t(viewname, want_invoker)
  LOOP
    CONTINUE WHEN to_regclass('public.' || v.viewname) IS NULL;

    SELECT COALESCE(
             (SELECT option_value = 'true'
                FROM pg_options_to_table(c.reloptions)
               WHERE option_name = 'security_invoker'),
             false)
      INTO invoker
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v.viewname AND c.relkind = 'v';

    expected := v.want_invoker;

    IF invoker IS DISTINCT FROM expected THEN
      IF expected THEN
        RAISE EXCEPTION
          'View public.% is SECURITY DEFINER but must be security_invoker. A '
          'definer view bypasses the caller''s RLS and returns every row. Most '
          'likely a CREATE OR REPLACE dropped the option — re-assert it in the '
          'LAST file that defines the view.', v.viewname;
      ELSE
        RAISE EXCEPTION
          'View public.% has security_invoker=true but must stay DEFINER. anon '
          'has no SELECT policy on the underlying table, so an invoker view '
          'fails with "permission denied" for every signed-out visitor. See '
          'supabase/queries/definer_views_audit.sql.', v.viewname;
      END IF;
    END IF;

    checked := checked + 1;
    RAISE NOTICE 'OK  public.% is % (as intended)',
      v.viewname, CASE WHEN invoker THEN 'security_invoker' ELSE 'security_definer' END;
  END LOOP;

  IF checked = 0 THEN
    RAISE EXCEPTION
      'No views were checked — the pinned views are missing from this build. '
      'Failing loudly rather than passing vacuously.';
  END IF;
  RAISE NOTICE 'OK  % view(s) match their intended visibility mode', checked;
END $$;

-- ── Inventory: any OTHER anon-readable definer view is an unreviewed decision ──
-- Not fatal (definer_views_audit.sql documents several live views this build
-- does not create), but surfaced on every run so new ones get triaged instead
-- of accumulating silently.
DO $$
DECLARE v record; n int := 0;
BEGIN
  FOR v IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n2 ON n2.oid = c.relnamespace
     WHERE n2.nspname = 'public'
       AND c.relkind = 'v'
       AND c.relname <> 'public_profiles'
       AND COALESCE((SELECT option_value FROM pg_options_to_table(c.reloptions)
                      WHERE option_name = 'security_invoker'), 'false') = 'false'
       AND has_table_privilege('anon', c.oid, 'SELECT')
     ORDER BY c.relname
  LOOP
    n := n + 1;
    RAISE WARNING
      'public.% is an anon-readable SECURITY DEFINER view — it bypasses RLS for '
      'signed-out callers. Triage it in definer_views_audit.sql, then pin it in '
      'the table at the top of this file.', v.relname;
  END LOOP;
  IF n = 0 THEN
    RAISE NOTICE 'OK  no unreviewed anon-readable definer views';
  ELSE
    RAISE NOTICE '% anon-readable definer view(s) need triage (warning only)', n;
  END IF;
END $$;

\echo ''
\echo '════════════════════════════════════════════════════════════════════'
\echo ' View visibility modes: VERIFIED'
\echo '════════════════════════════════════════════════════════════════════'
