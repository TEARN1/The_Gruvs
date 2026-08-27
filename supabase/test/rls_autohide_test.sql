-- ══════════════════════════════════════════════════════════════════════════════
--  rls_autohide_test.sql — guards the report-driven auto-hide moderation control.
--
--  WHY THIS EXISTS
--  schema_part_4.sql hides reported content (~3 trusted reports) behind
--  RESTRICTIVE RLS policies: events.auto_hidden, reels.auto_hidden,
--  echoes.auto_hidden, profiles.is_auto_hidden. Those policies are the ONLY thing
--  taking abusive content out of public view.
--
--  Two ways that control silently dies:
--    1. A policy gets dropped or renamed by a later migration and nobody notices.
--    2. Something reads the table with the service_role key, which is BYPASSRLS
--       and skips the policy entirely. That is not hypothetical — the og-meta
--       Edge Function did exactly this and served auto-hidden profiles, events and
--       reels to the open internet (and to social crawlers, which cache them).
--
--  This test asserts (1) directly and pins down the behaviour behind (2) so the
--  "service_role must re-filter by hand" rule is proven rather than assumed.
--
--  Run: psql -v ON_ERROR_STOP=1 -f supabase/test/rls_autohide_test.sql
--  (after the schema_part_* files — it inspects the real catalog)
-- ══════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ── 1. service_role must be BYPASSRLS (i.e. it really does skip RLS) ─────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION
      'service_role is not BYPASSRLS — this environment does not model production, '
      'so no RLS test here is trustworthy.';
  END IF;
  RAISE NOTICE 'OK  service_role is BYPASSRLS (matches production)';
END $$;

-- ── 2. Every auto-hide policy must still exist, and still be RESTRICTIVE ─────
-- A PERMISSIVE policy here would be worse than none: permissive policies are
-- OR'd together, so it would widen access instead of narrowing it.
DO $$
DECLARE
  t   record;
  pol record;
  checked int := 0;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('events',   'auto_hidden',    'events_hide_autohidden'),
      ('reels',    'auto_hidden',    'reels_hide_autohidden'),
      ('echoes',   'auto_hidden',    'echoes_hide_autohidden'),
      ('profiles', 'is_auto_hidden', 'profiles_hide_autohidden')
    ) AS v(tbl, col, policyname)
  LOOP
    -- schema_part_4 creates these conditionally; skip what this build lacks.
    CONTINUE WHEN to_regclass('public.' || t.tbl) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t.tbl AND column_name = t.col
    );

    SELECT * INTO pol FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t.tbl AND policyname = t.policyname;

    IF pol IS NULL THEN
      RAISE EXCEPTION
        'MISSING auto-hide policy "%" on public.% — reported content is publicly '
        'visible again.', t.policyname, t.tbl;
    END IF;

    IF pol.permissive <> 'RESTRICTIVE' THEN
      RAISE EXCEPTION
        'Policy "%" on public.% is % — it must be RESTRICTIVE. Permissive policies '
        'are OR''d together, so this widens access instead of restricting it.',
        t.policyname, t.tbl, pol.permissive;
    END IF;

    IF pol.qual IS NULL OR position(t.col in pol.qual) = 0 THEN
      RAISE EXCEPTION
        'Policy "%" on public.% no longer references %.', t.policyname, t.tbl, t.col;
    END IF;

    checked := checked + 1;
    RAISE NOTICE 'OK  % is RESTRICTIVE and gates on %', t.policyname, t.col;
  END LOOP;

  IF checked = 0 THEN
    RAISE EXCEPTION
      'No auto-hide policies were checked at all — schema_part_4.sql did not apply, '
      'or the tables/columns are gone. Failing loudly rather than passing vacuously.';
  END IF;
  RAISE NOTICE 'OK  % auto-hide policies verified', checked;
END $$;

-- ── 3. Behavioural proof, on a throwaway table that mirrors the policy ───────
-- Schema-independent (no FK/NOT NULL coupling to the real tables), so it stays
-- green through schema drift while still proving the semantics the real policies
-- rely on: a normal role cannot see hidden rows, service_role can, and NULL
-- counts as "not hidden" (matching COALESCE(<col>, false) = false).
BEGIN;

CREATE TEMP TABLE autohide_probe (
  id             serial PRIMARY KEY,
  label          text,
  is_auto_hidden boolean
) ON COMMIT DROP;

INSERT INTO autohide_probe (label, is_auto_hidden) VALUES
  ('visible', false),
  ('hidden',  true),
  ('legacy',  NULL);

GRANT SELECT ON autohide_probe TO anon, service_role;
ALTER TABLE autohide_probe ENABLE ROW LEVEL SECURITY;
CREATE POLICY probe_read ON autohide_probe FOR SELECT USING (true);
CREATE POLICY probe_hide ON autohide_probe AS RESTRICTIVE FOR SELECT
  USING (COALESCE(is_auto_hidden, false) = false);

DO $$
DECLARE
  as_anon    text[];
  as_service text[];
  filtered   text[];
BEGIN
  SET LOCAL ROLE anon;
  SELECT array_agg(label ORDER BY label) INTO as_anon FROM autohide_probe;
  RESET ROLE;

  SET LOCAL ROLE service_role;
  SELECT array_agg(label ORDER BY label) INTO as_service FROM autohide_probe;
  -- What an Edge Function has to write by hand to get back to safety.
  SELECT array_agg(label ORDER BY label) INTO filtered
    FROM autohide_probe WHERE COALESCE(is_auto_hidden, false) = false;
  RESET ROLE;

  IF as_anon IS DISTINCT FROM ARRAY['legacy','visible'] THEN
    RAISE EXCEPTION 'anon saw % — expected {legacy,visible}. The RESTRICTIVE '
      'auto-hide policy is not filtering as intended.', as_anon;
  END IF;
  RAISE NOTICE 'OK  anon sees % (hidden row filtered, NULL treated as visible)', as_anon;

  IF NOT (as_service @> ARRAY['hidden']) THEN
    RAISE EXCEPTION 'service_role did NOT see the hidden row (saw %). This test can '
      'no longer prove the bypass it exists to document.', as_service;
  END IF;
  RAISE NOTICE 'OK  service_role sees % — BYPASSRLS skips the policy, as expected', as_service;

  IF filtered IS DISTINCT FROM ARRAY['legacy','visible'] THEN
    RAISE EXCEPTION 'The explicit service_role filter returned % — expected '
      '{legacy,visible}.', filtered;
  END IF;
  RAISE NOTICE 'OK  explicit COALESCE filter restores anon-equivalent visibility';
END $$;

ROLLBACK;

\echo ''
\echo '════════════════════════════════════════════════════════════════════'
\echo ' auto-hide moderation control: VERIFIED'
\echo ' Reminder: anything reading these tables with the service_role key'
\echo ' (Edge Functions) must re-apply COALESCE(<flag>, false) = false itself.'
\echo '════════════════════════════════════════════════════════════════════'
