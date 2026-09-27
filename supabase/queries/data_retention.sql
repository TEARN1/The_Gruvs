-- data_retention.sql — POPIA s.14 minimisation: don't keep location data
-- longer than it's useful.
--
-- The Gruvs holds precise presence data (live_checkins) and, if enabled,
-- path_crossings. Keeping it forever is both a compliance problem and a
-- subpoena/breach liability. These purge functions delete stale location rows.
--
-- Windows are deliberately short — presence is a "right now" signal, not history:
--   • live_checkins   : 90 days  (a footprint stops being relevant well before)
--   • path_crossings  : 30 days  (deliberate crossings; short-lived by design)
--
-- Idempotent. The functions are safe to run manually any time; the pg_cron
-- schedule at the bottom automates them IF the extension is available (Supabase
-- supports pg_cron — enable it in the dashboard first, then uncomment).

create or replace function public.purge_stale_location(retain_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  delete from public.live_checkins
  where checked_in_at < now() - make_interval(days => retain_days);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- path_crossings only if the table exists (feature may be parked).
create or replace function public.purge_stale_crossings(retain_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer := 0;
begin
  if to_regclass('public.path_crossings') is not null then
    execute format(
      'delete from public.path_crossings where created_at < now() - make_interval(days => %L)',
      retain_days
    );
    get diagnostics n = row_count;
  end if;
  return n;
end;
$$;

-- Lock these down — only the service role / cron should purge.
revoke execute on function public.purge_stale_location(integer)  from public, anon, authenticated;
revoke execute on function public.purge_stale_crossings(integer) from public, anon, authenticated;

-- ── Automate daily (requires pg_cron; enable it in Supabase → Database →
--    Extensions, then uncomment). Runs at 03:00 UTC. ────────────────────────────
-- select cron.schedule('gruvs_purge_location',  '0 3 * * *', $$ select public.purge_stale_location(90);  $$);
-- select cron.schedule('gruvs_purge_crossings', '0 3 * * *', $$ select public.purge_stale_crossings(30); $$);
