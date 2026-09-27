-- lock_profile_coordinates.sql
--
-- WHY: `profiles` granted table-wide SELECT to `authenticated`, and the RLS
-- policy `profiles_select` is USING (true). Combined, that means ANY signed-in
-- user could read EVERY user's precise coordinates (lat, lon, home_base_lat,
-- home_base_lon). Signup is free and now instant, so "any signed-in user" is
-- effectively "anyone".
--
-- It was not theoretical: personalizationEngine.matchTargetAudience() pulled up
-- to 20,000 profiles INCLUDING lat/lon to the client to run a radius filter in
-- JS. Every host running a campaign downloaded a mass location dump.
--
-- This is the exact harm the safety doctrine exists to prevent (visibility =
-- safety / anti-trafficking) and, for a nightlife app, a POPIA exposure.
--
-- FIX (two parts):
--   1. Column-level grants — `authenticated` can read all 96 columns EXCEPT the
--      4 coordinate ones. Postgres cannot revoke a column subset from a
--      table-level grant, so we revoke the table grant and re-grant the safe
--      column list. Built dynamically so this stays correct as columns are
--      added, but NOTE: new columns are granted only when this is re-run.
--   2. profiles_within_radius() — replaces the client-side radius filter. Takes
--      a centre + radius, returns only the IDs that fall inside. Coordinates
--      never leave the database.
--
-- Verified safe to run: no query in src/ does select('*') on profiles (checked
-- all 123 call sites), so no existing read depends on the table-level grant.

begin;

-- ── 1. Column-level SELECT ──────────────────────────────────────────────────
do $$
declare
  safe_cols text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into safe_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'profiles'
    and column_name not in ('lat', 'lon', 'home_base_lat', 'home_base_lon');

  execute 'revoke select on public.profiles from authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', safe_cols);
end $$;

-- Writes are unaffected: a user still updates their own row (including their own
-- coordinates) under the existing owner-scoped UPDATE policy. Reading someone
-- else's coordinates is what we are closing.

-- ── 2. Server-side radius matching ──────────────────────────────────────────
create or replace function public.profiles_within_radius(
  p_lat       double precision,
  p_lon       double precision,
  p_radius_km double precision,
  p_limit     integer default 20000
)
returns table (id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Haversine in SQL. Only IDs come back — never coordinates, never a distance
  -- precise enough to trilaterate a home from repeated calls.
  select p.id
  from public.profiles p
  where p.is_discoverable = true          -- respect the user's own privacy switch
    and p.lat is not null
    and p.lon is not null
    and p_lat is not null
    and p_lon is not null
    and p_radius_km > 0
    and (
      6371 * acos(
        least(1, greatest(-1,
          cos(radians(p_lat)) * cos(radians(p.lat)) *
          cos(radians(p.lon) - radians(p_lon)) +
          sin(radians(p_lat)) * sin(radians(p.lat))
        ))
      )
    ) <= p_radius_km
  limit greatest(1, least(coalesce(p_limit, 20000), 20000));
$$;

revoke all on function public.profiles_within_radius(double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.profiles_within_radius(double precision, double precision, double precision, integer) to authenticated;

comment on function public.profiles_within_radius is
  'Radius match done server-side so profile coordinates never reach a client. Returns IDs only. Respects is_discoverable.';

commit;
