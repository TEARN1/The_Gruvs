-- birthday_privacy.sql
--
-- WHY: Signup and the profile screen both promise the user "we celebrate your
-- day — your year stays private" (AuthModal.js, ProfilePage.js). That promise
-- was false: lock_authenticated_pii.sql deliberately left `birth_date` (a DATE,
-- so it carries the full year) readable by any signed-in user so the birthday
-- spotlight feature (birthdaySpotlight.js, ExplorePage.js, ViberProfileModal.js)
-- could keep working. The result: every user's birth YEAR — and therefore exact
-- age — has been visible to every other signed-in user this whole time.
--
-- FIX: revoke cross-user SELECT on birth_date entirely, and replace every
-- cross-user read with a SECURITY DEFINER RPC that returns ONLY month+day (or a
-- pre-computed boolean/distance), never the raw date. Self-reads (get_my_profile,
-- and the owner's own row) are unaffected — a user can always see their own
-- birth_date.
--
-- Three call sites move onto these RPCs:
--   1. birthdaySpotlight.peopleWithBirthdayToday()  -> birthdays_nearby()
--   2. birthdaySpotlight.myBirthdayTwins()           -> birthday_twins()
--   3. ExplorePage (followed-users birthdays) +
--      ViberProfileModal (single profile birthday badge) -> profile_birthdays()

begin;

-- ── 1. Revoke cross-user SELECT on birth_date ───────────────────────────────
do $$
declare
  safe_cols text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into safe_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'profiles'
    and column_name not in ('lat', 'lon', 'home_base_lat', 'home_base_lon',
                             'email', 'push_token', 'phone', 'emergency_contacts',
                             'siblings', 'birth_date');

  execute 'revoke select on public.profiles from authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', safe_cols);
end $$;
-- Self-access to birth_date is unaffected: get_my_profile() (lock_authenticated_pii.sql)
-- is SECURITY DEFINER and already returns the caller's own row including birth_date.

-- ── 2. profile_birthdays — "is it their birthday today?" for a known id list ─
-- For call sites that already have specific profile ids (a followed-users list,
-- a single profile being viewed) and just need month/day, never the year.
create or replace function public.profile_birthdays(p_ids uuid[])
returns table (id uuid, is_birthday_today boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         (extract(month from p.birth_date) = extract(month from current_date)
          and extract(day from p.birth_date) = extract(day from current_date))
  from public.profiles p
  where p.id = any(p_ids)
    and p.birth_date is not null
  limit 500;
$$;

revoke all on function public.profile_birthdays(uuid[]) from public, anon;
grant execute on function public.profile_birthdays(uuid[]) to authenticated;

comment on function public.profile_birthdays is
  'Returns whether each given profile''s birthday is today. Month/day comparison only — never exposes birth_date or year.';

-- ── 3. birthdays_nearby — discoverable users whose birthday is today, in range
create or replace function public.birthdays_nearby(
  p_lat       double precision,
  p_lon       double precision,
  p_radius_km double precision default 50,
  p_limit     integer default 30
)
returns table (
  id uuid, username text, display_name text, avatar_url text, city text,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.city,
    case when p_lat is not null and p_lon is not null and p.lat is not null and p.lon is not null then
      6371 * acos(least(1, greatest(-1,
        cos(radians(p_lat)) * cos(radians(p.lat)) * cos(radians(p.lon) - radians(p_lon)) +
        sin(radians(p_lat)) * sin(radians(p.lat))
      )))
    else null end as distance_km
  from public.profiles p
  where p.is_discoverable = true
    and p.birth_date is not null
    and extract(month from p.birth_date) = extract(month from current_date)
    and extract(day from p.birth_date) = extract(day from current_date)
  order by distance_km asc nulls last
  limit greatest(1, least(coalesce(p_limit, 30), 200));
$$;
-- Radius filtering is applied in the caller today (post-fetch); doing the
-- distance math here keeps the raw coordinates server-side. A tighter radius
-- pre-filter can be added later without changing the client contract.

revoke all on function public.birthdays_nearby(double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.birthdays_nearby(double precision, double precision, double precision, integer) to authenticated;

comment on function public.birthdays_nearby is
  'Discoverable users whose birthday is today, nearest first. Never returns birth_date/year.';

-- ── 4. birthday_twins — people who share the caller's month+day ─────────────
create or replace function public.birthday_twins(p_user_id uuid, p_limit integer default 20)
returns table (
  id uuid, username text, display_name text, avatar_url text, city text,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select lat, lon, birth_date from public.profiles where id = p_user_id
  )
  select p.id, p.username, p.display_name, p.avatar_url, p.city,
    case when me.lat is not null and me.lon is not null and p.lat is not null and p.lon is not null then
      6371 * acos(least(1, greatest(-1,
        cos(radians(me.lat)) * cos(radians(p.lat)) * cos(radians(p.lon) - radians(me.lon)) +
        sin(radians(me.lat)) * sin(radians(p.lat))
      )))
    else null end as distance_km
  from public.profiles p, me
  where p.is_discoverable = true
    and p.id <> p_user_id
    and p.birth_date is not null
    and me.birth_date is not null
    and extract(month from p.birth_date) = extract(month from me.birth_date)
    and extract(day from p.birth_date) = extract(day from me.birth_date)
  order by distance_km asc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.birthday_twins(uuid, integer) from public, anon;
grant execute on function public.birthday_twins(uuid, integer) to authenticated;

comment on function public.birthday_twins is
  'Other discoverable users who share the caller''s birth month+day. Never returns birth_date/year for either party.';

commit;

-- ── VERIFY ───────────────────────────────────────────────────────────────────
-- As a non-owner authenticated user, this must now return no rows/error:
--   select birth_date from profiles where id <> auth.uid();
-- These must still work and return only month/day-derived data:
--   select * from profile_birthdays(array['<some-uuid>']::uuid[]);
--   select * from birthdays_nearby(-33.9, 18.4, 50, 30);
--   select * from birthday_twins('<my-uuid>', 20);
