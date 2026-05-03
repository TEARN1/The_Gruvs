-- ═══════════════════════════════════════════════════════════════
--  THE GRUVS — Supabase Database Schema
--  Run this in your Supabase project → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- Enable PostGIS for location-based features
create extension if not exists postgis;

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id              uuid primary key references auth.users on delete cascade,
  username        text unique,
  avatar_url      text,
  cover_url       text,
  bio             text,
  location        text,
  is_verified     boolean default false,
  is_online       boolean default false,
  vibe_score      integer default 0,
  followers_count integer default 0,
  saved_count     integer default 0,
  interests       text[],
  coords          geography(point, 4326),
  created_at      timestamptz default now()
);

alter table profiles enable row level security;
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── EVENTS ──────────────────────────────────────────────────────────────────
create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id) on delete cascade,
  title           text not null,
  description     text,
  category        text,
  category_color  text,
  event_date      date,
  event_time      text,
  address         text,
  venue_name      text,
  price           text default 'FREE',
  capacity        integer,
  going           integer default 0,
  vibe_count      integer default 0,
  echo_count      integer default 0,
  reaction_count  integer default 0,
  ticket_url      text,
  media           jsonb,
  coords          geography(point, 4326),
  is_featured     boolean default false,
  created_at      timestamptz default now()
);

alter table events enable row level security;
create policy "Events readable by all" on events for select using (true);
create policy "Authenticated users insert events" on events for insert with check (auth.uid() = user_id);
create policy "Users update own events" on events for update using (auth.uid() = user_id);
create policy "Users delete own events" on events for delete using (auth.uid() = user_id);

-- ─── VIBES ───────────────────────────────────────────────────────────────────
create table if not exists vibes (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid references events(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

alter table vibes enable row level security;
create policy "Vibes readable" on vibes for select using (true);
create policy "Users manage own vibes" on vibes for all using (auth.uid() = user_id);

-- ─── SAVED EVENTS ────────────────────────────────────────────────────────────
create table if not exists saved_events (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid references events(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

alter table saved_events enable row level security;
create policy "Users manage own saves" on saved_events for all using (auth.uid() = user_id);

-- ─── EVENT REACTIONS ─────────────────────────────────────────────────────────
create table if not exists event_reactions (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references events(id) on delete cascade,
  user_id      uuid references profiles(id) on delete cascade,
  reaction_key text not null,
  created_at   timestamptz default now(),
  unique (event_id, user_id)
);

alter table event_reactions enable row level security;
create policy "Reactions readable" on event_reactions for select using (true);
create policy "Users manage own reactions" on event_reactions for all using (auth.uid() = user_id);

-- ─── ECHOES (comments) ───────────────────────────────────────────────────────
create table if not exists echoes (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references events(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  body       text not null,
  likes      integer default 0,
  created_at timestamptz default now()
);

alter table echoes enable row level security;
create policy "Echoes readable" on echoes for select using (true);
create policy "Users insert own echoes" on echoes for insert with check (auth.uid() = user_id);
create policy "Users delete own echoes" on echoes for delete using (auth.uid() = user_id);

-- ─── EVENT RATINGS ───────────────────────────────────────────────────────────
create table if not exists event_ratings (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references events(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  rating     integer check (rating between 1 and 5),
  review     text,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

alter table event_ratings enable row level security;
create policy "Ratings readable" on event_ratings for select using (true);
create policy "Users manage own ratings" on event_ratings for all using (auth.uid() = user_id);

-- ─── CHECK-INS ───────────────────────────────────────────────────────────────
create table if not exists check_ins (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references events(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

alter table check_ins enable row level security;
create policy "Users manage own check-ins" on check_ins for all using (auth.uid() = user_id);

-- ─── EVENT GALLERY ───────────────────────────────────────────────────────────
create table if not exists event_gallery (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references events(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  url        text not null,
  caption    text,
  created_at timestamptz default now()
);

alter table event_gallery enable row level security;
create policy "Gallery readable" on event_gallery for select using (true);
create policy "Users insert gallery" on event_gallery for insert with check (auth.uid() = user_id);

-- ─── RPC: increment_vibe ──────────────────────────────────────────────────────
create or replace function increment_vibe(ev_id uuid, uid uuid)
returns void language plpgsql security definer as $$
begin
  insert into vibes (event_id, user_id) values (ev_id, uid)
  on conflict (event_id, user_id) do nothing;
  update events set vibe_count = (select count(*) from vibes where event_id = ev_id)
  where id = ev_id;
end;
$$;

-- ─── RPC: decrement_vibe ─────────────────────────────────────────────────────
create or replace function decrement_vibe(ev_id uuid, uid uuid)
returns void language plpgsql security definer as $$
begin
  delete from vibes where event_id = ev_id and user_id = uid;
  update events set vibe_count = (select count(*) from vibes where event_id = ev_id)
  where id = ev_id;
end;
$$;

-- ─── RPC: find_popular_spots ─────────────────────────────────────────────────
create or replace function find_popular_spots(limit_count integer default 8)
returns table (
  event_id    uuid,
  description text,
  address     text,
  rsvp_count  bigint,
  image       text,
  category    text
) language sql security definer as $$
  select
    e.id as event_id,
    e.title as description,
    e.address,
    e.going::bigint as rsvp_count,
    (e.media->0->>'url') as image,
    e.category
  from events e
  order by e.vibe_count desc, e.going desc
  limit limit_count;
$$;

-- ─── RPC: find_nearby_vibers ─────────────────────────────────────────────────
create or replace function find_nearby_vibers(uid uuid, max_dist_km float, limit_count integer default 20)
returns table (
  profile_id   uuid,
  username     text,
  avatar_url   text,
  vibe_score   integer,
  is_online    boolean,
  distance_km  float
) language sql security definer as $$
  select
    p.id as profile_id,
    p.username,
    p.avatar_url,
    p.vibe_score,
    p.is_online,
    round((st_distancesphere(p.coords::geometry, (select coords::geometry from profiles where id = uid)) / 1000)::numeric, 1)::float as distance_km
  from profiles p
  where p.id <> uid
    and p.coords is not null
    and (select coords from profiles where id = uid) is not null
    and st_distancesphere(p.coords::geometry, (select coords::geometry from profiles where id = uid)) <= max_dist_km * 1000
  order by distance_km asc
  limit limit_count;
$$;

-- ─── RPC: find_nearby_events ─────────────────────────────────────────────────
create or replace function find_nearby_events(lat float, lon float, radius_km float, limit_count integer default 20)
returns table (
  id           uuid,
  title        text,
  event_date   date,
  category     text,
  venue_name   text,
  going        integer,
  vibe_count   integer,
  media        jsonb,
  distance_km  float
) language sql security definer as $$
  select
    e.id,
    e.title,
    e.event_date,
    e.category,
    e.venue_name,
    e.going,
    e.vibe_count,
    e.media,
    round((st_distancesphere(e.coords::geometry, st_point(lon, lat)) / 1000)::numeric, 1)::float as distance_km
  from events e
  where e.coords is not null
    and st_distancesphere(e.coords::geometry, st_point(lon, lat)) <= radius_km * 1000
  order by distance_km asc
  limit limit_count;
$$;

-- ─── Storage bucket for media uploads ────────────────────────────────────────
-- Run this AFTER creating the schema:
-- insert into storage.buckets (id, name, public) values ('event-media', 'event-media', true);
-- create policy "Anyone can view media" on storage.objects for select using (bucket_id = 'event-media');
-- create policy "Auth users upload media" on storage.objects for insert with check (bucket_id = 'event-media' and auth.role() = 'authenticated');
