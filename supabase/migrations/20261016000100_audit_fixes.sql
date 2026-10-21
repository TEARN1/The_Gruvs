-- ═════════════════════════════════════════════════════════════════════════════
--  20261016000100_audit_fixes.sql — three live holes found by the 2026-10-16
--  audit. Each section is guarded and idempotent: it runs cleanly twice, and on
--  a database that lacks any of the objects (the CI throwaway schema).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. soft_delete / restore_deleted: any signed-in user could delete anything ─
-- Both are SECURITY DEFINER (bypass RLS), granted to `authenticated`, and run
--   UPDATE public.<p_table> SET deleted_at = now() WHERE id = <p_id>
-- with no ownership check — so any account could hide anyone's event, reel or
-- message (and un-delete what an owner removed on purpose). The app has no
-- caller of either. 20260927000200_definer_rpc_hardening.sql revokes these too,
-- but that file has not been applied to production; this is the urgent part
-- on its own.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('soft_delete', 'restore_deleted')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', r.sig);
    RAISE NOTICE 'revoked client access to %', r.sig;
  END LOOP;
END $$;

-- ── 2. path_traces: everyone's movement trail was world-readable ──────────────
-- "Path traces readable" is SELECT ... USING (true) for role public, and anon
-- holds column SELECT on lat/lon — a logged-out visitor could page through
-- every user's trail. The app only ever inserts here (PathMapScreen); owners
-- keep reading their own rows through "Users manage own traces".
DO $$
BEGIN
  IF to_regclass('public.path_traces') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Path traces readable" ON public.path_traces;
  END IF;
END $$;

-- ── 3. events_in_bbox failed for every signed-out visitor ─────────────────────
-- It is SECURITY INVOKER and counts rows in live_checkins, which anon may not
-- read — so the map's tier-1 query died with 42501 and every guest fell back to
-- the slower client-side query. Only the per-event COUNT is needed, so expose
-- exactly that through a narrow definer helper and keep events_in_bbox an
-- invoker (events RLS — auto-hide included — still applies to the pins).
DO $$
BEGIN
  IF to_regclass('public.live_checkins') IS NULL THEN
    RAISE NOTICE 'skip event_here_counts: no live_checkins table';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.event_here_counts()
    RETURNS TABLE(event_id uuid, n bigint)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $body$
      SELECT lc.event_id, COUNT(*)::bigint
        FROM public.live_checkins lc
       WHERE lc.event_id IS NOT NULL
       GROUP BY lc.event_id;
    $body$
  $fn$;
  REVOKE ALL ON FUNCTION public.event_here_counts() FROM public;
  GRANT EXECUTE ON FUNCTION public.event_here_counts() TO anon, authenticated;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.events_in_bbox(double precision,double precision,double precision,double precision,integer)') IS NULL
     OR to_regprocedure('public.event_here_counts()') IS NULL THEN
    RAISE NOTICE 'skip events_in_bbox: function or helper not present';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.events_in_bbox(
      p_west double precision, p_south double precision,
      p_east double precision, p_north double precision,
      p_limit integer DEFAULT 300)
    RETURNS TABLE(id uuid, title text, category text, cover_url text, venue_name text,
                  lat double precision, lon double precision, going integer,
                  event_date date, here_count bigint)
    LANGUAGE sql
    STABLE
    SET search_path TO 'public'
    AS $body$
      SELECT
        e.id, e.title, e.category, e.cover_url, e.venue_name,
        COALESCE(e.lat, e.latitude)  AS lat,
        COALESCE(e.lon, e.longitude) AS lon,
        e.going, e.event_date,
        COALESCE(c.n, 0) AS here_count
      FROM public.events e
      LEFT JOIN public.event_here_counts() c ON c.event_id = e.id
      WHERE e.event_date >= CURRENT_DATE
        AND e.deleted_at IS NULL
        AND COALESCE(e.lat, e.latitude) IS NOT NULL
        AND COALESCE(e.lon, e.longitude) IS NOT NULL
        AND COALESCE(e.lat, e.latitude) BETWEEN p_south AND p_north
        AND (
          (p_west <= p_east AND COALESCE(e.lon, e.longitude) BETWEEN p_west AND p_east)
          OR
          (p_west >  p_east AND (COALESCE(e.lon, e.longitude) >= p_west OR COALESCE(e.lon, e.longitude) <= p_east))
        )
      ORDER BY COALESCE(c.n, 0) DESC, e.event_date ASC
      LIMIT GREATEST(1, LEAST(p_limit, 1000));
    $body$
  $fn$;
END $$;
