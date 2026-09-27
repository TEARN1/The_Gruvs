-- the_meal.sql — "The Meal": restaurants/fast-food post menus, specials, tastings.
--
-- Business accounts only. Free to post, but organic reach is metered (the
-- reach-throttle) so visibility is earned by boosting or a higher tier. No money
-- handling — a boost is a free flag today; the caps mirror businessEntitlements.
--
-- Security posture (learned from the crew-invite RLS recursion): every
-- cross-table check goes through a SECURITY DEFINER helper, never an inline
-- EXISTS subquery that would re-trigger RLS. All the RULES that could be gamed
-- (ownership, boost caps, view dedupe, ranking) live in SECURITY DEFINER
-- functions so the client can't spoof them.

-- ── Helper: does this user own this business? ───────────────────────────────
create or replace function public.owns_business(p_business uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.business_profiles where id = p_business and user_id = p_user);
$$;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.meal_posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  title text not null,
  description text,
  price numeric,
  currency text,
  image_url text,
  meal_type text not null default 'menu' check (meal_type in ('menu','special','tasting','fastfood')),
  tags text[] default '{}',
  lat double precision,
  lon double precision,
  available_from time,
  available_to time,
  is_active boolean not null default true,
  is_boosted boolean not null default false,
  boosted_until timestamptz,
  view_count integer not null default 0,
  unique_view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meal_posts_active_idx on public.meal_posts (is_active, is_boosted, created_at desc);
create index if not exists meal_posts_business_idx on public.meal_posts (business_id);

-- Per-viewer/day dedupe so the reach-throttle can't be gamed by refreshing.
create table if not exists public.meal_views (
  meal_id uuid not null references public.meal_posts(id) on delete cascade,
  viewer_id uuid not null,
  day date not null default (now() at time zone 'utc')::date,
  primary key (meal_id, viewer_id, day)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.meal_posts enable row level security;
alter table public.meal_views enable row level security;

drop policy if exists meal_posts_select on public.meal_posts;
create policy meal_posts_select on public.meal_posts for select
  using (is_active or owner_id = auth.uid());

drop policy if exists meal_posts_insert on public.meal_posts;
create policy meal_posts_insert on public.meal_posts for insert
  with check (owner_id = auth.uid() and public.owns_business(business_id, auth.uid()));

drop policy if exists meal_posts_update on public.meal_posts;
create policy meal_posts_update on public.meal_posts for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists meal_posts_delete on public.meal_posts;
create policy meal_posts_delete on public.meal_posts for delete
  using (owner_id = auth.uid());

-- meal_views: a viewer may record their own view; nobody reads it from the
-- client (the dedupe/increment is done server-side in bump_meal_view).
drop policy if exists meal_views_insert on public.meal_views;
create policy meal_views_insert on public.meal_views for insert
  with check (viewer_id = auth.uid());

-- ── View bump (deduped) ─────────────────────────────────────────────────────
create or replace function public.bump_meal_view(p_meal uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_new boolean := false;
begin
  if auth.uid() is null then return; end if;
  insert into public.meal_views (meal_id, viewer_id)
    values (p_meal, auth.uid())
    on conflict do nothing;
  get diagnostics v_new = row_count;
  update public.meal_posts
     set view_count = view_count + 1,
         unique_view_count = unique_view_count + (case when v_new then 1 else 0 end)
   where id = p_meal;
end;
$$;

-- ── Boost (free today; enforces the tier's active-boost cap) ─────────────────
-- Cap mirrors businessEntitlements.LIMITS.activeMealBoosts.
create or replace function public.boost_meal(p_meal uuid, p_hours int default 24)
returns public.meal_posts language plpgsql security definer set search_path to 'public' as $$
declare v_biz uuid; v_tier text; v_cap int; v_active int; v_row public.meal_posts;
begin
  select business_id into v_biz from public.meal_posts where id = p_meal and owner_id = auth.uid();
  if v_biz is null then raise exception 'not_owner'; end if;
  select lower(coalesce(tier,'starter')) into v_tier from public.business_profiles where id = v_biz;
  v_cap := case v_tier when 'pro' then 5 when 'royal' then 20 when 'enterprise' then 2147483647 else 1 end;
  select count(*) into v_active from public.meal_posts
    where business_id = v_biz and is_boosted and boosted_until > now() and id <> p_meal;
  if v_active >= v_cap then raise exception 'over_limit'; end if;
  update public.meal_posts
     set is_boosted = true, boosted_until = now() + make_interval(hours => greatest(1, p_hours)), updated_at = now()
   where id = p_meal
   returning * into v_row;
  return v_row;
end;
$$;

-- ── Feed ranker (the reach-throttle) ────────────────────────────────────────
-- Boosted first, then non-boosted still under their tier's free-view cap,
-- limited to the tier's rotation per business, newest first. Distance sorts
-- within when coords are supplied. Caps mirror businessEntitlements.LIMITS.
create or replace function public.feed_meals(p_lat double precision default null,
                                             p_lon double precision default null,
                                             p_limit int default 40)
returns setof public.meal_posts language sql stable security definer set search_path to 'public' as $$
  with ranked as (
    select m.*,
      lower(coalesce(b.tier,'starter')) as tier,
      (m.is_boosted and m.boosted_until > now()) as live_boost,
      case lower(coalesce(b.tier,'starter')) when 'pro' then 2000 when 'royal' then 10000 when 'enterprise' then 2147483647 else 200 end as free_views,
      case lower(coalesce(b.tier,'starter')) when 'starter' then 2 else 2147483647 end as rotation,
      row_number() over (partition by m.business_id
        order by (m.is_boosted and m.boosted_until > now()) desc, m.created_at desc) as biz_rank
    from public.meal_posts m
    join public.business_profiles b on b.id = m.business_id
    where m.is_active
  )
  select id, business_id, owner_id, title, description, price, currency, image_url,
         meal_type, tags, lat, lon, available_from, available_to, is_active,
         is_boosted, boosted_until, view_count, unique_view_count, created_at, updated_at
  from ranked
  where live_boost or (unique_view_count < free_views and biz_rank <= rotation)
  order by live_boost desc,
           case when p_lat is not null and lat is not null
                then (abs(lat - p_lat) + abs(lon - p_lon)) else 999999 end asc,
           created_at desc
  limit greatest(1, p_limit);
$$;

grant execute on function public.bump_meal_view(uuid) to authenticated;
grant execute on function public.boost_meal(uuid, int) to authenticated;
grant execute on function public.feed_meals(double precision, double precision, int) to authenticated, anon;
grant execute on function public.owns_business(uuid, uuid) to authenticated;
