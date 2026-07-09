-- ═══════════════════════════════════════════════════════════════════════════
-- resident_schema_v2.sql — The Resident (connected app) schema, hardened
--
-- Replaces TheResident/resident_schema.sql (v1) BEFORE it ever runs on the
-- shared live DB. Same product surface, brought up to The Gruvs' security
-- standard (see security_layers.sql):
--
--   • All tables prefixed res_ (v1 used generic names — `listings`,
--     `notice_events` — collision-prone in a 100+ table shared DB).
--   • v1 regressions fixed: USING(true) manage-policy on chores (anyone could
--     edit anyone's chores), public SELECT on room applications and disputes,
--     publicly readable prepaid electricity token_code (real money value!),
--     FOR ALL policies without WITH CHECK, client-editable balance wallet.
--   • Broker model (no money handling): prices are DISPLAY data; payment
--     happens off-platform; no wallet/balance columns; token codes are never
--     stored — delivery via DM after the parties settle off-platform.
--   • Denormalized *_name columns removed (join profiles; names go stale and
--     can be spoofed).
--   • TIMESTAMPTZ, touch_updated_at() reuse, FK/geo indexes, res_ RPC with
--     pinned search_path + explicit grants (functions are default-deny now).
--
-- Shared-identity contract: every table FKs public.profiles(id) — the SAME
-- account works in The Gruvs and The Resident (SSO). The Resident reads
-- Gruvs trust columns (vibe_score, is_verified) read-only; it writes ONLY
-- res_* tables. See CONTRACT.md in both repos.
--
-- Idempotent. Includes a guarded rename in case v1 was ever run live.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── 0. Guarded migration: if v1 tables exist, rename instead of duplicating ──
do $$
begin
  -- lift_clubs is Resident-specific — its presence means v1 was applied
  if to_regclass('public.lift_clubs') is not null and to_regclass('public.res_lift_clubs') is null then
    alter table public.resident_profiles  rename to res_profiles;
    alter table public.listings           rename to res_listings;
    alter table public.room_requests      rename to res_room_requests;
    alter table public.lift_clubs         rename to res_lift_clubs;
    alter table public.handyman_services  rename to res_handyman_services;
    alter table public.service_dispatches rename to res_service_dispatches;
    alter table public.utility_tokens     rename to res_utility_tokens;
    alter table public.tool_library       rename to res_tool_library;
    alter table public.chore_schedule     rename to res_chore_schedule;
    alter table public.community_disputes rename to res_community_disputes;
    alter table public.roommate_seekers   rename to res_roommate_seekers;
    alter table public.notice_events      rename to res_notice_events;
  end if;
end $$;

-- ── 1. TABLES ────────────────────────────────────────────────────────────────

-- Resident extension of the shared Gruvs profile (role & living preferences).
-- No balance/wallet (broker model). verification_doc_url is PRIVATE (own-row
-- + relationship-scoped SELECT below).
create table if not exists public.res_profiles (
  id uuid references public.profiles(id) on delete cascade primary key,
  role text not null check (role in ('tenant', 'landlord', 'visitor')),
  bio text,
  gender text check (gender in ('men', 'women', 'any')),
  children_count integer default 0,
  employment_status text,
  has_pets boolean default false,
  verification_doc_url text,
  landlord_gender_pref text check (landlord_gender_pref in ('men', 'women', 'couple', 'any')),
  landlord_children_allowed boolean default true,
  landlord_max_children integer default 0,
  landlord_smoking_allowed boolean default false,
  landlord_pets_allowed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Rooms / spaces for rent. Public ad by design (visibility = safety).
-- lat/lon follow the Gruvs convention so listings can surface on maps later.
create table if not exists public.res_listings (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  price numeric not null,              -- display only; payment off-platform
  currency text default 'ZAR',
  location text not null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  safety_rating text check (safety_rating in ('high', 'medium', 'low')) default 'medium',
  safety_notes text,
  landlord_lives_here boolean default false,
  images text[] default '{}',
  wifi boolean default false,
  parking boolean default false,
  bathroom text check (bathroom in ('shared', 'private', 'ensuite')) default 'shared',
  req_gender_pref text check (req_gender_pref in ('men', 'women', 'couple', 'any')) default 'any',
  req_children_allowed boolean default true,
  req_max_children integer default 0,
  req_smoking_allowed boolean default false,
  req_pets_allowed boolean default false,
  status text check (status in ('open', 'taken', 'paused')) default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Room applications. PRIVATE between tenant and landlord (v1 exposed all
-- applications publicly).
create table if not exists public.res_room_requests (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.profiles(id) on delete cascade not null,
  listing_id uuid references public.res_listings(id) on delete cascade not null,
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  message text,
  created_at timestamptz default now(),
  unique (tenant_id, listing_id)
);

-- Lift clubs — the bakkie / transport side. Public ad by design.
-- event_id is the Phase-3 bridge: a lift attached to a Gruvs event.
create table if not exists public.res_lift_clubs (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references public.profiles(id) on delete cascade not null,
  origin text not null,
  destination text not null,
  origin_lat double precision,
  origin_lon double precision,
  dest_lat double precision,
  dest_lon double precision,
  departure_time text,
  days text,
  price_per_seat numeric not null,     -- display only; payment off-platform
  currency text default 'ZAR',
  available_seats integer not null check (available_seats >= 0),
  total_seats integer not null check (total_seats > 0),
  event_id uuid references public.events(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Handyman / mover businesses. Public directory by design.
create table if not exists public.res_handyman_services (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  business_name text not null,
  category text not null,
  location text not null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  rating numeric default 5.0 check (rating >= 0 and rating <= 5),
  contact_number text,
  website_url text,
  price_estimate text,                 -- display only
  description text,
  image text,
  reviews_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Job dispatches to a handyman. Private between sender and business owner.
create table if not exists public.res_service_dispatches (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid references public.res_handyman_services(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  message text,
  status text check (status in ('pending', 'accepted', 'completed')) default 'pending',
  proof_file_url text,
  created_at timestamptz default now()
);

-- Prepaid utility offers — BROKER model. v1 stored the actual token_code in a
-- publicly readable row (stealable money). v2 stores the OFFER only; the code
-- is delivered person-to-person (Gruvs DM) after off-platform payment.
create table if not exists public.res_utility_tokens (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  meter_label text,                    -- display label, NOT the meter number
  price numeric not null,              -- display only
  currency text default 'ZAR',
  status text check (status in ('available', 'claimed')) default 'available',
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz default now()
);

-- P2P tool lending. Public catalogue; deposit/price are display-only.
create table if not exists public.res_tool_library (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  price_per_day numeric not null,      -- display only
  currency text default 'ZAR',
  deposit numeric default 0,           -- display only
  location text,
  suburb text,
  status text check (status in ('available', 'rented')) default 'available',
  rented_by uuid references public.profiles(id) on delete set null,
  rented_until date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Co-living chores. v1 let ANYONE manage anyone's chores (USING(true)).
-- v2 scopes to the household: the listing's landlord + its approved tenants.
create table if not exists public.res_chore_schedule (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references public.res_listings(id) on delete cascade not null,
  roommate_id uuid references public.profiles(id) on delete cascade not null,
  task_name text not null,
  day_of_week text,
  status text check (status in ('pending', 'completed')) default 'pending',
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Disputes. Visible ONLY to the parties + mediator (v1 was public).
create table if not exists public.res_community_disputes (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category text check (category in ('Noise', 'Messiness', 'Utility overuse', 'Chore avoidance', 'Security breach', 'Other')) default 'Other',
  reported_by_id uuid references public.profiles(id) on delete cascade not null,
  against_user_id uuid references public.profiles(id) on delete set null,
  mediator_id uuid references public.profiles(id) on delete set null,
  status text check (status in ('pending', 'mediating', 'resolved')) default 'pending',
  resolution_details text,
  created_at timestamptz default now()
);

-- Roommate-wanted ads. Public by intent (it IS an advert).
create table if not exists public.res_roommate_seekers (
  id uuid references public.profiles(id) on delete cascade primary key,
  gender text check (gender in ('men', 'women')),
  children_count integer default 0,
  budget numeric,
  currency text default 'ZAR',
  location text,
  suburb text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Community notices & mini-events. RSVPs go through res_toggle_rsvp() so
-- non-authors can RSVP without an open UPDATE policy on the row.
create table if not exists public.res_notice_events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  type text check (type in ('notice', 'event')),
  posted_by_id uuid references public.profiles(id) on delete cascade not null,
  event_date date,
  rsvps uuid[] default '{}',
  created_at timestamptz default now()
);

-- ── 2. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists idx_res_listings_landlord   on public.res_listings (landlord_id);
create index if not exists idx_res_listings_suburb     on public.res_listings (suburb);
create index if not exists idx_res_listings_status     on public.res_listings (status);
create index if not exists idx_res_requests_tenant     on public.res_room_requests (tenant_id);
create index if not exists idx_res_requests_landlord   on public.res_room_requests (landlord_id);
create index if not exists idx_res_requests_listing    on public.res_room_requests (listing_id);
create index if not exists idx_res_lifts_driver        on public.res_lift_clubs (driver_id);
create index if not exists idx_res_lifts_event         on public.res_lift_clubs (event_id);
create index if not exists idx_res_handyman_owner      on public.res_handyman_services (owner_id);
create index if not exists idx_res_handyman_suburb     on public.res_handyman_services (suburb);
create index if not exists idx_res_dispatch_service    on public.res_service_dispatches (service_id);
create index if not exists idx_res_dispatch_sender     on public.res_service_dispatches (sender_id);
create index if not exists idx_res_tokens_landlord     on public.res_utility_tokens (landlord_id);
create index if not exists idx_res_tools_owner         on public.res_tool_library (owner_id);
create index if not exists idx_res_chores_listing      on public.res_chore_schedule (listing_id);
create index if not exists idx_res_chores_roommate     on public.res_chore_schedule (roommate_id);
create index if not exists idx_res_disputes_reporter   on public.res_community_disputes (reported_by_id);
create index if not exists idx_res_notices_poster      on public.res_notice_events (posted_by_id);

-- ── 3. updated_at triggers (reuse the Gruvs pinned touch_updated_at) ─────────
do $$
declare t text;
begin
  foreach t in array array['res_profiles','res_listings','res_lift_clubs',
                           'res_handyman_services','res_tool_library','res_roommate_seekers']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ── 4. HELPERS ───────────────────────────────────────────────────────────────

-- Household membership: the listing's landlord or an approved tenant.
create or replace function public.res_is_household_member(p_listing uuid, p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from res_listings l where l.id = p_listing and l.landlord_id = p_user
  ) or exists (
    select 1 from res_room_requests r
    where r.listing_id = p_listing and r.tenant_id = p_user and r.status = 'approved'
  );
$$;

-- RSVP toggle for notices — lets any signed-in resident RSVP without an open
-- UPDATE policy on the row itself.
create or replace function public.res_toggle_rsvp(p_notice_id uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare joined boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update res_notice_events
     set rsvps = case when auth.uid() = any(rsvps)
                      then array_remove(rsvps, auth.uid())
                      else array_append(rsvps, auth.uid()) end
   where id = p_notice_id
  returning auth.uid() = any(rsvps) into joined;
  return coalesce(joined, false);
end;
$$;

-- Functions are default-deny on this DB (security_layers.sql) — grant explicitly.
revoke execute on function public.res_is_household_member(uuid, uuid) from public, anon;
revoke execute on function public.res_toggle_rsvp(uuid) from public, anon;
grant execute on function public.res_is_household_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.res_toggle_rsvp(uuid) to authenticated, service_role;

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
alter table public.res_profiles           enable row level security;
alter table public.res_listings           enable row level security;
alter table public.res_room_requests      enable row level security;
alter table public.res_lift_clubs         enable row level security;
alter table public.res_handyman_services  enable row level security;
alter table public.res_service_dispatches enable row level security;
alter table public.res_utility_tokens     enable row level security;
alter table public.res_tool_library       enable row level security;
alter table public.res_chore_schedule     enable row level security;
alter table public.res_community_disputes enable row level security;
alter table public.res_roommate_seekers   enable row level security;
alter table public.res_notice_events      enable row level security;

-- The Resident is a signed-in product ("vetted sanctuary") — no anon access.
-- All policies are TO authenticated; writes always carry WITH CHECK.

-- res_profiles: own row fully; others readable only inside an application
-- relationship (landlord ↔ applicant need each other's living preferences).
drop policy if exists res_profiles_select on public.res_profiles;
create policy res_profiles_select on public.res_profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.res_room_requests r
      where (r.tenant_id = res_profiles.id and r.landlord_id = auth.uid())
         or (r.landlord_id = res_profiles.id and r.tenant_id = auth.uid())
    )
  );
drop policy if exists res_profiles_insert on public.res_profiles;
create policy res_profiles_insert on public.res_profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists res_profiles_update on public.res_profiles;
create policy res_profiles_update on public.res_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists res_profiles_delete on public.res_profiles;
create policy res_profiles_delete on public.res_profiles
  for delete to authenticated using (id = auth.uid());

-- res_listings: public ad (all residents), owner-managed.
drop policy if exists res_listings_select on public.res_listings;
create policy res_listings_select on public.res_listings
  for select to authenticated using (true);
drop policy if exists res_listings_write on public.res_listings;
create policy res_listings_write on public.res_listings
  for insert to authenticated with check (landlord_id = auth.uid());
drop policy if exists res_listings_update on public.res_listings;
create policy res_listings_update on public.res_listings
  for update to authenticated using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
drop policy if exists res_listings_delete on public.res_listings;
create policy res_listings_delete on public.res_listings
  for delete to authenticated using (landlord_id = auth.uid());

-- res_room_requests: PRIVATE to tenant + landlord.
drop policy if exists res_requests_select on public.res_room_requests;
create policy res_requests_select on public.res_room_requests
  for select to authenticated using (tenant_id = auth.uid() or landlord_id = auth.uid());
drop policy if exists res_requests_insert on public.res_room_requests;
create policy res_requests_insert on public.res_room_requests
  for insert to authenticated with check (tenant_id = auth.uid());
drop policy if exists res_requests_update on public.res_room_requests;
create policy res_requests_update on public.res_room_requests
  for update to authenticated
  using (tenant_id = auth.uid() or landlord_id = auth.uid())
  with check (tenant_id = auth.uid() or landlord_id = auth.uid());
drop policy if exists res_requests_delete on public.res_room_requests;
create policy res_requests_delete on public.res_room_requests
  for delete to authenticated using (tenant_id = auth.uid());

-- res_lift_clubs: public ad, driver-managed.
drop policy if exists res_lifts_select on public.res_lift_clubs;
create policy res_lifts_select on public.res_lift_clubs
  for select to authenticated using (true);
drop policy if exists res_lifts_insert on public.res_lift_clubs;
create policy res_lifts_insert on public.res_lift_clubs
  for insert to authenticated with check (driver_id = auth.uid());
drop policy if exists res_lifts_update on public.res_lift_clubs;
create policy res_lifts_update on public.res_lift_clubs
  for update to authenticated using (driver_id = auth.uid()) with check (driver_id = auth.uid());
drop policy if exists res_lifts_delete on public.res_lift_clubs;
create policy res_lifts_delete on public.res_lift_clubs
  for delete to authenticated using (driver_id = auth.uid());

-- res_handyman_services: public directory, owner-managed.
drop policy if exists res_handyman_select on public.res_handyman_services;
create policy res_handyman_select on public.res_handyman_services
  for select to authenticated using (true);
drop policy if exists res_handyman_insert on public.res_handyman_services;
create policy res_handyman_insert on public.res_handyman_services
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists res_handyman_update on public.res_handyman_services;
create policy res_handyman_update on public.res_handyman_services
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists res_handyman_delete on public.res_handyman_services;
create policy res_handyman_delete on public.res_handyman_services
  for delete to authenticated using (owner_id = auth.uid());

-- res_service_dispatches: private to sender + the business owner.
drop policy if exists res_dispatch_select on public.res_service_dispatches;
create policy res_dispatch_select on public.res_service_dispatches
  for select to authenticated
  using (
    sender_id = auth.uid()
    or exists (select 1 from public.res_handyman_services s
               where s.id = res_service_dispatches.service_id and s.owner_id = auth.uid())
  );
drop policy if exists res_dispatch_insert on public.res_service_dispatches;
create policy res_dispatch_insert on public.res_service_dispatches
  for insert to authenticated with check (sender_id = auth.uid());
drop policy if exists res_dispatch_update on public.res_service_dispatches;
create policy res_dispatch_update on public.res_service_dispatches
  for update to authenticated
  using (
    sender_id = auth.uid()
    or exists (select 1 from public.res_handyman_services s
               where s.id = res_service_dispatches.service_id and s.owner_id = auth.uid())
  )
  with check (
    sender_id = auth.uid()
    or exists (select 1 from public.res_handyman_services s
               where s.id = res_service_dispatches.service_id and s.owner_id = auth.uid())
  );

-- res_utility_tokens: offers are public (they're ads), landlord-managed;
-- claimant may mark claimed. No codes stored, so nothing stealable.
drop policy if exists res_tokens_select on public.res_utility_tokens;
create policy res_tokens_select on public.res_utility_tokens
  for select to authenticated using (true);
drop policy if exists res_tokens_insert on public.res_utility_tokens;
create policy res_tokens_insert on public.res_utility_tokens
  for insert to authenticated with check (landlord_id = auth.uid());
drop policy if exists res_tokens_update on public.res_utility_tokens;
create policy res_tokens_update on public.res_utility_tokens
  for update to authenticated
  using (landlord_id = auth.uid() or claimed_by = auth.uid() or (status = 'available' and auth.uid() is not null))
  with check (landlord_id = auth.uid() or claimed_by = auth.uid());
drop policy if exists res_tokens_delete on public.res_utility_tokens;
create policy res_tokens_delete on public.res_utility_tokens
  for delete to authenticated using (landlord_id = auth.uid());

-- res_tool_library: public catalogue, owner-managed; renter may update status.
drop policy if exists res_tools_select on public.res_tool_library;
create policy res_tools_select on public.res_tool_library
  for select to authenticated using (true);
drop policy if exists res_tools_insert on public.res_tool_library;
create policy res_tools_insert on public.res_tool_library
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists res_tools_update on public.res_tool_library;
create policy res_tools_update on public.res_tool_library
  for update to authenticated
  using (owner_id = auth.uid() or rented_by = auth.uid())
  with check (owner_id = auth.uid() or rented_by = auth.uid());
drop policy if exists res_tools_delete on public.res_tool_library;
create policy res_tools_delete on public.res_tool_library
  for delete to authenticated using (owner_id = auth.uid());

-- res_chore_schedule: household members only (v1 was USING(true) for ALL).
drop policy if exists res_chores_select on public.res_chore_schedule;
create policy res_chores_select on public.res_chore_schedule
  for select to authenticated
  using (public.res_is_household_member(listing_id, auth.uid()));
drop policy if exists res_chores_insert on public.res_chore_schedule;
create policy res_chores_insert on public.res_chore_schedule
  for insert to authenticated
  with check (public.res_is_household_member(listing_id, auth.uid()));
drop policy if exists res_chores_update on public.res_chore_schedule;
create policy res_chores_update on public.res_chore_schedule
  for update to authenticated
  using (public.res_is_household_member(listing_id, auth.uid()))
  with check (public.res_is_household_member(listing_id, auth.uid()));
drop policy if exists res_chores_delete on public.res_chore_schedule;
create policy res_chores_delete on public.res_chore_schedule
  for delete to authenticated
  using (public.res_is_household_member(listing_id, auth.uid()));

-- res_community_disputes: parties + mediator ONLY (v1 was public).
drop policy if exists res_disputes_select on public.res_community_disputes;
create policy res_disputes_select on public.res_community_disputes
  for select to authenticated
  using (reported_by_id = auth.uid() or against_user_id = auth.uid() or mediator_id = auth.uid());
drop policy if exists res_disputes_insert on public.res_community_disputes;
create policy res_disputes_insert on public.res_community_disputes
  for insert to authenticated with check (reported_by_id = auth.uid());
drop policy if exists res_disputes_update on public.res_community_disputes;
create policy res_disputes_update on public.res_community_disputes
  for update to authenticated
  using (reported_by_id = auth.uid() or mediator_id = auth.uid())
  with check (reported_by_id = auth.uid() or mediator_id = auth.uid());

-- res_roommate_seekers: public ad by intent, own-row managed.
drop policy if exists res_seekers_select on public.res_roommate_seekers;
create policy res_seekers_select on public.res_roommate_seekers
  for select to authenticated using (true);
drop policy if exists res_seekers_write on public.res_roommate_seekers;
create policy res_seekers_write on public.res_roommate_seekers
  for insert to authenticated with check (id = auth.uid());
drop policy if exists res_seekers_update on public.res_roommate_seekers;
create policy res_seekers_update on public.res_roommate_seekers
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists res_seekers_delete on public.res_roommate_seekers;
create policy res_seekers_delete on public.res_roommate_seekers
  for delete to authenticated using (id = auth.uid());

-- res_notice_events: readable by residents; poster manages; RSVPs via RPC.
drop policy if exists res_notices_select on public.res_notice_events;
create policy res_notices_select on public.res_notice_events
  for select to authenticated using (true);
drop policy if exists res_notices_insert on public.res_notice_events;
create policy res_notices_insert on public.res_notice_events
  for insert to authenticated with check (posted_by_id = auth.uid());
drop policy if exists res_notices_update on public.res_notice_events;
create policy res_notices_update on public.res_notice_events
  for update to authenticated using (posted_by_id = auth.uid()) with check (posted_by_id = auth.uid());
drop policy if exists res_notices_delete on public.res_notice_events;
create policy res_notices_delete on public.res_notice_events
  for delete to authenticated using (posted_by_id = auth.uid());
