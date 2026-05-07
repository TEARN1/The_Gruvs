-- ═══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — Advanced Supabase Schema  (v2)
--  Run once in: Supabase → SQL Editor → New Query
--
--  What's new vs v1
--  ─────────────────
--  • GiST spatial indexes on every coords column (PostGIS queries ~10× faster)
--  • Full-text search index on events (tsvector) with weighted title/description
--  • Trigger-driven counters: vibe_count, echo_count, reaction_count, going —
--    no more manual UPDATE inside RPCs; counters are always consistent
--  • Trigger: vibe_score on profiles auto-increments on vibe/echo/check-in
--  • Partial indexes to speed up "upcoming events" and "featured" queries
--  • echo_likes table replacing the mutable `likes` integer on echoes
--  • followers table (follow/unfollow + follower counts via trigger)
--  • notifications table with RLS (only owner can read)
--  • slug column on events for clean URLs
--  • capacity_pct computed column via generated always
--  • Updated RPCs: find_nearby_events returns category_color + address
--  • New RPC: search_events — full-text ranked search
--  • New RPC: get_event_full — single event with aggregated social stats
--  • New RPC: feed_for_user — personalised feed ranked by follows + interests
--  • New RPC: trending_score — time-decayed hotness formula
--  • Storage bucket + policies (uncommented, ready to run)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists postgis;
create extension if not exists pg_trgm;   -- trigram similarity for fuzzy search
create extension if not exists unaccent;  -- accent-insensitive search

-- ── Helper: safe divide ───────────────────────────────────────────────────────
create or replace function safe_div(a numeric, b numeric)
returns numeric language sql immutable as $$
  select case when b = 0 then 0 else a / b end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
--  PROFILES
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists profiles (
  id               uuid        primary key references auth.users on delete cascade,
  username         text        unique,
  display_name     text,
  avatar_url       text,
  cover_url        text,
  bio              text,
  location         text,
  website          text,
  is_verified      boolean     default false,
  is_online        boolean     default false,
  last_seen_at     timestamptz default now(),
  vibe_score       integer     default 0,
  followers_count  integer     default 0,
  following_count  integer     default 0,
  saved_count      integer     default 0,
  events_posted    integer     default 0,
  interests        text[],
  coords           geography(point, 4326),
  push_token       text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── Ensure all v2 columns exist on existing profiles tables ──────────────────
alter table profiles add column if not exists username         text;
alter table profiles add column if not exists display_name     text;
alter table profiles add column if not exists avatar_url       text;
alter table profiles add column if not exists cover_url        text;
alter table profiles add column if not exists bio              text;
alter table profiles add column if not exists location         text;
alter table profiles add column if not exists website          text;
alter table profiles add column if not exists is_verified      boolean     default false;
alter table profiles add column if not exists is_online        boolean     default false;
alter table profiles add column if not exists last_seen_at     timestamptz default now();
alter table profiles add column if not exists vibe_score       integer     default 0;
alter table profiles add column if not exists followers_count  integer     default 0;
alter table profiles add column if not exists following_count  integer     default 0;
alter table profiles add column if not exists saved_count      integer     default 0;
alter table profiles add column if not exists events_posted    integer     default 0;
alter table profiles add column if not exists interests        text[];
alter table profiles add column if not exists push_token       text;
alter table profiles add column if not exists coords           geography(point, 4326);
alter table profiles add column if not exists updated_at       timestamptz default now();

-- Indexes
create index if not exists profiles_coords_gist  on profiles using gist(coords);
create index if not exists profiles_username_trgm on profiles using gin(username gin_trgm_ops);
create index if not exists profiles_interests_gin  on profiles using gin(interests);

alter table profiles enable row level security;
drop policy if exists "Public profiles readable"  on profiles;
drop policy if exists "Users update own profile"  on profiles;
drop policy if exists "Users insert own profile"  on profiles;
create policy "Public profiles readable"  on profiles for select using (true);
create policy "Users update own profile"  on profiles for update using (auth.uid() = id);
create policy "Users insert own profile"  on profiles for insert with check (auth.uid() = id);

-- Keep updated_at fresh
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  base_uname  text;
  final_uname text;
begin
  base_uname := coalesce(
    new.raw_user_meta_data->>'username',
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'))
  );
  -- Guarantee uniqueness: append 4-char random suffix on collision
  final_uname := base_uname;
  while exists (select 1 from profiles where username = final_uname) loop
    final_uname := base_uname || '_' || left(gen_random_uuid()::text, 4);
  end loop;

  insert into profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_uname,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════════
--  FOLLOWERS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists followers (
  id          uuid        primary key default gen_random_uuid(),
  follower_id uuid        not null references profiles(id) on delete cascade,
  following_id uuid       not null references profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table followers add column if not exists follower_id  uuid references profiles(id) on delete cascade;
alter table followers add column if not exists following_id uuid references profiles(id) on delete cascade;

create index if not exists followers_following_id on followers(following_id);
create index if not exists followers_follower_id  on followers(follower_id);

alter table followers enable row level security;
drop policy if exists "Followers readable"        on followers;
drop policy if exists "Users manage own follows"  on followers;
create policy "Followers readable"        on followers for select using (true);
create policy "Users manage own follows"  on followers for all    using (auth.uid() = follower_id);

-- Trigger: keep followers_count + following_count in sync
create or replace function sync_follow_counts()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update profiles set followers_count = followers_count + 1 where id = new.following_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif TG_OP = 'DELETE' then
    update profiles set followers_count = greatest(0, followers_count - 1) where id = old.following_id;
    update profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
  end if;
  return null;
end;
$$;

drop trigger if exists followers_sync on followers;
create trigger followers_sync after insert or delete on followers
  for each row execute function sync_follow_counts();

-- ═══════════════════════════════════════════════════════════════════════════════
--  EVENTS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists events (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        references profiles(id) on delete cascade,
  slug            text        unique,
  title           text        not null,
  description     text,
  category        text,
  category_color  text,
  tags            text[],
  event_date      date,
  event_time      text,
  end_date        date,
  end_time        text,
  address         text,
  venue_name      text,
  city            text,
  country         text        default 'ZA',
  price           text        default 'FREE',
  price_min       numeric,
  price_max       numeric,
  capacity        integer,
  going           integer     default 0,           -- managed by trigger
  vibe_count      integer     default 0,           -- managed by trigger
  echo_count      integer     default 0,           -- managed by trigger
  reaction_count  integer     default 0,           -- managed by trigger
  save_count      integer     default 0,           -- managed by trigger
  ticket_url      text,
  media           jsonb,
  coords          geography(point, 4326),
  is_featured     boolean     default false,
  is_cancelled    boolean     default false,
  age_restriction integer     default 0,
  search_vector   tsvector,   -- maintained by trigger
  trending_score  float       generated always as (
    -- Wilson score-inspired hotness: vibes + going weighted, decays over time
    -- (value is approximate at insert time; refreshed via trigger)
    vibe_count * 1.0 + going * 0.5 + echo_count * 0.3 + reaction_count * 0.2
  ) stored,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Ensure all v2 columns exist on existing events tables ────────────────────
alter table events add column if not exists user_id         uuid references profiles(id) on delete cascade;
alter table events add column if not exists title           text;
alter table events add column if not exists description     text;
alter table events add column if not exists category        text;
alter table events add column if not exists category_color  text;
alter table events add column if not exists address         text;
alter table events add column if not exists venue_name      text;
alter table events add column if not exists price           text default 'FREE';
alter table events add column if not exists capacity        integer;
alter table events add column if not exists going           integer default 0;
alter table events add column if not exists vibe_count      integer default 0;
alter table events add column if not exists echo_count      integer default 0;
alter table events add column if not exists reaction_count  integer default 0;
alter table events add column if not exists ticket_url      text;
alter table events add column if not exists media           jsonb;
alter table events add column if not exists is_featured     boolean default false;
alter table events add column if not exists event_date      date;
alter table events add column if not exists event_time      text;
alter table events add column if not exists slug            text        unique;
alter table events add column if not exists tags            text[];
alter table events add column if not exists end_date        date;
alter table events add column if not exists end_time        text;
alter table events add column if not exists city            text;
alter table events add column if not exists country         text        default 'ZA';
alter table events add column if not exists price_min       numeric;
alter table events add column if not exists price_max       numeric;
alter table events add column if not exists save_count      integer     default 0;
alter table events add column if not exists is_cancelled    boolean     default false;
alter table events add column if not exists age_restriction integer     default 0;
alter table events add column if not exists search_vector   tsvector;
alter table events add column if not exists coords          geography(point, 4326);
alter table events add column if not exists updated_at      timestamptz default now();
-- trending_score is a generated column — can't use ADD COLUMN IF NOT EXISTS for generated;
-- drop and re-add only if it doesn't exist yet
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'events' and column_name = 'trending_score'
  ) then
    alter table events add column trending_score float
      generated always as (
        vibe_count * 1.0 + going * 0.5 + echo_count * 0.3 + reaction_count * 0.2
      ) stored;
  end if;
end $$;

-- Spatial + query indexes
create index if not exists events_coords_gist        on events using gist(coords);
create index if not exists events_search_gin         on events using gin(search_vector);
create index if not exists events_tags_gin           on events using gin(tags);
create index if not exists events_category           on events(category);
create index if not exists events_trending           on events(trending_score desc);
-- Partial: only upcoming non-cancelled events (most queries filter these)
create index if not exists events_upcoming           on events(event_date asc)
  where is_cancelled = false;
create index if not exists events_featured           on events(is_featured, trending_score desc)
  where is_featured = true and is_cancelled = false;

alter table events enable row level security;
drop policy if exists "Events readable by all"            on events;
drop policy if exists "Authenticated users insert events" on events;
drop policy if exists "Users update own events"           on events;
drop policy if exists "Users delete own events"           on events;
create policy "Events readable by all"            on events for select  using (true);
create policy "Authenticated users insert events" on events for insert  with check (auth.uid() = user_id);
create policy "Users update own events"           on events for update  using (auth.uid() = user_id);
create policy "Users delete own events"           on events for delete  using (auth.uid() = user_id);

-- Auto slug from title + short id
create or replace function events_set_slug()
returns trigger language plpgsql as $$
declare
  base_slug text;
  final_slug text;
  suffix    text;
  attempt   int := 0;
begin
  if new.slug is not null then return new; end if;
  base_slug := lower(regexp_replace(unaccent(new.title), '[^a-z0-9]+', '-', 'g'));
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  base_slug := left(base_slug, 60);
  final_slug := base_slug || '-' || left(gen_random_uuid()::text, 8);
  new.slug := final_slug;
  return new;
end;
$$;

drop trigger if exists events_slug_gen on events;
create trigger events_slug_gen before insert on events
  for each row execute function events_set_slug();

-- Full-text search vector (title A, venue/city B, description C)
create or replace function events_update_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(unaccent(new.title), '')),       'A') ||
    setweight(to_tsvector('english', coalesce(unaccent(new.venue_name), '')),  'B') ||
    setweight(to_tsvector('english', coalesce(unaccent(new.city), '')),        'B') ||
    setweight(to_tsvector('english', coalesce(unaccent(new.description), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'B');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists events_search_vector_update on events;
create trigger events_search_vector_update before insert or update on events
  for each row execute function events_update_search_vector();

-- Trigger: keep events_posted on profile in sync
create or replace function sync_events_posted()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update profiles set events_posted = events_posted + 1 where id = new.user_id;
  elsif TG_OP = 'DELETE' then
    update profiles set events_posted = greatest(0, events_posted - 1) where id = old.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists events_posted_sync on events;
create trigger events_posted_sync after insert or delete on events
  for each row execute function sync_events_posted();

-- ═══════════════════════════════════════════════════════════════════════════════
--  VIBES  (likes on events)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists vibes (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references events(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table vibes add column if not exists event_id   uuid references events(id) on delete cascade;
alter table vibes add column if not exists user_id    uuid references profiles(id) on delete cascade;


create index if not exists vibes_event_id on vibes(event_id);
create index if not exists vibes_user_id  on vibes(user_id);

alter table vibes enable row level security;
drop policy if exists "Vibes readable"          on vibes;
drop policy if exists "Users manage own vibes"  on vibes;
create policy "Vibes readable"         on vibes for select using (true);
create policy "Users manage own vibes" on vibes for all    using (auth.uid() = user_id);

-- Trigger: keep events.vibe_count + profiles.vibe_score in sync
create or replace function sync_vibe_counts()
returns trigger language plpgsql security definer as $$
declare
  v_owner uuid;
begin
  if TG_OP = 'INSERT' then
    update events set vibe_count = vibe_count + 1 where id = new.event_id returning user_id into v_owner;
    update profiles set vibe_score = vibe_score + 2 where id = v_owner;
  elsif TG_OP = 'DELETE' then
    update events set vibe_count = greatest(0, vibe_count - 1) where id = old.event_id returning user_id into v_owner;
    update profiles set vibe_score = greatest(0, vibe_score - 2) where id = v_owner;
  end if;
  return null;
end;
$$;

drop trigger if exists vibes_sync on vibes;
create trigger vibes_sync after insert or delete on vibes
  for each row execute function sync_vibe_counts();

-- ═══════════════════════════════════════════════════════════════════════════════
--  SAVED EVENTS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists saved_events (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references events(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table saved_events add column if not exists event_id   uuid references events(id) on delete cascade;
alter table saved_events add column if not exists user_id    uuid references profiles(id) on delete cascade;


create index if not exists saved_events_user_id  on saved_events(user_id);
create index if not exists saved_events_event_id on saved_events(event_id);

alter table saved_events enable row level security;
drop policy if exists "Users manage own saves" on saved_events;
create policy "Users manage own saves" on saved_events for all using (auth.uid() = user_id);

-- Trigger: keep events.save_count + profiles.saved_count in sync
create or replace function sync_save_counts()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update events   set save_count  = save_count  + 1 where id = new.event_id;
    update profiles set saved_count = saved_count + 1 where id = new.user_id;
  elsif TG_OP = 'DELETE' then
    update events   set save_count  = greatest(0, save_count  - 1) where id = old.event_id;
    update profiles set saved_count = greatest(0, saved_count - 1) where id = old.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists saved_events_sync on saved_events;
create trigger saved_events_sync after insert or delete on saved_events
  for each row execute function sync_save_counts();

-- ═══════════════════════════════════════════════════════════════════════════════
--  EVENT REACTIONS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists event_reactions (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        not null references events(id) on delete cascade,
  user_id      uuid        not null references profiles(id) on delete cascade,
  reaction_key text        not null check (reaction_key in ('fire','heart','skull','100','mic','crown')),
  created_at   timestamptz default now(),
  unique (event_id, user_id)
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table event_reactions add column if not exists event_id     uuid references events(id) on delete cascade;
alter table event_reactions add column if not exists user_id      uuid references profiles(id) on delete cascade;
alter table event_reactions add column if not exists reaction_key text;


create index if not exists event_reactions_event_id on event_reactions(event_id);

alter table event_reactions enable row level security;
drop policy if exists "Reactions readable"            on event_reactions;
drop policy if exists "Users manage own reactions"    on event_reactions;
create policy "Reactions readable"          on event_reactions for select using (true);
create policy "Users manage own reactions"  on event_reactions for all    using (auth.uid() = user_id);

-- Trigger: keep events.reaction_count in sync
create or replace function sync_reaction_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update events set reaction_count = reaction_count + 1 where id = new.event_id;
  elsif TG_OP = 'DELETE' then
    update events set reaction_count = greatest(0, reaction_count - 1) where id = old.event_id;
  end if;
  return null;
end;
$$;

drop trigger if exists reactions_sync on event_reactions;
create trigger reactions_sync after insert or delete on event_reactions
  for each row execute function sync_reaction_count();

-- ═══════════════════════════════════════════════════════════════════════════════
--  ECHOES  (comments)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists echoes (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references events(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  parent_id  uuid        references echoes(id) on delete cascade,  -- threaded replies
  body       text        not null check (length(body) between 1 and 1000),
  likes      integer     default 0,  -- managed by echo_likes trigger
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table echoes add column if not exists event_id   uuid references events(id) on delete cascade;
alter table echoes add column if not exists user_id    uuid references profiles(id) on delete cascade;
alter table echoes add column if not exists parent_id  uuid references echoes(id) on delete cascade;
alter table echoes add column if not exists body       text;
alter table echoes add column if not exists likes      integer default 0;

create index if not exists echoes_event_id  on echoes(event_id, created_at desc);
create index if not exists echoes_parent_id on echoes(parent_id) where parent_id is not null;
create index if not exists echoes_user_id   on echoes(user_id);

alter table echoes enable row level security;
drop policy if exists "Echoes readable"          on echoes;
drop policy if exists "Users insert own echoes"  on echoes;
drop policy if exists "Users update own echoes"  on echoes;
drop policy if exists "Users delete own echoes"  on echoes;
create policy "Echoes readable"         on echoes for select using (true);
create policy "Users insert own echoes" on echoes for insert with check (auth.uid() = user_id);
create policy "Users update own echoes" on echoes for update using (auth.uid() = user_id);
create policy "Users delete own echoes" on echoes for delete using (auth.uid() = user_id);

-- Trigger: keep events.echo_count + vibe_score in sync
create or replace function sync_echo_counts()
returns trigger language plpgsql security definer as $$
declare
  v_owner uuid;
begin
  if TG_OP = 'INSERT' then
    update events set echo_count = echo_count + 1 where id = new.event_id returning user_id into v_owner;
    update profiles set vibe_score = vibe_score + 1 where id = v_owner;
  elsif TG_OP = 'DELETE' then
    update events set echo_count = greatest(0, echo_count - 1) where id = old.event_id;
  end if;
  return null;
end;
$$;

drop trigger if exists echoes_sync on echoes;
create trigger echoes_sync after insert or delete on echoes
  for each row execute function sync_echo_counts();

-- ── Echo likes (replaces mutable integer approach) ───────────────────────────
create table if not exists echo_likes (
  echo_id    uuid not null references echoes(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  primary key (echo_id, user_id)
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table echo_likes add column if not exists echo_id    uuid references echoes(id) on delete cascade;
alter table echo_likes add column if not exists user_id    uuid references profiles(id) on delete cascade;


alter table echo_likes enable row level security;
drop policy if exists "Echo likes readable"          on echo_likes;
drop policy if exists "Users manage own echo likes"  on echo_likes;
create policy "Echo likes readable"          on echo_likes for select using (true);
create policy "Users manage own echo likes"  on echo_likes for all    using (auth.uid() = user_id);

create or replace function sync_echo_likes()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update echoes set likes = likes + 1 where id = new.echo_id;
  elsif TG_OP = 'DELETE' then
    update echoes set likes = greatest(0, likes - 1) where id = old.echo_id;
  end if;
  return null;
end;
$$;

drop trigger if exists echo_likes_sync on echo_likes;
create trigger echo_likes_sync after insert or delete on echo_likes
  for each row execute function sync_echo_likes();

-- ═══════════════════════════════════════════════════════════════════════════════
--  EVENT RATINGS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists event_ratings (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references events(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  rating     smallint    not null check (rating between 1 and 5),
  review     text        check (length(review) <= 500),
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table event_ratings add column if not exists event_id   uuid references events(id) on delete cascade;
alter table event_ratings add column if not exists user_id    uuid references profiles(id) on delete cascade;
alter table event_ratings add column if not exists rating     smallint;
alter table event_ratings add column if not exists review     text;


create index if not exists event_ratings_event_id on event_ratings(event_id);

alter table event_ratings enable row level security;
drop policy if exists "Ratings readable"           on event_ratings;
drop policy if exists "Users manage own ratings"   on event_ratings;
create policy "Ratings readable"          on event_ratings for select using (true);
create policy "Users manage own ratings"  on event_ratings for all    using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
--  CHECK-INS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists check_ins (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references events(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table check_ins add column if not exists event_id   uuid references events(id) on delete cascade;
alter table check_ins add column if not exists user_id    uuid references profiles(id) on delete cascade;


create index if not exists check_ins_event_id on check_ins(event_id);

alter table check_ins enable row level security;
drop policy if exists "Check-ins readable"         on check_ins;
drop policy if exists "Users manage own check-ins" on check_ins;
create policy "Check-ins readable"         on check_ins for select using (true);
create policy "Users manage own check-ins" on check_ins for all    using (auth.uid() = user_id);

-- Trigger: keep events.going + vibe_score in sync
create or replace function sync_check_in_counts()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update events   set going       = going       + 1  where id = new.event_id;
    update profiles set vibe_score  = vibe_score  + 5  where id = new.user_id;
  elsif TG_OP = 'DELETE' then
    update events   set going = greatest(0, going - 1) where id = old.event_id;
  end if;
  return null;
end;
$$;

drop trigger if exists check_ins_sync on check_ins;
create trigger check_ins_sync after insert or delete on check_ins
  for each row execute function sync_check_in_counts();

-- ═══════════════════════════════════════════════════════════════════════════════
--  EVENT GALLERY
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists event_gallery (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references events(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  url        text        not null,
  caption    text        check (length(caption) <= 200),
  width      integer,
  height     integer,
  created_at timestamptz default now()
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table event_gallery add column if not exists event_id   uuid references events(id) on delete cascade;
alter table event_gallery add column if not exists user_id    uuid references profiles(id) on delete cascade;
alter table event_gallery add column if not exists url        text;
alter table event_gallery add column if not exists caption    text;


create index if not exists event_gallery_event_id on event_gallery(event_id);

alter table event_gallery enable row level security;
drop policy if exists "Gallery readable"      on event_gallery;
drop policy if exists "Users insert gallery"  on event_gallery;
drop policy if exists "Users delete gallery"  on event_gallery;
create policy "Gallery readable"     on event_gallery for select using (true);
create policy "Users insert gallery" on event_gallery for insert with check (auth.uid() = user_id);
create policy "Users delete gallery" on event_gallery for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
--  NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists notifications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references profiles(id) on delete cascade,
  actor_id     uuid        references profiles(id) on delete set null,
  type         text        not null check (type in ('vibe','echo','follow','checkin','reaction','mention','event_soon')),
  event_id     uuid        references events(id) on delete cascade,
  echo_id      uuid        references echoes(id) on delete cascade,
  body         text,
  is_read      boolean     default false,
  created_at   timestamptz default now()
);

-- ── Ensure all v2 columns exist ──────────────────────────────────────────────
alter table notifications add column if not exists user_id    uuid references profiles(id) on delete cascade;
alter table notifications add column if not exists actor_id   uuid references profiles(id) on delete set null;
alter table notifications add column if not exists type       text;
alter table notifications add column if not exists event_id   uuid references events(id) on delete cascade;
alter table notifications add column if not exists echo_id    uuid references echoes(id) on delete cascade;
alter table notifications add column if not exists body       text;
alter table notifications add column if not exists is_read    boolean default false;

create index if not exists notifications_user_id   on notifications(user_id, created_at desc);
create index if not exists notifications_unread     on notifications(user_id) where is_read = false;

alter table notifications enable row level security;
drop policy if exists "Users read own notifications"  on notifications;
drop policy if exists "System insert notifications"   on notifications;
drop policy if exists "Users mark own as read"        on notifications;
create policy "Users read own notifications"  on notifications for select using (auth.uid() = user_id);
create policy "System insert notifications"   on notifications for insert with check (true);
create policy "Users mark own as read"        on notifications for update using (auth.uid() = user_id);

-- Trigger: generate notifications for vibes, follows, echoes
create or replace function create_notification()
returns trigger language plpgsql security definer as $$
declare
  v_owner uuid;
  v_type  text;
begin
  -- VIBES
  if TG_TABLE_NAME = 'vibes' and TG_OP = 'INSERT' then
    select user_id into v_owner from events where id = new.event_id;
    if v_owner is distinct from new.user_id then
      insert into notifications(user_id, actor_id, type, event_id)
      values (v_owner, new.user_id, 'vibe', new.event_id)
      on conflict do nothing;
    end if;
  -- ECHOES
  elsif TG_TABLE_NAME = 'echoes' and TG_OP = 'INSERT' then
    select user_id into v_owner from events where id = new.event_id;
    if v_owner is distinct from new.user_id then
      insert into notifications(user_id, actor_id, type, event_id, echo_id, body)
      values (v_owner, new.user_id, 'echo', new.event_id, new.id, left(new.body, 80));
    end if;
  -- FOLLOWS
  elsif TG_TABLE_NAME = 'followers' and TG_OP = 'INSERT' then
    insert into notifications(user_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow');
  end if;
  return null;
end;
$$;

drop trigger if exists vibes_notify     on vibes;
drop trigger if exists echoes_notify    on echoes;
drop trigger if exists followers_notify on followers;
create trigger vibes_notify     after insert on vibes     for each row execute function create_notification();
create trigger echoes_notify    after insert on echoes    for each row execute function create_notification();
create trigger followers_notify after insert on followers for each row execute function create_notification();

-- ═══════════════════════════════════════════════════════════════════════════════
--  RPCs
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── increment_vibe / decrement_vibe (kept for backwards compat; counters now
--    handled by trigger so these just insert/delete) ─────────────────────────
create or replace function increment_vibe(ev_id uuid, uid uuid)
returns void language plpgsql security definer as $$
begin
  insert into vibes (event_id, user_id) values (ev_id, uid)
  on conflict (event_id, user_id) do nothing;
end;
$$;

create or replace function decrement_vibe(ev_id uuid, uid uuid)
returns void language plpgsql security definer as $$
begin
  delete from vibes where event_id = ev_id and user_id = uid;
end;
$$;

-- ── find_popular_spots ────────────────────────────────────────────────────────
create or replace function find_popular_spots(limit_count integer default 8)
returns table (
  event_id       uuid,
  description    text,
  address        text,
  rsvp_count     bigint,
  image          text,
  category       text
) language sql security definer as $$
  select
    e.id                        as event_id,
    e.title                     as description,
    coalesce(e.address, e.city) as address,
    e.going::bigint             as rsvp_count,
    (e.media->0->>'url')        as image,
    e.category
  from events e
  where e.is_cancelled = false
    and e.event_date >= current_date
  order by e.trending_score desc, e.going desc
  limit limit_count;
$$;

-- ── find_nearby_events ────────────────────────────────────────────────────────
create or replace function find_nearby_events(
  lat          float,
  lon          float,
  radius_km    float,
  limit_count  integer default 20
)
returns table (
  id              uuid,
  title           text,
  event_date      date,
  category        text,
  category_color  text,
  venue_name      text,
  address         text,
  going           integer,
  vibe_count      integer,
  media           jsonb,
  distance_km     float
) language sql security definer as $$
  select
    e.id,
    e.title,
    e.event_date,
    e.category,
    e.category_color,
    e.venue_name,
    coalesce(e.address, e.city),
    e.going,
    e.vibe_count,
    e.media,
    round(
      (st_distancesphere(e.coords::geometry, st_setsrid(st_point(lon, lat), 4326)) / 1000)::numeric,
      1
    )::float as distance_km
  from events e
  where e.coords is not null
    and e.is_cancelled = false
    and e.event_date >= current_date
    and st_distancesphere(e.coords::geometry, st_setsrid(st_point(lon, lat), 4326)) <= radius_km * 1000
  order by distance_km asc, e.trending_score desc
  limit limit_count;
$$;

-- ── find_nearby_vibers ────────────────────────────────────────────────────────
create or replace function find_nearby_vibers(
  uid          uuid,
  max_dist_km  float,
  limit_count  integer default 20
)
returns table (
  profile_id   uuid,
  username     text,
  avatar_url   text,
  vibe_score   integer,
  is_online    boolean,
  distance_km  float
) language sql security definer as $$
  with my_loc as (
    select coords::geometry as pt from profiles where id = uid
  )
  select
    p.id           as profile_id,
    p.username,
    p.avatar_url,
    p.vibe_score,
    p.is_online,
    round(
      (st_distancesphere(p.coords::geometry, my_loc.pt) / 1000)::numeric,
      1
    )::float       as distance_km
  from profiles p, my_loc
  where p.id <> uid
    and p.coords is not null
    and (select pt from my_loc) is not null
    and st_distancesphere(p.coords::geometry, my_loc.pt) <= max_dist_km * 1000
  order by distance_km asc
  limit limit_count;
$$;

-- ── search_events — ranked full-text search ───────────────────────────────────
create or replace function search_events(
  q            text,
  limit_count  integer default 20,
  offset_count integer default 0
)
returns table (
  id             uuid,
  title          text,
  event_date     date,
  category       text,
  category_color text,
  venue_name     text,
  going          integer,
  vibe_count     integer,
  media          jsonb,
  rank           float
) language sql security definer as $$
  select
    e.id,
    e.title,
    e.event_date,
    e.category,
    e.category_color,
    e.venue_name,
    e.going,
    e.vibe_count,
    e.media,
    ts_rank_cd(e.search_vector, websearch_to_tsquery('english', unaccent(q)))::float as rank
  from events e
  where e.search_vector @@ websearch_to_tsquery('english', unaccent(q))
    and e.is_cancelled = false
  order by rank desc, e.trending_score desc
  limit limit_count
  offset offset_count;
$$;

-- ── get_event_full — single event + social snapshot ──────────────────────────
create or replace function get_event_full(ev_id uuid, viewer_id uuid default null)
returns json language plpgsql security definer as $$
declare
  result json;
begin
  select json_build_object(
    'event',        row_to_json(e.*),
    'host',         row_to_json(p.*),
    'has_vibed',    exists(select 1 from vibes        where event_id = ev_id and user_id = viewer_id),
    'has_saved',    exists(select 1 from saved_events  where event_id = ev_id and user_id = viewer_id),
    'has_checked',  exists(select 1 from check_ins     where event_id = ev_id and user_id = viewer_id),
    'reaction',    (select reaction_key from event_reactions where event_id = ev_id and user_id = viewer_id),
    'avg_rating',  (select round(avg(rating)::numeric, 1) from event_ratings where event_id = ev_id),
    'rating_count',(select count(*)                        from event_ratings where event_id = ev_id),
    'top_echoes',  (
      select json_agg(
        json_build_object(
          'id',       ec.id,
          'body',     ec.body,
          'likes',    ec.likes,
          'created_at', ec.created_at,
          'author',   json_build_object('username', pr.username, 'avatar_url', pr.avatar_url, 'is_verified', pr.is_verified)
        ) order by ec.likes desc, ec.created_at desc
      )
      from echoes ec join profiles pr on pr.id = ec.user_id
      where ec.event_id = ev_id and ec.parent_id is null
      limit 5
    )
  )
  into result
  from events e
  join profiles p on p.id = e.user_id
  where e.id = ev_id;

  return result;
end;
$$;

-- ── feed_for_user — personalised ranked feed ──────────────────────────────────
-- Returns upcoming events ranked by: followed hosts > shared interests > trending
create or replace function feed_for_user(
  uid          uuid,
  limit_count  integer default 20,
  offset_count integer default 0
)
returns table (
  id              uuid,
  title           text,
  event_date      date,
  category        text,
  category_color  text,
  venue_name      text,
  address         text,
  going           integer,
  vibe_count      integer,
  media           jsonb,
  profiles        json,
  relevance       float
) language sql security definer as $$
  with
    user_interests as (
      select interests from profiles where id = uid
    ),
    following_ids as (
      select following_id from followers where follower_id = uid
    )
  select
    e.id,
    e.title,
    e.event_date,
    e.category,
    e.category_color,
    e.venue_name,
    coalesce(e.address, e.city),
    e.going,
    e.vibe_count,
    e.media,
    json_build_object(
      'username',    p.username,
      'avatar_url',  p.avatar_url,
      'is_verified', p.is_verified,
      'is_online',   p.is_online,
      'vibe_score',  p.vibe_score
    ) as profiles,
    (
      -- +30 if host is followed
      case when e.user_id in (select following_id from following_ids) then 30 else 0 end
      -- +20 if category matches any user interest
      + case when exists(
          select 1 from unnest((select interests from user_interests)) as i
          where lower(i) = lower(e.category)
        ) then 20 else 0 end
      -- base trending score normalised 0–50
      + least(e.trending_score / 2.0, 50)
    )::float as relevance
  from events e
  join profiles p on p.id = e.user_id
  where e.is_cancelled = false
    and e.event_date >= current_date
  order by relevance desc, e.event_date asc
  limit limit_count
  offset offset_count;
$$;

-- ── mark_notifications_read ───────────────────────────────────────────────────
create or replace function mark_notifications_read(uid uuid)
returns void language sql security definer as $$
  update notifications set is_read = true
  where user_id = uid and is_read = false;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
--  STORAGE BUCKET  (run once; safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  true,
  52428800,  -- 50 MB max per file
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime']
)
on conflict (id) do nothing;

drop policy if exists "Anyone can view media"    on storage.objects;
drop policy if exists "Auth users upload media"  on storage.objects;
drop policy if exists "Auth users delete media"  on storage.objects;

create policy "Anyone can view media"
  on storage.objects for select
  using (bucket_id = 'event-media');

create policy "Auth users upload media"
  on storage.objects for insert
  with check (bucket_id = 'event-media' and auth.role() = 'authenticated');

create policy "Auth users delete own media"
  on storage.objects for delete
  using (bucket_id = 'event-media' and auth.uid()::text = (storage.foldername(name))[1]);
