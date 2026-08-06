-- ═══════════════════════════════════════════════════════════════════════════
-- maintenance_status.sql — who maintains the maintainers?
--
-- data_retention.sql gives the platform purge functions and (optionally) a
-- pg_cron schedule. But if that cron silently stops — extension disabled, job
-- unscheduled, function erroring — nothing notices, and "we delete location
-- data after 90 days" (POPIA s.14) quietly stops being true.
--
-- This RPC is the sensor: one read-only, PII-free snapshot of whether routine
-- maintenance is actually happening. Guardian calls it on the 6-hourly
-- schedule (scripts/audit-maintenance.mjs) and raises the alarm when the
-- platform has stopped cleaning up after itself.
--
-- Returns ONLY aggregates (row ages, counts, booleans) — never rows, never
-- coordinates, never user ids — so granting it to anon is safe: it's exactly
-- what a status page would show.
--
-- Idempotent. Deploy alongside (or after) data_retention.sql.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.maintenance_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_checkins_oldest_days  numeric;
  v_crossings_oldest_days numeric;
  v_cron_enabled          boolean;
  v_cron_jobs             jsonb;
begin
  -- Age of the oldest presence rows. If retention runs, these can never exceed
  -- their windows (90 / 30 days) by more than a scheduling gap.
  select extract(epoch from (now() - min(checked_in_at))) / 86400
    into v_checkins_oldest_days
    from public.live_checkins;

  if to_regclass('public.path_crossings') is not null then
    execute 'select extract(epoch from (now() - min(crossed_at))) / 86400 from public.path_crossings'
      into v_crossings_oldest_days;
  end if;

  -- Is pg_cron even on, and what does it think it's running?
  v_cron_enabled := exists (select 1 from pg_extension where extname = 'pg_cron');

  if v_cron_enabled then
    -- jobname + whether the LAST run succeeded and when. No command bodies —
    -- they can embed literals we'd rather not hand to anon.
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', j.jobname,
             'active', j.active,
             'last_status', r.status,
             'last_run_days_ago',
               round((extract(epoch from (now() - r.start_time)) / 86400)::numeric, 2)
           )), '[]'::jsonb)
      into v_cron_jobs
      from cron.job j
      left join lateral (
        select status, start_time from cron.job_run_details
         where jobid = j.jobid order by start_time desc limit 1
      ) r on true;
  end if;

  return jsonb_build_object(
    'checked_at',              now(),
    'checkins_oldest_days',    round(coalesce(v_checkins_oldest_days, 0), 2),
    'crossings_oldest_days',   round(coalesce(v_crossings_oldest_days, 0), 2),
    'retention_deployed',      to_regclass('public.live_checkins') is not null
                               and exists (select 1 from pg_proc p
                                           join pg_namespace n on n.oid = p.pronamespace
                                           where n.nspname = 'public'
                                             and p.proname = 'purge_stale_location'),
    'cron_enabled',            v_cron_enabled,
    'cron_jobs',               coalesce(v_cron_jobs, '[]'::jsonb)
  );
end;
$$;

-- Status-page semantics: aggregates only, safe for the anon key Guardian uses.
grant execute on function public.maintenance_status() to anon, authenticated;

-- ✅ Check after running:  select maintenance_status();
--    → jsonb with checkins_oldest_days etc. As anon (REST):
--    curl "$SUPABASE_URL/rest/v1/rpc/maintenance_status" -X POST -H "apikey: $ANON"
