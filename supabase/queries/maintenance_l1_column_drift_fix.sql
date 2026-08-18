-- Found 2026-08-18 via Guardian workflow's "Maintenance" job failing on main +
-- a live schema-drift check. purge_stale_crossings() referenced
-- path_crossings.created_at, which does not exist (real column: crossed_at —
-- same drift class already fixed client-side in trustLedger.js, but this DB
-- function slipped through). run_maintenance_l1() bundles every purge step in
-- one transaction and re-raises on error, so this single wrong column name
-- silently rolled back EVERY nightly maintenance run since at least
-- 2026-08-14 — including the live_checkins purge, which is why check-ins had
-- rows 91+ days old despite the cron job "running" every night.
--
-- Verified live: SELECT run_maintenance_l1() now succeeds and actually purges.
CREATE OR REPLACE FUNCTION public.purge_stale_crossings(retain_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare n integer := 0;
begin
  if to_regclass('public.path_crossings') is not null then
    execute format(
      'delete from public.path_crossings where crossed_at < now() - make_interval(days => %L)',
      retain_days
    );
    get diagnostics n = row_count;
  end if;
  return n;
end;
$function$;
