-- ═══════════════════════════════════════════════════════════════════════════
-- schema_drift_fixes.sql — close the gaps the app genuinely needs
--
-- A live audit of all 360 client queries found 24 failing against production.
-- Most were the CODE being wrong (wrong column name) and were fixed in the app.
-- The ones below are the DATABASE genuinely missing something the product needs,
-- so they are fixed here instead of hacked around in the client.
--
-- Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. profiles columns that exist live but in zero tracked SQL files ───────
-- Found 2026-08-20 while wiring Event Depth Engine Phase 0 CI: a fresh
-- rebuild from tracked files alone hit "column X does not exist" in
-- res_map_bridge.sql / resident_schema_v2.sql / lock_profile_coordinates.sql
-- and others, one column at a time. Each was hand-added to production at
-- some point and never saved back to a migration file. This file runs early
-- (5th) so every later file that references these can find them. Types/
-- defaults confirmed against live information_schema.
alter table public.profiles add column if not exists lat double precision;
alter table public.profiles add column if not exists lon double precision;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists banner text;
alter table public.profiles add column if not exists career_title text;
alter table public.profiles add column if not exists career_description text;
alter table public.profiles add column if not exists looks_description text;
alter table public.profiles add column if not exists points integer default 0;
alter table public.profiles add column if not exists privacy text default 'public';
alter table public.profiles add column if not exists reputation integer default 100;
alter table public.profiles add column if not exists streak integer default 0;
alter table public.profiles add column if not exists tags text[] default '{}';
alter table public.profiles add column if not exists wants_email boolean not null default true;

-- ── 0b. crews / crew_members / crew_invites — existed live, ZERO tracked ────
-- files defined them at all (not just columns this time — the whole feature's
-- tables). Found 2026-08-20 when event_drafts.sql (which references
-- crews(id)) died with "relation crews does not exist" during db-schema-ci.
-- Added verbatim from pg_get_constraintdef + information_schema against
-- production; fix_crew_invite_rls_recursion.sql (later in this batch)
-- already assumes these tables exist.
CREATE TABLE IF NOT EXISTS public.crews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 60),
  description text CHECK (char_length(description) <= 280),
  icon        text DEFAULT 'account-group',
  color       text DEFAULT '#7c3aed',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crew_members (
  crew_id    uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (crew_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.crew_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id     uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  inviter_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (crew_id, invitee_id)
);

-- ── 1. event_rsvps needs a primary key ──────────────────────────────────────
-- The whole ticketing / QR check-in system is keyed on an RSVP id:
--   EventTicketModal: `if (!rsvp?.id) return;`  → always bailed
--   generate_ticket_token(p_rsvp_id)            → never callable
--   gruvsticket://<event_id>/<user_id>/<rsvp_id>
-- event_rsvps has only the composite (event_id, user_id), so tickets NEVER
-- rendered for anyone. Give it a stable id.
alter table public.event_rsvps
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_rsvps'::regclass and contype = 'u'
      and conname = 'event_rsvps_id_key'
  ) then
    alter table public.event_rsvps add constraint event_rsvps_id_key unique (id);
  end if;
end $$;

create index if not exists idx_event_rsvps_id on public.event_rsvps (id);


-- ── 2. activity_feed is missing every content column ────────────────────────
-- ActivityFeedManager selects action_type/target_*/actor_* but the table only
-- has id, actor_id, recipient_id, read, created_at — so the Activity Centre
-- always errored. Add the columns it was written against.
alter table public.activity_feed
  add column if not exists action_type   text,
  add column if not exists target_id     uuid,
  add column if not exists target_type   text,
  add column if not exists target_title  text,
  add column if not exists actor_username text,
  add column if not exists actor_avatar  text;

create index if not exists idx_activity_feed_recipient
  on public.activity_feed (recipient_id, created_at desc);


-- ── 3. Missing foreign keys — PostgREST embeds need them ────────────────────
-- "Could not find a relationship between X and Y in the schema cache" means the
-- FK doesn't exist, so `crew_members(profiles(...))`-style embeds 400. The Crew
-- feature (join/invite) is dead because of this.
do $$
begin
  -- crew_members.user_id -> profiles.id
  if not exists (select 1 from pg_constraint where conname = 'crew_members_user_id_fkey') then
    alter table public.crew_members
      add constraint crew_members_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;

  -- crew_invites.inviter_id / invitee_id -> profiles.id
  if not exists (select 1 from pg_constraint where conname = 'crew_invites_inviter_id_fkey') then
    alter table public.crew_invites
      add constraint crew_invites_inviter_id_fkey
      foreign key (inviter_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crew_invites_invitee_id_fkey') then
    alter table public.crew_invites
      add constraint crew_invites_invitee_id_fkey
      foreign key (invitee_id) references public.profiles(id) on delete cascade;
  end if;

  -- sport_match_events.user_id -> profiles.id (clubEngine embed)
  if exists (select 1 from information_schema.columns
             where table_name = 'sport_match_events' and column_name = 'user_id')
     and not exists (select 1 from pg_constraint where conname = 'sport_match_events_user_id_fkey') then
    alter table public.sport_match_events
      add constraint sport_match_events_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete set null;
  end if;
exception when others then
  raise notice 'FK add skipped: %', sqlerrm;  -- orphan rows would block it
end $$;


-- ── 4. Verify (run after applying) ──────────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_name = 'event_rsvps' and column_name = 'id';
-- select column_name from information_schema.columns
--  where table_name = 'activity_feed' order by ordinal_position;
