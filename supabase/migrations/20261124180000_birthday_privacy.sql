-- Birth year privacy (The Gruvs PR #34, ported to the current main).
--
-- Signup and the profile screen promise "we celebrate your day, your year
-- stays private". It wasn't: birth_date (a full date), birth_year and age were
-- readable by every signed-in user, so anyone's exact age was one request away.
--
-- Column grants on profiles are already per column (lock_authenticated_pii),
-- so these three are simply taken out. Column grants cannot tell "my row" from
-- "your row", so the app reads its own through get_my_profile() (self only,
-- SECURITY DEFINER) and other people's birthdays only as "today or not".
-- Writing them is unaffected (UPDATE is a separate grant).

revoke select (birth_date, birth_year, age) on public.profiles from authenticated, anon;

-- "Is it their birthday today?" for profiles the caller already has ids for
-- (people they follow, a profile they are viewing). Never the date or year.
create or replace function public.profile_birthdays(p_ids uuid[])
returns table (id uuid, is_birthday_today boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         (extract(month from p.birth_date) = extract(month from current_date)
          and extract(day from p.birth_date) = extract(day from current_date))
    from public.profiles p
   where p.id = any(p_ids[1:500])
     and p.birth_date is not null;
$$;

revoke all on function public.profile_birthdays(uuid[]) from public, anon;
grant execute on function public.profile_birthdays(uuid[]) to authenticated;
comment on function public.profile_birthdays(uuid[]) is
  'Whether each given profile''s birthday is today. Never returns birth_date or year.';

-- Event targeting by age (personalizationEngine) used to download the birth
-- year of up to 20,000 users into the host's browser. The database now
-- returns only who is inside the range. Ranges narrower than five years are
-- refused, so the targeting cannot be used to pin down one person's age.
create or replace function public.profiles_in_age_range(p_min integer, p_max integer, p_limit integer default 20000)
returns table (id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(p_max, 120) - coalesce(p_min, 0) < 4 then
    raise exception 'An age range must cover at least five years.' using errcode = '22023';
  end if;
  return query
    select p.id
      from public.profiles p
     where p.is_discoverable = true
       and coalesce(extract(year from age(p.birth_date))::int,
                    extract(year from current_date)::int - p.birth_year,
                    p.age) between coalesce(p_min, 0) and coalesce(p_max, 120)
     limit greatest(1, least(coalesce(p_limit, 20000), 20000));
end;
$$;

revoke all on function public.profiles_in_age_range(integer, integer, integer) from public, anon;
grant execute on function public.profiles_in_age_range(integer, integer, integer) to authenticated;
