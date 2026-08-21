-- ═══════════════════════════════════════════════════════════════════════════
-- maintenance_levels.sql — leveled self-maintenance with a paper trail.
--
-- The principle: CADENCE TRACKS CONSEQUENCE.
--   L1 daily  — the legal/safety layer. Data that can hurt a user if it leaks
--               (location history, dead door-credentials, stale push handles,
--               overdue account deletions). Strict watchdog: red on +3 days.
--   L2 weekly — the hygiene layer. Data that only wastes space and slows
--               queries (old notifications, unbounded security_logs, stale
--               analytics snapshots). Lenient watchdog: red on +14 days.
--   L3/L4 are NOT here: L3 (storage orphans) needs an edge function, and L4
--   (drills, restores, audits) must stay human — see SAFETY_MAINTENANCE.md.
--
-- Every run writes to maintenance_runs, so the watchdog reads "L1 ran 26h ago
-- and deleted 1,204 rows" instead of inferring health from data ages. A purge
-- that silently stops is indistinguishable from a purge with nothing to do —
-- unless it logs that it ran.
--
-- Defensive by design: every step checks its table/column exists first, so
-- this file deploys safely at ANY point in the runbook order, before or after
-- data_retention.sql / schema_drift_columns.sql. Missing surface = the step
-- records 0 and moves on; it never errors the whole run.
--
-- Idempotent. Deploy with the runbook; then enable pg_cron in the dashboard.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The paper trail ──────────────────────────────────────────────────────────
create table if not exists public.maintenance_runs (
  id          bigint generated always as identity primary key,
  level       text not null check (level in ('L1','L2','L3')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean not null default false,
  detail      jsonb not null default '{}'::jsonb   -- {step: rows_purged, ...}
);
create index if not exists idx_maintenance_runs_level_time
  on public.maintenance_runs (level, started_at desc);

-- Nobody but the service role / definer functions writes here; anyone may NOT
-- read it directly (the watchdog reads via maintenance_status(), which returns
-- aggregates only).
alter table public.maintenance_runs enable row level security;

-- The log must not become its own bloat: keep a year of history.
-- (Purged by the L2 runner below — maintenance maintains itself.)

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public._col_exists(t text, c text)
returns boolean language sql stable as $$
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = t and column_name = c
  );
$$;

-- ── L1 — DAILY: the legal/safety layer ───────────────────────────────────────
create or replace function public.run_maintenance_l1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id bigint;
  n integer;
  d jsonb := '{}'::jsonb;
begin
  insert into maintenance_runs (level) values ('L1') returning id into run_id;

  -- 1. Location history beyond its retention window (POPIA s.14).
  --    Delegates to data_retention.sql's functions when present, so the
  --    windows live in exactly one place.
  if to_regproc('public.purge_stale_location') is not null then
    select purge_stale_location() into n;
    d := d || jsonb_build_object('live_checkins_purged', coalesce(n, 0));
  end if;
  if to_regproc('public.purge_stale_crossings') is not null then
    select purge_stale_crossings() into n;
    d := d || jsonb_build_object('path_crossings_purged', coalesce(n, 0));
  end if;

  -- 2. Dead door credentials. A used or long-expired QR token is a credential
  --    with no purpose; credentials that shouldn't work shouldn't exist.
  --    30 days of history is kept so "was I there" disputes stay answerable.
  if to_regclass('public.ticket_tokens') is not null then
    if _col_exists('ticket_tokens', 'used_at') then
      delete from ticket_tokens
       where (used_at   is not null and used_at   < now() - interval '30 days')
          or (expires_at is not null and expires_at < now() - interval '30 days');
      get diagnostics n = row_count;
      d := d || jsonb_build_object('ticket_tokens_purged', n);
    end if;
  end if;

  -- 3. Push subscriptions flagged dead by the sender. A stale endpoint is a
  --    delivery failure every time we notify — and an inventory of browser
  --    identities we have no reason to hold.
  if to_regclass('public.web_push_subscriptions') is not null
     and _col_exists('web_push_subscriptions', 'dead_at') then
    delete from web_push_subscriptions where dead_at < now() - interval '7 days';
    get diagnostics n = row_count;
    d := d || jsonb_build_object('dead_push_subs_purged', n);
  end if;

  -- 4. Account deletions past their grace window. The edge function is the
  --    primary path; this is the guarantee that a requested deletion HAPPENS
  --    even if the user never comes back and no human ever looks.
  if _col_exists('profiles', 'deletion_requested_at') then
    if to_regproc('public.execute_account_deletion') is not null then
      -- Prefer the dedicated pipeline when account_deletion.sql is deployed.
      execute 'select count(*) from profiles where deletion_requested_at < now() - interval ''30 days''' into n;
      d := d || jsonb_build_object('deletions_overdue', coalesce(n, 0));
    else
      select count(*) into n from profiles
       where deletion_requested_at < now() - interval '30 days';
      d := d || jsonb_build_object('deletions_overdue', coalesce(n, 0));
    end if;
    -- NOTE: overdue deletions are REPORTED, not auto-executed here — erasing an
    -- account is L4-grade consequence and runs through the dedicated pipeline.
    -- The watchdog goes red when this count is > 0 for days.
  end if;

  update maintenance_runs
     set finished_at = now(), ok = true, detail = d
   where id = run_id;
  return d;
exception when others then
  update maintenance_runs
     set finished_at = now(), ok = false,
         detail = d || jsonb_build_object('error', SQLERRM)
   where id = run_id;
  raise;
end;
$$;

-- ── L2 — WEEKLY: the hygiene layer ───────────────────────────────────────────
create or replace function public.run_maintenance_l2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id bigint;
  n integer;
  d jsonb := '{}'::jsonb;
begin
  insert into maintenance_runs (level) values ('L2') returning id into run_id;

  -- 1. Notifications: read ones after 30d, everything after 90d. Pings are a
  --    "this week" surface, not an archive.
  if to_regclass('public.notifications') is not null then
    if _col_exists('notifications', 'read') then
      delete from notifications
       where (read = true and created_at < now() - interval '30 days')
          or created_at < now() - interval '90 days';
    else
      delete from notifications where created_at < now() - interval '90 days';
    end if;
    get diagnostics n = row_count;
    d := d || jsonb_build_object('notifications_purged', n);
  end if;

  -- 2. security_logs: unbounded today. 180 days is enough to investigate any
  --    incident that anyone actually notices; forever is a liability.
  if to_regclass('public.security_logs') is not null then
    delete from security_logs where created_at < now() - interval '180 days';
    get diagnostics n = row_count;
    d := d || jsonb_build_object('security_logs_purged', n);
  end if;

  -- 3. Analytics snapshots older than a year — trends read weeks, not years.
  if to_regclass('public.event_analytics_snapshots') is not null then
    delete from event_analytics_snapshots
     where snapshot_time < now() - interval '365 days';
    get diagnostics n = row_count;
    d := d || jsonb_build_object('analytics_snapshots_purged', n);
  end if;

  -- 4. The maintenance log itself: keep one year. Self-maintaining maintenance.
  delete from maintenance_runs where started_at < now() - interval '365 days';
  get diagnostics n = row_count;
  d := d || jsonb_build_object('maintenance_runs_purged', n);

  -- 5. Leaderboard snapshot refresh (the one commented out in schema_part_2) —
  --    only if the matview exists.
  if exists (select 1 from pg_matviews where matviewname = 'leaderboard_snapshot') then
    refresh materialized view concurrently leaderboard_snapshot;
    d := d || jsonb_build_object('leaderboard_refreshed', true);
  end if;

  update maintenance_runs
     set finished_at = now(), ok = true, detail = d
   where id = run_id;
  return d;
exception when others then
  update maintenance_runs
     set finished_at = now(), ok = false,
         detail = d || jsonb_build_object('error', SQLERRM)
   where id = run_id;
  raise;
end;
$$;

-- ── maintenance_status() v2 — per-level, reads the paper trail ───────────────
create or replace function public.maintenance_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_l1 record;
  v_l2 record;
  v_checkins_oldest_days  numeric;
  v_crossings_oldest_days numeric;
  v_deletions_overdue     integer := 0;
  v_cron_enabled          boolean;
  v_cron_jobs             jsonb;
begin
  select started_at, ok, detail into v_l1
    from maintenance_runs where level = 'L1' order by started_at desc limit 1;
  select started_at, ok, detail into v_l2
    from maintenance_runs where level = 'L2' order by started_at desc limit 1;

  -- Belt-and-braces: even with a log, verify the OUTCOME. A runner that logs
  -- "ok" but purges nothing (window bug, wrong column) is caught by the ages.
  select extract(epoch from (now() - min(checked_in_at))) / 86400
    into v_checkins_oldest_days from public.live_checkins;
  if to_regclass('public.path_crossings') is not null then
    execute 'select extract(epoch from (now() - min(crossed_at))) / 86400 from public.path_crossings'
      into v_crossings_oldest_days;
  end if;
  if _col_exists('profiles', 'deletion_requested_at') then
    select count(*) into v_deletions_overdue from profiles
     where deletion_requested_at < now() - interval '30 days';
  end if;

  v_cron_enabled := exists (select 1 from pg_extension where extname = 'pg_cron');
  if v_cron_enabled then
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', j.jobname, 'active', j.active, 'last_status', r.status,
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
    'checked_at',            now(),
    'levels', jsonb_build_object(
      'L1', case when v_l1 is null then null else jsonb_build_object(
              'last_run_days_ago', round((extract(epoch from (now() - v_l1.started_at)) / 86400)::numeric, 2),
              'ok', v_l1.ok, 'detail', v_l1.detail) end,
      'L2', case when v_l2 is null then null else jsonb_build_object(
              'last_run_days_ago', round((extract(epoch from (now() - v_l2.started_at)) / 86400)::numeric, 2),
              'ok', v_l2.ok, 'detail', v_l2.detail) end
    ),
    'checkins_oldest_days',  round(coalesce(v_checkins_oldest_days, 0), 2),
    'crossings_oldest_days', round(coalesce(v_crossings_oldest_days, 0), 2),
    'deletions_overdue',     v_deletions_overdue,
    'retention_deployed',    to_regproc('public.purge_stale_location') is not null,
    'levels_deployed',       true,
    'cron_enabled',          v_cron_enabled,
    'cron_jobs',             coalesce(v_cron_jobs, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.maintenance_status() to anon, authenticated;
-- The runners are cron/service-role only — never client-callable.
revoke execute on function public.run_maintenance_l1() from public, anon, authenticated;
revoke execute on function public.run_maintenance_l2() from public, anon, authenticated;

-- ── Schedules (needs the pg_cron extension enabled in the dashboard) ─────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 04:10 local-quiet daily; Sunday 04:40 weekly.
    perform cron.unschedule(jobid) from cron.job where jobname in ('gruvs-maintenance-l1','gruvs-maintenance-l2');
    perform cron.schedule('gruvs-maintenance-l1', '10 2 * * *', 'select public.run_maintenance_l1()');
    perform cron.schedule('gruvs-maintenance-l2', '40 2 * * 0', 'select public.run_maintenance_l2()');
  else
    raise notice 'pg_cron not enabled — schedules skipped. Enable the extension in the dashboard, then re-run this file.';
  end if;
end $$;

-- ✅ Check after running:
--   select run_maintenance_l1();   -- as service role: jsonb of purge counts
--   select maintenance_status();   -- levels.L1.last_run_days_ago ≈ 0
