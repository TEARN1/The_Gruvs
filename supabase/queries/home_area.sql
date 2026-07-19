-- home_area.sql
--
-- "Show me what's on near where I LIVE, not where I'm standing at 3pm."
--
-- Deliberately NOT inferred from late-hour GPS. Silent overnight location
-- profiling is the ambient tracking the safety doctrine rules out, it is a POPIA
-- problem, and it would be wrong constantly anyway (night shifts, travel,
-- staying at a partner's place). The user sets their area; we store it coarse.
--
-- Storage rules:
--   * home_area       — human label ("Braamfontein, Johannesburg"). Readable.
--   * home_base_lat/lon — centroid ROUNDED TO 2dp (~1.1km) so it can never
--     identify a building. Client-unreadable (lock_profile_coordinates.sql);
--     only the RPCs below ever touch it.
--
-- Nothing here exposes one user's home to another user. The only consumer is
-- events_near_home(), which returns EVENTS — never people.

begin;

alter table public.profiles add column if not exists home_area text;

comment on column public.profiles.home_area is
  'User-set home area label. Set via set_home_area(); never inferred from GPS history.';
comment on column public.profiles.home_base_lat is
  'Coarse home centroid, rounded to 2dp (~1.1km). Never client-readable.';

-- ── Set your own home area ──────────────────────────────────────────────────
create or replace function public.set_home_area(
  p_label text,
  p_lat   double precision default null,
  p_lon   double precision default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Rounding happens HERE, server-side. If it were done on the client a caller
  -- could simply skip it and store a doorstep-precise coordinate.
  update public.profiles
     set home_area     = nullif(btrim(coalesce(p_label, '')), ''),
         home_base_lat = case when p_lat between  -90 and  90 then round(p_lat::numeric, 2)::double precision end,
         home_base_lon = case when p_lon between -180 and 180 then round(p_lon::numeric, 2)::double precision end
   where id = auth.uid();
end $$;

revoke all on function public.set_home_area(text, double precision, double precision) from public, anon;
grant execute on function public.set_home_area(text, double precision, double precision) to authenticated;

-- ── Read your own home area back ────────────────────────────────────────────
-- Needed because home_base_* is not column-readable even for your own row
-- (grants are not row-aware). Returns the coarse point — it is yours already.
create or replace function public.my_home_area()
returns table (home_area text, lat double precision, lon double precision)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.home_area, p.home_base_lat, p.home_base_lon
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_home_area() from public, anon;
grant execute on function public.my_home_area() to authenticated;

-- ── Events near MY home ─────────────────────────────────────────────────────
create or replace function public.events_near_home(
  p_radius_km double precision default 25,
  p_limit     integer default 50
)
returns table (id uuid, distance_km double precision)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select home_base_lat as lat, home_base_lon as lon
    from public.profiles where id = auth.uid()
  )
  select e.id,
         round((6371 * acos(least(1, greatest(-1,
           cos(radians(me.lat)) * cos(radians(e.lat)) *
           cos(radians(e.lon) - radians(me.lon)) +
           sin(radians(me.lat)) * sin(radians(e.lat))
         ))))::numeric, 1)::double precision as distance_km
  from public.events e, me
  where me.lat is not null and me.lon is not null
    and e.lat is not null and e.lon is not null
    and e.is_published = true
    and e.deleted_at is null
    and e.event_date >= current_date
    and (6371 * acos(least(1, greatest(-1,
          cos(radians(me.lat)) * cos(radians(e.lat)) *
          cos(radians(e.lon) - radians(me.lon)) +
          sin(radians(me.lat)) * sin(radians(e.lat))
        )))) <= greatest(1, least(coalesce(p_radius_km, 25), 200))
  order by distance_km asc, e.event_date asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.events_near_home(double precision, integer) from public, anon;
grant execute on function public.events_near_home(double precision, integer) to authenticated;

comment on function public.events_near_home is
  'Upcoming published events near the CALLER''s own home area. Distance is computed server-side; the home centroid never leaves the DB.';

-- home_area is a new column, so re-grant the safe column list — column-level
-- grants do not auto-extend (see lock_profile_coordinates.sql).
do $$
declare safe_cols text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into safe_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name not in ('lat', 'lon', 'home_base_lat', 'home_base_lon');
  execute 'revoke select on public.profiles from authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', safe_cols);
end $$;

commit;
