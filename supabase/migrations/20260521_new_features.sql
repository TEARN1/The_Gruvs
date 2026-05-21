-- ─── New Features Migration ───────────────────────────────────────────────────
-- Covers: event_reactions, event_updates (live updates), event_waitlist,
--         event_carpools, event_carpool_requests, rsvp_tiers on events
-- Run after 003_rls_policies.sql

-- ─── event_reactions ──────────────────────────────────────────────────────────
-- Emoji reactions on events (🔥💎🎶🤩✨😂)
create table if not exists event_reactions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  reaction    text not null,
  created_at  timestamptz not null default now(),
  unique (event_id, user_id, reaction)
);

create index if not exists event_reactions_event_id_idx on event_reactions(event_id);

alter table event_reactions enable row level security;

-- RLS (safe to run even if 003 already added these — IF NOT EXISTS guards them)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_select'
  ) then
    execute 'create policy "event_reactions_select" on event_reactions for select using (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_insert'
  ) then
    execute 'create policy "event_reactions_insert" on event_reactions for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_delete'
  ) then
    execute 'create policy "event_reactions_delete" on event_reactions for delete using (auth.uid() = user_id)';
  end if;
end $$;

-- ─── event_updates ────────────────────────────────────────────────────────────
-- Live updates posted by event organiser
create table if not exists event_updates (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  message     text not null,
  update_type text not null default 'info'
                check (update_type in ('info', 'hype', 'change', 'shoutout')),
  created_at  timestamptz not null default now()
);

create index if not exists event_updates_event_id_idx on event_updates(event_id);

alter table event_updates enable row level security;

create policy if not exists "event_updates_select"
  on event_updates for select using (true);

create policy if not exists "event_updates_insert"
  on event_updates for insert with check (auth.uid() = author_id);

create policy if not exists "event_updates_delete"
  on event_updates for delete using (auth.uid() = author_id);

-- ─── event_waitlist ───────────────────────────────────────────────────────────
-- Waitlist for sold-out events
create table if not exists event_waitlist (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_waitlist_event_id_idx on event_waitlist(event_id);

alter table event_waitlist enable row level security;

create policy if not exists "event_waitlist_select"
  on event_waitlist for select using (true);

create policy if not exists "event_waitlist_insert"
  on event_waitlist for insert with check (auth.uid() = user_id);

create policy if not exists "event_waitlist_delete"
  on event_waitlist for delete using (auth.uid() = user_id);

-- ─── event_carpools ───────────────────────────────────────────────────────────
-- Lift offers from drivers attending an event
create table if not exists event_carpools (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  driver_id        uuid not null references profiles(id) on delete cascade,
  seats_available  int not null default 2 check (seats_available between 1 and 10),
  departure_area   text not null,
  departure_time   timestamptz,
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists event_carpools_event_id_idx on event_carpools(event_id);

alter table event_carpools enable row level security;

create policy if not exists "event_carpools_select"
  on event_carpools for select using (true);

create policy if not exists "event_carpools_insert"
  on event_carpools for insert with check (auth.uid() = driver_id);

create policy if not exists "event_carpools_delete"
  on event_carpools for delete using (auth.uid() = driver_id);

-- ─── event_carpool_requests ───────────────────────────────────────────────────
-- Seat requests from riders
create table if not exists event_carpool_requests (
  id          uuid primary key default gen_random_uuid(),
  carpool_id  uuid not null references event_carpools(id) on delete cascade,
  event_id    uuid not null references events(id) on delete cascade,
  rider_id    uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (carpool_id, rider_id)
);

create index if not exists ecr_carpool_id_idx on event_carpool_requests(carpool_id);
create index if not exists ecr_rider_id_idx   on event_carpool_requests(rider_id);

alter table event_carpool_requests enable row level security;

create policy if not exists "event_carpool_requests_select"
  on event_carpool_requests for select using (true);

create policy if not exists "event_carpool_requests_insert"
  on event_carpool_requests for insert with check (auth.uid() = rider_id);

create policy if not exists "event_carpool_requests_delete"
  on event_carpool_requests for delete using (auth.uid() = rider_id);

-- ─── events table additions ───────────────────────────────────────────────────
-- VIP / table tier definitions (JSONB array: [{id, name, description, price, capacity, icon, color}])
alter table events
  add column if not exists rsvp_tiers jsonb;

-- tier_id on RSVPs so we know which tier each attendee booked
alter table event_rsvps
  add column if not exists tier_id text;

-- ─── upsert_rsvp_tier RPC ────────────────────────────────────────────────────
-- Fallback RPC used by VIPTierSelector when direct upsert isn't available
create or replace function upsert_rsvp_tier(
  p_event_id uuid,
  p_user_id  uuid,
  p_tier_id  text
) returns void
language plpgsql security definer as $$
begin
  insert into event_rsvps (event_id, user_id, status, tier_id)
  values (p_event_id, p_user_id, 'going', p_tier_id)
  on conflict (event_id, user_id)
  do update set tier_id = excluded.tier_id, status = 'going';
end;
$$;

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Enable realtime publication for live-update tables
alter publication supabase_realtime add table event_reactions;
alter publication supabase_realtime add table event_updates;
