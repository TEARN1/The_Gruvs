-- 0. CORE SOCIAL INFRASTRUCTURE (Missing Dependencies)
-- 0. CORE SOCIAL INFRASTRUCTURE (Required Dependencies)
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  receiver_id uuid references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null, -- 'event_like', 'achievement_unlocked', etc.
  entity_id uuid, -- Link to event_id or message_id
  content text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  content text,
  created_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete set null,
  target_event_id uuid references public.events(id) on delete cascade,
  reason text,
  details text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- 0.1 CORE SOCIAL MAPPING (Views over bridge tables)
create or replace view public.follows as
select
  sr.actor_id as follower_id,
  sr.target_id as following_id,
  now() as created_at
from public.social_relations sr
where sr.relation_type = 'follow';

drop view if exists public.mutes cascade;
create or replace view public.mutes as
select
  sr.actor_id as muter_id,
  sr.target_id as muted_user_id,
  now() as created_at
from public.social_relations sr
where sr.relation_type = 'mute';

drop view if exists public.blocks cascade;
create or replace view public.blocks as
select
  sr.actor_id as blocker_id,
  sr.target_id as blocked_id,
  now() as created_at
from public.social_relations sr
where sr.relation_type = 'block';

drop view if exists public.likes cascade;
create or replace view public.likes as
select
  (i.user_id::text || ':' || i.event_id::text)::uuid as id,
  i.user_id,
  i.event_id,
  i.interacted_at as created_at
from public.event_interactions i
where i.action_type = 'save';

create table if not exists public.user_achievements (
  user_id uuid references public.profiles(id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

-- 1. RECURRENCE ENGINE
create table public.event_series (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references public.profiles(id) on delete cascade,
  recurrence_pattern text, -- 'weekly', 'monthly', 'daily'
  metadata jsonb, -- Stores custom rules (e.g., "Every Tuesday")
  created_at timestamptz default now()
);

alter table public.events 
add column if not exists series_id uuid references public.event_series(id) on delete set null,
add column if not exists capacity int,
add column if not exists price numeric(10, 2) default 0.00;

-- 2. TICKETING & TRANSACTIONS
create table public.tickets (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  purchase_price numeric(10, 2),
  qr_code_data text unique,
  status text default 'valid', -- 'valid', 'used', 'refunded'
  created_at timestamptz default now()
);

-- 3. TRENDING ALGORITHM (THE BRAIN)
-- This function implements the Gravity Decay formula: Score = (Engagement - 1) / (Time + 2)^Gravity
create or replace function public.calculate_event_heat_index()
returns void as $$
declare
  gravity float := 1.8;
begin
  update public.events e
  set heat_index = (
    (
      select count(*) from public.event_interactions i
      where i.event_id = e.id and i.action_type = 'save'
    ) + 
    (
      select count(*) from public.event_interactions i
      where i.event_id = e.id and i.action_type = 'going'
    ) * 2 + 
    (e.views * 0.1)
  ) / pow(
    extract(epoch from (now() - e.created_at)) / 3600 + 2, 
    gravity
  )
  where is_cancelled = false;
end;
$$ language plpgsql security definer;

-- 4. ACHIEVEMENT AUTOMATION
create or replace function public.check_user_achievements()
returns trigger as $$
begin
  -- 'Social Butterfly' Trigger (50 followers)
  if (select count(*) from public.follows where following_id = new.following_id) >= 50 then
    insert into public.user_achievements (user_id, achievement_id)
    values (new.following_id, 'social_butterfly')
    on conflict do nothing;
    
    -- Notify user
    insert into public.notifications (receiver_id, type, content)
    values (new.following_id, 'achievement_unlocked', 'You unlocked the Social Butterfly achievement!');
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_follow_check_achievement
  after insert on public.follows
  for each row execute procedure public.check_user_achievements();

-- 5. NOTIFICATION AGGREGATION
-- Prevents notification spam (e.g., "User A and 5 others liked your event")
create or replace function public.notify_on_like()
returns trigger as $$
begin
  insert into public.notifications (receiver_id, actor_id, type, entity_id, content)
  select 
    author_id, 
    new.user_id, 
    'event_like', 
    new.event_id,
    'liked your event'
  from public.events
  where id = new.event_id
  -- Only notify if the liker is not the author
  and author_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_like_notification
  after insert on public.likes
  for each row execute procedure public.notify_on_like();

-- 6. SEARCH VIEWS
-- A materialized view for rapid discovery of "Hot" events
drop materialized view if exists public.trending_events;
create materialized view public.trending_events as
  select e.*, p.name as author_name, p.avatar_url as author_avatar
  from public.events e
  join public.profiles p on e.user_id = p.id
  where e.event_date > now()
  order by e.heat_index desc;

create index idx_trending_heat on public.trending_events(heat_index desc);

-- 7. REAL-TIME REPLICATION
-- Enable Realtime for messaging and heat index updates
begin;
  -- drop existing if any
  drop publication if exists supabase_realtime;
  -- create publication
  create publication supabase_realtime for table 
    public.messages, 
    public.conversations, 
    public.notifications,
    public.events; -- So the Heat Index updates on the UI live
commit;

-- 14. SEARCH ENGINE OPTIMIZATION (Weighted FTS)
-- Adds a generated column for high-speed, ranked searching
alter table public.events 
add column if not exists fts_vector tsvector 
generated always as (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') || 
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'C')
) stored;

create index if not exists idx_events_fts on public.events using gin(fts_vector);

-- 15. WAITLIST ENGINE
create table public.event_waitlist (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  priority_score int default 0, -- Higher for premium members
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

-- 16. THE SOCIAL FILTER (Clean Feed View)
-- This view automatically removes content from blocked/muted users for the viewer
drop view if exists public.active_feed cascade;
create or replace view public.active_feed as
  select e.*, p.name as author_name, p.avatar_url as author_avatar
  from public.events e
  join public.profiles p on e.user_id = p.id
  where e.is_cancelled = false
  and not exists (
    select 1 from public.blocks b 
    where (b.blocker_id = auth.uid() and b.blocked_id = e.user_id)
    or (b.blocker_id = e.user_id and b.blocked_id = auth.uid())
  )
  and not exists (
    select 1 from public.mutes m
    where m.muter_id = auth.uid() and m.muted_user_id = e.user_id
  );

-- 17. AUTOMATED MODERATION (Keyword Guard)
create table public.prohibited_keywords (
  word text primary key,
  severity text default 'low' -- 'low' flags, 'high' auto-deletes
);

create or replace function public.auto_moderate_content()
returns trigger as $$
declare
  found_word text;
begin
  select word into found_word 
  from public.prohibited_keywords 
  where new.description ilike '%' || word || '%' 
  limit 1;

  if found_word is not null then
    insert into public.reports (reporter_id, target_event_id, reason, details)
    values (
      '00000000-0000-0000-0000-000000000000'::uuid, -- System ID
      new.id, 
      'inappropriate', 
      'Auto-flagged for keyword: ' || found_word
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_event_moderate
  before insert or update on public.events
  for each row execute procedure public.auto_moderate_content();

-- 18. GAMIFICATION: AUTOMATIC LEVELING
create or replace function public.calculate_user_level()
returns trigger as $$
begin
  -- Logic: Level = floor(sqrt(xp / 100)) + 1
  -- Example: 400 XP = Level 3, 900 XP = Level 4
  new.level := floor(sqrt(new.xp / 100)) + 1;
  
  -- Check for level up notification
  if new.level > old.level then
    insert into public.notifications (receiver_id, type, content)
    values (new.id, 'achievement_unlocked', 'Congratulations! You reached Level ' || new.level);
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger on_xp_change_level_up
  before update of xp on public.profiles
  for each row execute procedure public.calculate_user_level();

-- 19. ANALYTICS AGGREGATOR
-- Index for finding most active categories in last 7 days
create index if not exists idx_events_category_date on public.events(category, event_date);

-- 8. CONCURRENCY & INTEGRITY (The Shield)
-- Trigger to prevent overselling tickets and ensure atomic capacity updates
create or replace function public.handle_ticket_purchase()
returns trigger as $$
declare
  event_capacity int;
  tickets_sold int;
begin
  -- Lock the event row for update to prevent race conditions
  select capacity into event_capacity from public.events where id = new.event_id for update;
  select count(*) into tickets_sold from public.tickets where event_id = new.event_id and status = 'valid';

  if event_capacity is not null and tickets_sold >= event_capacity then
    raise exception 'This event is at full capacity.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger on_ticket_purchase
  before insert on public.tickets
  for each row execute procedure public.handle_ticket_purchase();

-- 9. ADVANCED DISCOVERY (The Eyes)
-- Geospatial search function for finding events within X kilometers
create or replace function public.get_nearby_events(
  user_lat float, 
  user_long float, 
  radius_km float
)
returns setof public.events as $$
begin
  return query
  select *
  from public.events
  where st_dwithin(
    location_coords,
    st_setSRID(st_point(user_long, user_lat), 4326)::geography,
    radius_km * 1000 -- Convert km to meters
  )
  and is_cancelled = false
  and event_date > now()
  order by location_coords <-> st_setSRID(st_point(user_long, user_lat), 4326)::geography;
end;
$$ language plpgsql stable;

-- 10. SAFETY GATEKEEPER (The Law)
-- Prevent suspended users from interacting
create or replace function public.check_user_status()
returns trigger as $$
begin
  if (select is_suspended from public.profiles where id = auth.uid()) then
    raise exception 'Account is suspended. Action denied.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger ensure_user_not_suspended_event
  before insert or update on public.events
  for each row execute procedure public.check_user_status();

create trigger ensure_user_not_suspended_msg
  before insert on public.messages
  for each row execute procedure public.check_user_status();

-- 11. REFRESH AUTOMATION
-- Function to refresh trending view (can be called via Supabase Edge Function / Cron)
create or replace function public.refresh_trending_events()
returns void as $$
begin
  refresh materialized view concurrently public.trending_events;
end;
$$ language plpgsql;

-- 12. MESSAGING REFINEMENT
-- Support for message threading and reactions
alter table public.messages 
add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

create table if not exists public.message_reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- 13. INDEXING FOR SCALE
create index if not exists idx_profiles_is_suspended on public.profiles(is_suspended) where is_suspended = true;
create index if not exists idx_events_series on public.events(series_id);
create index if not exists idx_tickets_user_event on public.tickets(user_id, event_id);
create index if not exists idx_messages_reply_to on public.messages(reply_to_id);
create index if not exists idx_comments_parent on public.comments(parent_id);
create index if not exists idx_activity_logs_user_action on public.activity_logs(user_id, action);