-- ═══════════════════════════════════════════════════════════════════════════
-- advisor_hardening_2026-08-13.sql — clears the actionable findings from
-- Supabase's security advisor (get_advisors). Run once in the SQL Editor.
--
-- Full advisor sweep: 291 lints, of which 260 were WARN and mostly benign
-- noise (230 "authenticated can execute this RPC" informational, 30
-- "RLS enabled, no policy" on tables that grepping src/ confirms are DEAD
-- SCHEMA — no `.from(...)` call anywhere touches achievements/blocks/
-- comments/groups/mutes/etc; the live features use user_blocks/reel_comments/
-- crews/muted_users instead. Locked-not-leaked, and unused, so left alone).
--
-- What actually needed fixing:
--
-- 1) function_search_path_mutable (4 functions) — _col_exists, distance_bucket,
--    geo_km, res_check_status_duration had no pinned search_path. Same class
--    of fix as pin_res_distance_m_search_path.sql. distance_bucket/geo_km are
--    pure math (search_path=''); _col_exists fully-qualifies its one table
--    ref (search_path=''); res_check_status_duration references
--    res_infra_partner_admins UNQUALIFIED, so it needs search_path='public'
--    (an empty search_path would break the lookup).
--
-- 2) record_event_view — the ONLY anon-executable SECURITY DEFINER function
--    that did NOT guard against auth.uid() IS NULL before writing. Every
--    sibling write RPC (bump_meal_view, report_map, verify_map_report,
--    res_report_status) either no-ops or raises for anon; this one didn't,
--    so an anonymous caller could INSERT rows with user_id=NULL. Postgres
--    treats NULL <> NULL in unique constraints, so ON CONFLICT (user_id,
--    event_id) never dedupes anon rows — unauthenticated callers could spam
--    event_views without limit (table bloat + skewed personalization
--    signal). Fixed with the same early-return guard bump_meal_view already
--    uses, plus REVOKE EXECUTE FROM anon (view-dwell tracking is only ever
--    called from the signed-in client anyway — personalizationEngine.js).
--
-- 3) rls_disabled_in_public (ERROR) on spatial_ref_sys — PostGIS's own SRID
--    reference table (static, no PII, ~8500 rows of projection metadata).
--    Owned by supabase_admin, not the SQL-editor role (same ownership wall
--    as storage.objects, see [[feedback_sql_workflow]] history) — wrapped in
--    DO/EXCEPTION so this skips with a NOTICE instead of aborting the file
--    if the grant isn't there.
--
-- Reviewed and deliberately LEFT ALONE:
-- - is_admin(uuid) is anon-executable, which looks like an admin-status
--   enumeration leak at first glance — but it's actually called FROM WITHIN
--   4 anon-facing RLS policies (echoes/events/profiles/reels
--   *_hide_autohidden), so anon truly needs EXECUTE for public browsing to
--   work at all. Revoking it would break the public feed for logged-out
--   users. Confirmed via pg_policies before deciding.
-- - boost_meal/bump_meal_view/report_map/verify_map_report/res_report_status
--   are anon-executable but already self-guard (raise or no-op on
--   auth.uid() IS NULL) — functionally safe, just a looser grant than
--   necessary. Not tightened this pass; flagged for a future cleanup if
--   wanted, lower priority than record_event_view's actual dedup bug.
-- - leaderboard_snapshot (materialized_view_in_api) exposes only
--   already-public profile fields (username/avatar/vibe_score/city) — an
--   intentional public leaderboard, not a leak.
-- - extension_in_public (postgis/vector/pg_trgm/unaccent) and
--   auth_leaked_password_protection are known, dashboard-only /
--   move-with-care items already tracked in [[project_security_hardening]].
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Pin search_path on the 4 flagged functions.
CREATE OR REPLACE FUNCTION public.distance_bucket(p_km double precision)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN p_km IS NULL THEN NULL
    WHEN p_km <  1  THEN 'under 1 km'
    WHEN p_km <  5  THEN '1-5 km'
    WHEN p_km < 20  THEN '5-20 km'
    WHEN p_km < 50  THEN '20-50 km'
    ELSE 'over 50 km'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.geo_km(p_lat1 double precision, p_lon1 double precision, p_lat2 double precision, p_lon2 double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT 6371 * acos(
    least(1, greatest(-1,
      cos(radians(p_lat1)) * cos(radians(p_lat2)) *
      cos(radians(p_lon2) - radians(p_lon1)) +
      sin(radians(p_lat1)) * sin(radians(p_lat2))
    ))
  );
$function$;

CREATE OR REPLACE FUNCTION public._col_exists(t text, c text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = t and column_name = c
  );
$function$;

CREATE OR REPLACE FUNCTION public.res_check_status_duration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
begin
  if new.source = 'crowd' and new.ends_at is not null
     and new.ends_at < new.starts_at + interval '8 hours' then
    raise exception 'crowd reports must cover at least an 8 hour window';
  end if;
  if new.source = 'official' then
    if new.provider_id is null then
      raise exception 'official reports must reference a provider';
    end if;
    if not exists (
      select 1 from res_infra_partner_admins
       where provider_id = new.provider_id and user_id = auth.uid()
    ) then
      raise exception 'not an admin for this provider';
    end if;
  end if;
  return new;
end;
$function$;

-- 2) record_event_view: guard against anon writes with NULL user_id, and
--    stop granting anon a reason to call it at all.
CREATE OR REPLACE FUNCTION public.record_event_view(p_event_id uuid, p_dwell_ms bigint DEFAULT 0, p_opened boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.event_views (user_id, event_id, dwell_ms, view_count, opened, updated_at)
  VALUES (auth.uid(), p_event_id, GREATEST(0, p_dwell_ms), 1, p_opened, now())
  ON CONFLICT (user_id, event_id) DO UPDATE
    SET dwell_ms   = public.event_views.dwell_ms + GREATEST(0, p_dwell_ms),
        view_count = public.event_views.view_count + 1,
        opened     = public.event_views.opened OR p_opened,
        updated_at = now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_event_view(uuid, bigint, boolean) FROM anon;

-- 3) spatial_ref_sys — PostGIS system table, owned by supabase_admin.
--    Best-effort: enable RLS + allow public read (it's non-sensitive SRID
--    metadata everyone needs for geometry to work). Skips cleanly if the
--    SQL-editor role isn't permitted to alter an extension-owned table.
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS spatial_ref_sys_public_read ON public.spatial_ref_sys;
  CREATE POLICY spatial_ref_sys_public_read ON public.spatial_ref_sys
    FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'spatial_ref_sys: skipped (%), likely owned by supabase_admin — fix from Dashboard if needed', SQLERRM;
END $$;
