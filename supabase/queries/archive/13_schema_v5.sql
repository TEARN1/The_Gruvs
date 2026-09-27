-- ============================================================
--  THE GRUVS — COMPLETE DATABASE SCHEMA  v5
--  Single authoritative file. Replaces all previous patches.
--
--  Paste into: Supabase → SQL Editor → Run
--  Fully idempotent — safe to run on a fresh OR existing project.
--  Every statement uses IF NOT EXISTS / OR REPLACE / DROP … IF EXISTS
--  so re-running never errors.
--
--  Sections:
--   1. Extensions & helpers
--   2. Core: profiles, events, follows
--   3. Event interactions: rsvps, checkins, vibes, roles, waitlist, reminders
--   4. Event content: chat, polls, playlist, carpools, gallery, reactions,
--                     updates, schedule, moments
--   5. Social: echoes, ratings, reels, stories, DMs, activity feed,
--              notifications, bookmarks, blocks, reports
--   6. Commerce: gigs, service nodes, service bookings, wallet, disputes
--   7. Business & ads: business profiles, campaigns, contextual ads
--   8. Analytics & AI: ai cache, security logs, governance
--   9. Utility: paths, routes, hashtags, pulse, app_updates
--  10. Storage buckets
--  11. RLS policies (all tables)
--  12. Functions & triggers
--  13. Indexes
--  14. Push notification infrastructure
-- ============================================================

-- ── 1. EXTENSIONS & HELPERS ──────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION safe_div(a numeric, b numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN b = 0 THEN 0 ELSE a / b END;
$$;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;


-- ── 2. CORE TABLES ───────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username               TEXT        UNIQUE,
  display_name           TEXT,
  avatar_url             TEXT,
  cover_url              TEXT,
  bio                    TEXT,
  location               TEXT,
  city                   TEXT,
  website                TEXT,
  age                    INTEGER,
  gender                 TEXT,
  interests              TEXT[],
  is_verified            BOOLEAN     DEFAULT false,
  is_online              BOOLEAN     DEFAULT false,
  last_seen              TIMESTAMPTZ,
  vibe_score             INTEGER     DEFAULT 0,
  social_integrity_score INTEGER     DEFAULT 100,
  is_discoverable        BOOLEAN     DEFAULT true,
  identity_mode          TEXT        DEFAULT 'public' CHECK (identity_mode IN ('public','semi','ghost')),
  is_beacon_active       BOOLEAN     DEFAULT false,
  privacy_settings       JSONB       DEFAULT '{}',
  push_token             TEXT,
  referral_code          TEXT        UNIQUE,
  referred_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username    ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_city        ON public.profiles (city);
CREATE INDEX IF NOT EXISTS idx_profiles_push_token  ON public.profiles (push_token) WHERE push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_vibe_score  ON public.profiles (vibe_score DESC);
-- Ensure created_at exists on profiles (may be missing from older DB instances)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
DROP TRIGGER IF EXISTS touch_profiles_updated_at ON public.profiles;
CREATE TRIGGER touch_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── events ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL CHECK (length(title) BETWEEN 3 AND 150),
  description     TEXT        CHECK (length(description) <= 2000),
  event_date      DATE,
  event_time      TIME,
  end_time        TIME,
  venue_name      TEXT,
  venue_address   TEXT,
  city            TEXT,
  lat             DOUBLE PRECISION,
  lon             DOUBLE PRECISION,
  price           TEXT,           -- JSON or scalar e.g. '{"general":50,"vip":150}'
  capacity        INTEGER,
  max_attendees   INTEGER,
  ticket_url      TEXT,
  event_type      TEXT,
  category        TEXT,
  categories      TEXT[],
  tags            TEXT[],
  age_restriction INTEGER,
  age_min         INTEGER DEFAULT 0,
  age_max         INTEGER DEFAULT 99,
  media           JSONB,          -- [{type:'image',url:'...'}, ...]
  media_urls      TEXT[],
  cover_url       TEXT,
  cover_image     TEXT,
  rsvp_tiers      JSONB,          -- [{label:'VIP',price:150}, ...]
  vibe_count      INTEGER DEFAULT 0,
  is_published    BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_author      ON public.events (author_id);
CREATE INDEX IF NOT EXISTS idx_events_date        ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_city        ON public.events (city);
CREATE INDEX IF NOT EXISTS idx_events_published   ON public.events (is_published, event_date);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm  ON public.events USING gin (title gin_trgm_ops);
DROP TRIGGER IF EXISTS touch_events_updated_at ON public.events;
CREATE TRIGGER touch_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── follows ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

-- ── blocked_users / muted_users / user_blocks ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS public.muted_users (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, muted_id)
);
-- user_blocks is an alias kept for backward compat
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);


-- ── 3. EVENT INTERACTIONS ────────────────────────────────────────────────────

-- ── event_rsvps ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','not_going')),
  tier       TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rsvps_event  ON public.event_rsvps (event_id, status);
CREATE INDEX IF NOT EXISTS idx_rsvps_user   ON public.event_rsvps (user_id);

-- ── event_checkins ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_checkins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rsvp_id        UUID        REFERENCES public.event_rsvps(id) ON DELETE SET NULL,
  lat            DOUBLE PRECISION,
  lon            DOUBLE PRECISION,
  checked_in_at  TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT event_checkins_rsvp_unique UNIQUE (rsvp_id)
);
CREATE INDEX IF NOT EXISTS idx_checkins_event ON public.event_checkins (event_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_user  ON public.event_checkins (user_id);

-- live_checkins (presence layer — distinct from permanent checkins)
CREATE TABLE IF NOT EXISTS public.live_checkins (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION,
  lon        DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── event_vibes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vibes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── event_roles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('co_host','moderator','scanner','vip_manager')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── event_waitlist ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── event_reminders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_reminders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  remind_at   TIMESTAMPTZ NOT NULL,
  sent        BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);


-- ── 4. EVENT CONTENT ─────────────────────────────────────────────────────────

-- ── event_chat_messages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message     TEXT        NOT NULL CHECK (length(message) BETWEEN 1 AND 500),
  reply_to    UUID        REFERENCES public.event_chat_messages(id) ON DELETE SET NULL,
  is_pinned   BOOLEAN     DEFAULT false,
  deleted     BOOLEAN     DEFAULT false,
  reactions   JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_event ON public.event_chat_messages (event_id, created_at DESC);

-- event_messages (legacy; kept for backward compat)
CREATE TABLE IF NOT EXISTS public.event_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL CHECK (length(body) <= 1000),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── event_polls ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_polls (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL,
  options     JSONB       NOT NULL DEFAULT '[]',
  created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.event_poll_votes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      UUID        NOT NULL REFERENCES public.event_polls(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- ── event_playlists ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_playlists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT,
  created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.event_playlist_tracks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID        NOT NULL REFERENCES public.event_playlists(id) ON DELETE CASCADE,
  track_id    TEXT        NOT NULL,
  track_name  TEXT,
  artist      TEXT,
  album_art   TEXT,
  source      TEXT        DEFAULT 'spotify',
  added_by    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  votes       INTEGER     DEFAULT 0,
  position    INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.event_track_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id    UUID        NOT NULL REFERENCES public.event_playlist_tracks(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT event_track_votes_track_user_unique UNIQUE (track_id, user_id)
);

-- ── event_carpools ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_carpools (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  driver_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seats_available  INTEGER     NOT NULL DEFAULT 3,
  pickup_address   TEXT,
  pickup_lat       DOUBLE PRECISION,
  pickup_lon       DOUBLE PRECISION,
  notes            TEXT,
  return_trip      BOOLEAN     DEFAULT false,
  return_time      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.event_carpool_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id  UUID        NOT NULL REFERENCES public.event_carpools(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── event_gallery ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_gallery (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── event_reactions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id, reaction)
);

-- ── event_updates (LiveEventUpdates component) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_updates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL,
  media_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── event_schedule ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_schedule (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_time  TEXT,
  title       TEXT        NOT NULL,
  performer   TEXT,
  notes       TEXT,
  position    INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── event_moments (24hr stories) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_moments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        NOT NULL CHECK (media_type IN ('image','video')),
  caption     TEXT,
  view_count  INTEGER     DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moments_event ON public.event_moments (event_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.event_moment_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id   UUID        NOT NULL REFERENCES public.event_moments(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(moment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_moment_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id   UUID        NOT NULL REFERENCES public.event_moments(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(moment_id, user_id)
);


-- ── 5. SOCIAL ────────────────────────────────────────────────────────────────

-- ── echoes (comments on events) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.echoes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_echoes_event ON public.echoes (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.echo_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id    UUID        NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(echo_id, user_id)
);

-- ── event_ratings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_ratings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating     INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── reels ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reels (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id     UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  media_url    TEXT        NOT NULL,
  caption      TEXT        CHECK (length(caption) <= 500),
  hashtags     TEXT[],
  likes_count  INTEGER     DEFAULT 0,
  views_count  INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reels_user       ON public.reels (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_event      ON public.reels (event_id);
CREATE INDEX IF NOT EXISTS idx_reels_created    ON public.reels (created_at DESC);

CREATE TABLE IF NOT EXISTS public.reel_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reel_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.reel_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reel_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.reel_reports (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.saved_reels (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, reel_id)
);

-- ── stories (profile-level, not event-specific) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.stories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        DEFAULT 'image' CHECK (media_type IN ('image','video')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.story_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID        NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- ── messages (DMs) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body              TEXT,
  media_url         TEXT,
  read_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  is_request        BOOLEAN     DEFAULT false,
  request_accepted  BOOLEAN,
  deleted_at        TIMESTAMPTZ,
  reactions         JSONB       DEFAULT '{}',
  reply_to          UUID        REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);
-- Migrate old schema: rename user_id → sender_id if table was created with old column name
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='user_id') THEN
    ALTER TABLE public.messages RENAME COLUMN user_id TO sender_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='sender_id') THEN
    ALTER TABLE public.messages ADD COLUMN sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='recipient_id') THEN
    ALTER TABLE public.messages ADD COLUMN recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='read_at') THEN
    ALTER TABLE public.messages ADD COLUMN read_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='delivered_at') THEN
    ALTER TABLE public.messages ADD COLUMN delivered_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='is_request') THEN
    ALTER TABLE public.messages ADD COLUMN is_request BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='request_accepted') THEN
    ALTER TABLE public.messages ADD COLUMN request_accepted BOOLEAN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='deleted_at') THEN
    ALTER TABLE public.messages ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='reactions') THEN
    ALTER TABLE public.messages ADD COLUMN reactions JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='reply_to') THEN
    ALTER TABLE public.messages ADD COLUMN reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON public.messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_convo     ON public.messages (
  LEAST(sender_id, recipient_id),
  GREATEST(sender_id, recipient_id),
  created_at DESC
);

-- dm_rooms (conversation metadata)
CREATE TABLE IF NOT EXISTS public.dm_rooms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_ids UUID[]      NOT NULL,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id     UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  body         TEXT,
  data         JSONB       DEFAULT '{}',
  read         BOOLEAN     DEFAULT false,
  push_error   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON public.notifications (recipient_id) WHERE read = false;

-- ── activity_feed ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type TEXT        NOT NULL,
  event_id      UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  body          TEXT,
  title         TEXT,
  is_read       BOOLEAN     DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_recipient ON public.activity_feed (recipient_id, created_at DESC);

-- ── saved_events (bookmarks) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- ── reports ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id    UUID        NOT NULL,
  target_type  TEXT        NOT NULL CHECK (target_type IN ('event','user','reel','echo','message')),
  reason       TEXT,
  status       TEXT        DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── security_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.security_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type     TEXT        NOT NULL,
  action         TEXT,
  resource_type  TEXT,
  event_id       UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  rsvp_id        UUID,
  reason         TEXT,
  ip_hash        TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_logs_user ON public.security_logs (user_id, created_at DESC);


-- ── 6. COMMERCE ──────────────────────────────────────────────────────────────

-- ── gig_posts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gig_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  pay         NUMERIC,
  pay_rands   NUMERIC,
  category    TEXT,
  time_window TEXT        DEFAULT 'Flexible',
  active      BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gig_acceptances (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id     UUID        NOT NULL REFERENCES public.gig_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gig_id, user_id)
);

-- ── service_nodes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_nodes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  price        NUMERIC(10,2),
  category     TEXT,
  location     TEXT,
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  is_active    BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.service_bookings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_node_id  UUID        NOT NULL REFERENCES public.service_nodes(id) ON DELETE CASCADE,
  client_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cargo_type       TEXT,
  pickup_address   TEXT,
  dropoff_address  TEXT,
  scheduled_at     TIMESTAMPTZ,
  estimated_price  NUMERIC(10,2),
  status           TEXT        NOT NULL DEFAULT 'escrow_held'
                   CHECK (status IN ('escrow_held','in_progress','completed','disputed','cancelled')),
  escrow_held_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  disputed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.service_reviews (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID        NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  reviewer_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating       INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.disputes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID        NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  filed_by     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       TEXT,
  status       TEXT        DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── wallet_transactions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('credit','debit','escrow','release','refund')),
  reference   TEXT,
  meta        JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ── 7. BUSINESS & ADS ───────────────────────────────────────────────────────

-- ── business_profiles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT        NOT NULL,
  category      TEXT,
  tagline       TEXT,
  logo_url      TEXT,
  website       TEXT,
  location      TEXT,
  verified      BOOLEAN     DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.business_page_blocks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  block_type   TEXT        NOT NULL,
  content      JSONB       DEFAULT '{}',
  position     INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.business_partnerships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  partner_id   UUID        NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  status       TEXT        DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, partner_id)
);

-- ── ad_campaigns ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  budget      NUMERIC(10,2) DEFAULT 0,
  spent       NUMERIC(10,2) DEFAULT 0,
  status      TEXT        DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  targeting   JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campaign_analytics (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  impressions  INTEGER     DEFAULT 0,
  clicks       INTEGER     DEFAULT 0,
  conversions  INTEGER     DEFAULT 0,
  date         DATE        DEFAULT CURRENT_DATE
);
CREATE TABLE IF NOT EXISTS public.contextual_ads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  campaign_id  UUID        NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  position     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.audience_segments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  filters     JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ── 8. ANALYTICS, AI & GOVERNANCE ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_recommendations_cache (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  recommendations JSONB       DEFAULT '[]',
  generated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT,
  content    JSONB       DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  memory     JSONB       DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT,
  prediction JSONB       DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.governance_proposals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT        DEFAULT 'open' CHECK (status IN ('open','passed','rejected','cancelled')),
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.governance_votes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID        NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote         TEXT        NOT NULL CHECK (vote IN ('yes','no','abstain')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.app_updates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version    TEXT        NOT NULL,
  notes      TEXT,
  is_forced  BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.global_economy_params (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL UNIQUE,
  value      JSONB       DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ── 9. UTILITY: PATHS, ROUTES, HASHTAGS, PULSE ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.routes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT,
  is_public  BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.route_steps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID        NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  event_id   UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  step_order INTEGER     DEFAULT 0,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.route_joins (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID        NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.paths (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id   UUID        REFERENCES public.routes(id) ON DELETE SET NULL,
  lat        DOUBLE PRECISION,
  lon        DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.path_traces (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION,
  lon        DOUBLE PRECISION,
  accuracy   DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- path_crossings: live DB uses path_id_a/path_id_b schema; create only if not exists
CREATE TABLE IF NOT EXISTS public.path_crossings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id_a     UUID        REFERENCES public.paths(id) ON DELETE CASCADE,
  path_id_b     UUID        REFERENCES public.paths(id) ON DELETE CASCADE,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  overlap_score NUMERIC,
  crossed_at    TIMESTAMPTZ DEFAULT now()
);
-- Add user_id/other_user_id if this is a fresh DB (old schema)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='path_crossings' AND column_name='path_id_a') THEN
    ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS other_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
-- path_stars: live DB uses path_id; create only if not exists
CREATE TABLE IF NOT EXISTS public.path_stars (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path_id     UUID        REFERENCES public.paths(id) ON DELETE CASCADE,
  place_name  TEXT,
  lat         DOUBLE PRECISION,
  lon         DOUBLE PRECISION,
  created_at  TIMESTAMPTZ DEFAULT now()
);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_paths' AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.user_paths CASCADE;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.user_paths (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id   UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hashtags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tag        TEXT        NOT NULL,
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tag, event_id)
);
CREATE TABLE IF NOT EXISTS public.pulse_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pulse_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID        NOT NULL REFERENCES public.pulse_requests(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(request_id, user_id)
);


-- ── 10. STORAGE BUCKETS ──────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('event-media', 'event-media', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('moments', 'moments', true)
  ON CONFLICT (id) DO UPDATE SET public = true;


-- ── 11. RLS POLICIES ─────────────────────────────────────────────────────────
-- Enable RLS on every table first

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checkins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_checkins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_vibes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_waitlist        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reminders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_polls           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_poll_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_playlists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_track_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpools        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpool_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_gallery         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_updates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_schedule        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_moments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_moment_views    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_moment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echoes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echo_likes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ratings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_rooms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_acceptances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_nodes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_page_blocks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contextual_ads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_segments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_memory        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_predictions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_updates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_economy_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_steps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_joins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paths                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_traces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_crossings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_stars            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_paths            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_votes           ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select"     ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert"     ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- ── events ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_select"      ON public.events;
DROP POLICY IF EXISTS "events_insert"      ON public.events;
DROP POLICY IF EXISTS "events_update_own"  ON public.events;
DROP POLICY IF EXISTS "events_delete_own"  ON public.events;
CREATE POLICY "events_select"      ON public.events FOR SELECT USING (is_published = true OR author_id = auth.uid());
CREATE POLICY "events_insert"      ON public.events FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "events_update_own"  ON public.events FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "events_delete_own"  ON public.events FOR DELETE USING (author_id = auth.uid());

-- ── follows ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "follows_select"     ON public.follows;
DROP POLICY IF EXISTS "follows_insert"     ON public.follows;
DROP POLICY IF EXISTS "follows_delete"     ON public.follows;
CREATE POLICY "follows_select"     ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert"     ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete"     ON public.follows FOR DELETE USING (follower_id = auth.uid());

-- ── blocks & mutes ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "blocked_select" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_manage" ON public.blocked_users;
CREATE POLICY "blocked_select" ON public.blocked_users FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "blocked_manage" ON public.blocked_users FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "muted_select"   ON public.muted_users;
DROP POLICY IF EXISTS "muted_manage"   ON public.muted_users;
CREATE POLICY "muted_select"   ON public.muted_users FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "muted_manage"   ON public.muted_users FOR ALL    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_blocks_manage" ON public.user_blocks;
CREATE POLICY "user_blocks_manage" ON public.user_blocks FOR ALL USING (blocker_id = auth.uid());

-- ── event_rsvps ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rsvps_select"         ON public.event_rsvps;
DROP POLICY IF EXISTS "no_self_rsvp"         ON public.event_rsvps;
DROP POLICY IF EXISTS "no_self_rsvp_update"  ON public.event_rsvps;
DROP POLICY IF EXISTS "rsvps_delete"         ON public.event_rsvps;
CREATE POLICY "rsvps_select"        ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "no_self_rsvp"        ON public.event_rsvps FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_id != (SELECT author_id FROM public.events WHERE id = event_id)
  );
CREATE POLICY "no_self_rsvp_update" ON public.event_rsvps FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id != (SELECT author_id FROM public.events WHERE id = event_id));
CREATE POLICY "rsvps_delete"        ON public.event_rsvps FOR DELETE USING (user_id = auth.uid());

-- ── event_checkins ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "checkins_select"          ON public.event_checkins;
DROP POLICY IF EXISTS "checkins_organiser_only"  ON public.event_checkins;
CREATE POLICY "checkins_select"         ON public.event_checkins FOR SELECT USING (true);
CREATE POLICY "checkins_organiser_only" ON public.event_checkins FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT author_id FROM public.events WHERE id = event_id)
    OR auth.uid() IN (
      SELECT user_id FROM public.event_roles
      WHERE event_id = event_checkins.event_id
        AND role IN ('co_host','moderator','scanner')
    )
  );

DROP POLICY IF EXISTS "live_checkins_select" ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins_insert" ON public.live_checkins;
CREATE POLICY "live_checkins_select" ON public.live_checkins FOR SELECT USING (true);
CREATE POLICY "live_checkins_insert" ON public.live_checkins FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── event_vibes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "event_vibes_select" ON public.event_vibes;
DROP POLICY IF EXISTS "no_self_vibe"       ON public.event_vibes;
DROP POLICY IF EXISTS "event_vibes_delete" ON public.event_vibes;
CREATE POLICY "event_vibes_select" ON public.event_vibes FOR SELECT USING (true);
CREATE POLICY "no_self_vibe"       ON public.event_vibes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_id != (SELECT author_id FROM public.events WHERE id = event_id)
  );
CREATE POLICY "event_vibes_delete" ON public.event_vibes FOR DELETE USING (user_id = auth.uid());

-- ── event_roles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "roles_select_member"    ON public.event_roles;
DROP POLICY IF EXISTS "roles_insert_organiser" ON public.event_roles;
DROP POLICY IF EXISTS "roles_delete_organiser" ON public.event_roles;
CREATE POLICY "roles_select_member"    ON public.event_roles FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));
CREATE POLICY "roles_insert_organiser" ON public.event_roles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));
CREATE POLICY "roles_delete_organiser" ON public.event_roles FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

-- ── event_waitlist ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "waitlist_select" ON public.event_waitlist;
DROP POLICY IF EXISTS "waitlist_manage" ON public.event_waitlist;
CREATE POLICY "waitlist_select" ON public.event_waitlist FOR SELECT USING (true);
CREATE POLICY "waitlist_manage" ON public.event_waitlist FOR ALL   USING (user_id = auth.uid());

-- ── event_reminders ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reminders_manage" ON public.event_reminders;
CREATE POLICY "reminders_manage" ON public.event_reminders FOR ALL USING (user_id = auth.uid());

-- ── event_chat_messages ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_select_event_member" ON public.event_chat_messages;
DROP POLICY IF EXISTS "chat_insert_own"          ON public.event_chat_messages;
DROP POLICY IF EXISTS "chat_update_moderator"    ON public.event_chat_messages;
CREATE POLICY "chat_select_event_member" ON public.event_chat_messages FOR SELECT
  USING (deleted = false AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_published = true));
CREATE POLICY "chat_insert_own"          ON public.event_chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND length(trim(message)) BETWEEN 1 AND 500);
CREATE POLICY "chat_update_moderator"    ON public.event_chat_messages FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.event_roles r WHERE r.event_id = event_chat_messages.event_id AND r.user_id = auth.uid() AND r.role IN ('co_host','moderator'))
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_chat_messages.event_id AND e.author_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_messages_select" ON public.event_messages;
DROP POLICY IF EXISTS "event_messages_insert" ON public.event_messages;
CREATE POLICY "event_messages_select" ON public.event_messages FOR SELECT USING (true);
CREATE POLICY "event_messages_insert" ON public.event_messages FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── event_polls ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "polls_select_public" ON public.event_polls;
DROP POLICY IF EXISTS "polls_insert_host"   ON public.event_polls;
DROP POLICY IF EXISTS "polls_delete_host"   ON public.event_polls;
CREATE POLICY "polls_select_public" ON public.event_polls FOR SELECT USING (true);
CREATE POLICY "polls_insert_host"   ON public.event_polls FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.event_roles r WHERE r.event_id = event_polls.event_id AND r.user_id = auth.uid() AND r.role = 'co_host')
    )
  );
CREATE POLICY "polls_delete_host"   ON public.event_polls FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "votes_select_own"   ON public.event_poll_votes;
DROP POLICY IF EXISTS "votes_insert_once"  ON public.event_poll_votes;
CREATE POLICY "votes_select_own"   ON public.event_poll_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_once"  ON public.event_poll_votes FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── event_playlists / tracks / votes ─────────────────────────────────────────
DROP POLICY IF EXISTS "playlists_select"       ON public.event_playlists;
DROP POLICY IF EXISTS "playlists_manage_host"  ON public.event_playlists;
CREATE POLICY "playlists_select"      ON public.event_playlists FOR SELECT USING (true);
CREATE POLICY "playlists_manage_host" ON public.event_playlists FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "playlist_tracks_select" ON public.event_playlist_tracks;
DROP POLICY IF EXISTS "playlist_tracks_insert" ON public.event_playlist_tracks;
DROP POLICY IF EXISTS "playlist_tracks_delete" ON public.event_playlist_tracks;
CREATE POLICY "playlist_tracks_select" ON public.event_playlist_tracks FOR SELECT USING (true);
CREATE POLICY "playlist_tracks_insert" ON public.event_playlist_tracks FOR INSERT WITH CHECK (added_by = auth.uid());
CREATE POLICY "playlist_tracks_delete" ON public.event_playlist_tracks FOR DELETE
  USING (added_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.event_playlists pl JOIN public.events e ON e.id = pl.event_id
    WHERE pl.id = event_playlist_tracks.playlist_id AND e.author_id = auth.uid()
  ));

DROP POLICY IF EXISTS "track_votes_select"     ON public.event_track_votes;
DROP POLICY IF EXISTS "track_votes_insert_own" ON public.event_track_votes;
DROP POLICY IF EXISTS "track_votes_delete"     ON public.event_track_votes;
CREATE POLICY "track_votes_select"     ON public.event_track_votes FOR SELECT USING (true);
CREATE POLICY "track_votes_insert_own" ON public.event_track_votes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "track_votes_delete"     ON public.event_track_votes FOR DELETE USING (user_id = auth.uid());

-- ── event_carpools ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "carpools_select" ON public.event_carpools;
DROP POLICY IF EXISTS "carpools_manage" ON public.event_carpools;
CREATE POLICY "carpools_select" ON public.event_carpools FOR SELECT USING (true);
CREATE POLICY "carpools_manage" ON public.event_carpools FOR ALL   USING (driver_id = auth.uid());
DROP POLICY IF EXISTS "carpool_requests_select" ON public.event_carpool_requests;
DROP POLICY IF EXISTS "carpool_requests_manage" ON public.event_carpool_requests;
CREATE POLICY "carpool_requests_select" ON public.event_carpool_requests FOR SELECT USING (true);
CREATE POLICY "carpool_requests_manage" ON public.event_carpool_requests FOR ALL   USING (user_id = auth.uid());

-- ── event_gallery / reactions / updates / schedule ───────────────────────────
DROP POLICY IF EXISTS "gallery_select" ON public.event_gallery;
DROP POLICY IF EXISTS "gallery_manage" ON public.event_gallery;
CREATE POLICY "gallery_select" ON public.event_gallery FOR SELECT USING (true);
CREATE POLICY "gallery_manage" ON public.event_gallery FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "reactions_select" ON public.event_reactions;
DROP POLICY IF EXISTS "reactions_manage" ON public.event_reactions;
CREATE POLICY "reactions_select" ON public.event_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_manage" ON public.event_reactions FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "updates_select" ON public.event_updates;
DROP POLICY IF EXISTS "updates_insert" ON public.event_updates;
CREATE POLICY "updates_select" ON public.event_updates FOR SELECT USING (true);
CREATE POLICY "updates_insert" ON public.event_updates FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.event_roles r WHERE r.event_id = event_updates.event_id AND r.user_id = auth.uid() AND r.role IN ('co_host','moderator'))
    )
  );
DROP POLICY IF EXISTS "schedule_select" ON public.event_schedule;
DROP POLICY IF EXISTS "schedule_manage" ON public.event_schedule;
CREATE POLICY "schedule_select" ON public.event_schedule FOR SELECT USING (true);
CREATE POLICY "schedule_manage" ON public.event_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

-- ── event_moments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "moments_select" ON public.event_moments;
DROP POLICY IF EXISTS "moments_insert" ON public.event_moments;
DROP POLICY IF EXISTS "moments_delete" ON public.event_moments;
CREATE POLICY "moments_select" ON public.event_moments FOR SELECT USING (true);
CREATE POLICY "moments_insert" ON public.event_moments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "moments_delete" ON public.event_moments FOR DELETE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "moment_views_select" ON public.event_moment_views;
DROP POLICY IF EXISTS "moment_views_insert" ON public.event_moment_views;
CREATE POLICY "moment_views_select" ON public.event_moment_views FOR SELECT USING (true);
CREATE POLICY "moment_views_insert" ON public.event_moment_views FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "no_self_moment_reaction" ON public.event_moment_reactions;
CREATE POLICY "no_self_moment_reaction" ON public.event_moment_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_id != (SELECT user_id FROM public.event_moments WHERE id = moment_id)
  );

-- ── echoes ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "echoes_select" ON public.echoes;
DROP POLICY IF EXISTS "echoes_insert" ON public.echoes;
DROP POLICY IF EXISTS "echoes_update" ON public.echoes;
DROP POLICY IF EXISTS "echoes_delete" ON public.echoes;
CREATE POLICY "echoes_select" ON public.echoes FOR SELECT USING (true);
CREATE POLICY "echoes_insert" ON public.echoes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "echoes_update" ON public.echoes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "echoes_delete" ON public.echoes FOR DELETE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "echo_likes_select" ON public.echo_likes;
DROP POLICY IF EXISTS "echo_likes_manage" ON public.echo_likes;
CREATE POLICY "echo_likes_select" ON public.echo_likes FOR SELECT USING (true);
CREATE POLICY "echo_likes_manage" ON public.echo_likes FOR ALL USING (user_id = auth.uid());

-- ── ratings / gallery ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ratings_select" ON public.event_ratings;
DROP POLICY IF EXISTS "ratings_manage" ON public.event_ratings;
CREATE POLICY "ratings_select" ON public.event_ratings FOR SELECT USING (true);
CREATE POLICY "ratings_manage" ON public.event_ratings FOR ALL USING (user_id = auth.uid());

-- ── reels ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reels_select"      ON public.reels;
DROP POLICY IF EXISTS "reels_insert"      ON public.reels;
DROP POLICY IF EXISTS "reels_update_own"  ON public.reels;
DROP POLICY IF EXISTS "reels_delete_own"  ON public.reels;
CREATE POLICY "reels_select"     ON public.reels FOR SELECT USING (true);
CREATE POLICY "reels_insert"     ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());
-- reel interactions
DROP POLICY IF EXISTS "reel_likes_select"    ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_manage"    ON public.reel_likes;
CREATE POLICY "reel_likes_select" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_manage" ON public.reel_likes FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_manage" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_manage" ON public.reel_comments FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "reel_views_manage"    ON public.reel_views;
CREATE POLICY "reel_views_manage"    ON public.reel_views   FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "reel_reports_manage"  ON public.reel_reports;
CREATE POLICY "reel_reports_manage"  ON public.reel_reports FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "saved_reels_manage"   ON public.saved_reels;
CREATE POLICY "saved_reels_manage"   ON public.saved_reels  FOR ALL   USING (user_id = auth.uid());

-- ── stories ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stories_select"  ON public.stories;
DROP POLICY IF EXISTS "stories_manage"  ON public.stories;
CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (true);
CREATE POLICY "stories_manage" ON public.stories FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "story_views_manage" ON public.story_views;
CREATE POLICY "story_views_manage" ON public.story_views FOR ALL USING (user_id = auth.uid());

-- ── messages ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ── notifications ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifs_select" ON public.notifications;
DROP POLICY IF EXISTS "notifs_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifs_update" ON public.notifications;
CREATE POLICY "notifs_select" ON public.notifications FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "notifs_insert" ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR actor_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "notifs_update" ON public.notifications FOR UPDATE USING (recipient_id = auth.uid());

-- ── activity_feed ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "activity_feed_select_own" ON public.activity_feed;
DROP POLICY IF EXISTS "activity_feed_insert_sys" ON public.activity_feed;
CREATE POLICY "activity_feed_select_own" ON public.activity_feed FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "activity_feed_insert_sys" ON public.activity_feed FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR actor_id = auth.uid());

-- ── saved_events ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "saved_events_manage" ON public.saved_events;
CREATE POLICY "saved_events_manage" ON public.saved_events FOR ALL USING (user_id = auth.uid());

-- ── reports ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reports_manage" ON public.reports;
CREATE POLICY "reports_manage" ON public.reports FOR ALL USING (reporter_id = auth.uid());

-- ── security_logs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "security_logs_select" ON public.security_logs;
DROP POLICY IF EXISTS "security_logs_insert" ON public.security_logs;
CREATE POLICY "security_logs_select" ON public.security_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "security_logs_insert" ON public.security_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid());

-- ── commerce ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gigs_readable"         ON public.gig_posts;
DROP POLICY IF EXISTS "gigs_manage_own"       ON public.gig_posts;
CREATE POLICY "gigs_readable"   ON public.gig_posts FOR SELECT USING (true);
CREATE POLICY "gigs_manage_own" ON public.gig_posts FOR ALL    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "gig_acceptances_manage" ON public.gig_acceptances;
CREATE POLICY "gig_acceptances_manage" ON public.gig_acceptances FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_nodes_select"  ON public.service_nodes;
DROP POLICY IF EXISTS "service_nodes_manage"  ON public.service_nodes;
CREATE POLICY "service_nodes_select" ON public.service_nodes FOR SELECT USING (true);
CREATE POLICY "service_nodes_manage" ON public.service_nodes FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_bookings_select" ON public.service_bookings;
DROP POLICY IF EXISTS "service_bookings_manage" ON public.service_bookings;
CREATE POLICY "service_bookings_select" ON public.service_bookings FOR SELECT
  USING (client_id = auth.uid() OR provider_id = auth.uid());
CREATE POLICY "service_bookings_manage" ON public.service_bookings FOR ALL
  USING (client_id = auth.uid() OR provider_id = auth.uid());
DROP POLICY IF EXISTS "service_reviews_select" ON public.service_reviews;
DROP POLICY IF EXISTS "service_reviews_manage" ON public.service_reviews;
CREATE POLICY "service_reviews_select" ON public.service_reviews FOR SELECT USING (true);
CREATE POLICY "service_reviews_manage" ON public.service_reviews FOR ALL   USING (reviewer_id = auth.uid());
DROP POLICY IF EXISTS "disputes_manage"        ON public.disputes;
CREATE POLICY "disputes_manage" ON public.disputes FOR ALL USING (filed_by = auth.uid());
DROP POLICY IF EXISTS "wallet_own"             ON public.wallet_transactions;
CREATE POLICY "wallet_own" ON public.wallet_transactions FOR ALL USING (user_id = auth.uid());

-- ── business ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "biz_select"  ON public.business_profiles;
DROP POLICY IF EXISTS "biz_manage"  ON public.business_profiles;
CREATE POLICY "biz_select" ON public.business_profiles FOR SELECT USING (true);
CREATE POLICY "biz_manage" ON public.business_profiles FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "biz_blocks_manage"  ON public.business_page_blocks;
CREATE POLICY "biz_blocks_manage" ON public.business_page_blocks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()));
DROP POLICY IF EXISTS "biz_partnerships_manage" ON public.business_partnerships;
CREATE POLICY "biz_partnerships_manage" ON public.business_partnerships FOR ALL
  USING (EXISTS (SELECT 1 FROM public.business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()));

-- ── ads ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "campaigns_select"  ON public.ad_campaigns;
DROP POLICY IF EXISTS "campaigns_manage"  ON public.ad_campaigns;
CREATE POLICY "campaigns_select" ON public.ad_campaigns FOR SELECT USING (true);
CREATE POLICY "campaigns_manage" ON public.ad_campaigns FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "contextual_ads_select" ON public.contextual_ads;
CREATE POLICY "contextual_ads_select" ON public.contextual_ads FOR SELECT USING (true);

-- ── AI tables ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ai_recs_own" ON public.ai_recommendations_cache;
CREATE POLICY "ai_recs_own" ON public.ai_recommendations_cache FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "ai_mem_own"  ON public.ai_user_memory;
CREATE POLICY "ai_mem_own"  ON public.ai_user_memory  FOR ALL USING (user_id = auth.uid());

-- ── governance ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "proposals_select" ON public.governance_proposals;
DROP POLICY IF EXISTS "proposals_manage" ON public.governance_proposals;
CREATE POLICY "proposals_select" ON public.governance_proposals FOR SELECT USING (true);
CREATE POLICY "proposals_manage" ON public.governance_proposals FOR INSERT WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "gov_votes_select" ON public.governance_votes;
DROP POLICY IF EXISTS "gov_votes_manage" ON public.governance_votes;
CREATE POLICY "gov_votes_select" ON public.governance_votes FOR SELECT USING (true);
CREATE POLICY "gov_votes_manage" ON public.governance_votes FOR ALL USING (user_id = auth.uid());

-- ── app_updates / global_economy_params ──────────────────────────────────────
DROP POLICY IF EXISTS "app_updates_select" ON public.app_updates;
CREATE POLICY "app_updates_select" ON public.app_updates FOR SELECT USING (true);
DROP POLICY IF EXISTS "global_economy_select" ON public.global_economy_params;
CREATE POLICY "global_economy_select" ON public.global_economy_params FOR SELECT USING (true);

-- ── paths / routes ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "routes_select"    ON public.routes;
DROP POLICY IF EXISTS "routes_manage"    ON public.routes;
CREATE POLICY "routes_select" ON public.routes FOR SELECT USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "routes_manage" ON public.routes FOR ALL   USING (user_id = auth.uid());
DROP POLICY IF EXISTS "route_steps_select" ON public.route_steps;
CREATE POLICY "route_steps_select" ON public.route_steps FOR SELECT USING (true);
DROP POLICY IF EXISTS "route_joins_manage" ON public.route_joins;
CREATE POLICY "route_joins_manage" ON public.route_joins FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "paths_own"     ON public.paths;
CREATE POLICY "paths_own"      ON public.paths        FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "path_traces_own"  ON public.path_traces;
CREATE POLICY "path_traces_own"  ON public.path_traces  FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "path_stars_own"   ON public.path_stars;
CREATE POLICY "path_stars_own"   ON public.path_stars   FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "path_crossings_own" ON public.path_crossings;
-- path_crossings uses path_id_a/path_id_b in live DB; allow select for authenticated users
CREATE POLICY "path_crossings_own" ON public.path_crossings FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "user_paths_own"   ON public.user_paths;
CREATE POLICY "user_paths_own"   ON public.user_paths   FOR ALL USING (user_id = auth.uid());

-- ── hashtags / pulse ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hashtags_select"  ON public.hashtags;
DROP POLICY IF EXISTS "hashtags_insert"  ON public.hashtags;
CREATE POLICY "hashtags_select" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "hashtags_insert" ON public.hashtags FOR INSERT WITH CHECK (auth.role() IN ('authenticated','service_role'));
DROP POLICY IF EXISTS "pulse_select"     ON public.pulse_requests;
DROP POLICY IF EXISTS "pulse_insert"     ON public.pulse_requests;
CREATE POLICY "pulse_select" ON public.pulse_requests FOR SELECT USING (true);
CREATE POLICY "pulse_insert" ON public.pulse_requests FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "pulse_votes_manage" ON public.pulse_votes;
CREATE POLICY "pulse_votes_manage" ON public.pulse_votes FOR ALL USING (user_id = auth.uid());

-- ── STORAGE POLICIES ─────────────────────────────────────────────────────────
-- Public read
DROP POLICY IF EXISTS "event_media_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read"       ON storage.objects;
DROP POLICY IF EXISTS "reels_public_read"         ON storage.objects;
DROP POLICY IF EXISTS "moments_public_read"       ON storage.objects;
CREATE POLICY "event_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "avatars_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "reels_public_read"       ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "moments_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'moments');

-- Authenticated upload — first path segment must be caller's user ID
DROP POLICY IF EXISTS "avatars_auth_upload"     ON storage.objects;
DROP POLICY IF EXISTS "event_media_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "reels_auth_upload"       ON storage.objects;
DROP POLICY IF EXISTS "moments_auth_upload"     ON storage.objects;
CREATE POLICY "avatars_auth_upload"     ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars'     AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "event_media_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "reels_auth_upload"       ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reels'       AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "moments_auth_upload"     ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'moments'     AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Owner delete / update
DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);


-- ── 12. FUNCTIONS & TRIGGERS ─────────────────────────────────────────────────

-- ── vibe count sync ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_vibe_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET vibe_count = COALESCE(vibe_count, 0) + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET vibe_count = GREATEST(0, COALESCE(vibe_count, 0) - 1) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_vibe_count_trigger ON public.event_vibes;
CREATE TRIGGER sync_vibe_count_trigger
  AFTER INSERT OR DELETE ON public.event_vibes
  FOR EACH ROW EXECUTE FUNCTION public.sync_vibe_count();

-- ── moment view count sync ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_moment_view_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.event_moments SET view_count = COALESCE(view_count, 0) + 1 WHERE id = NEW.moment_id;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_moment_view_count_trigger ON public.event_moment_views;
CREATE TRIGGER sync_moment_view_count_trigger
  AFTER INSERT ON public.event_moment_views
  FOR EACH ROW EXECUTE FUNCTION public.sync_moment_view_count();

-- ── capacity enforcement ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity integer;
  v_going    integer;
BEGIN
  IF NEW.status != 'going' THEN RETURN NEW; END IF;
  SELECT capacity INTO v_capacity FROM events WHERE id = NEW.event_id;
  IF v_capacity IS NULL OR v_capacity = 0 THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_going FROM event_rsvps WHERE event_id = NEW.event_id AND status = 'going';
  IF v_going >= v_capacity THEN
    RAISE EXCEPTION 'Event is at capacity (% / %)', v_going, v_capacity;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_event_capacity_trigger ON public.event_rsvps;
CREATE TRIGGER enforce_event_capacity_trigger
  BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();

-- ── echo body sanitization (XSS prevention) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.sanitize_echo_body()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.body = regexp_replace(NEW.body, '<[^>]+>',          '', 'g');
  NEW.body = regexp_replace(NEW.body, 'javascript\s*:',   '', 'gi');
  NEW.body = regexp_replace(NEW.body, 'on\w+\s*=\s*[''"][^''"]*[''"]', '', 'gi');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sanitize_echo_body_trigger ON public.echoes;
CREATE TRIGGER sanitize_echo_body_trigger
  BEFORE INSERT OR UPDATE ON public.echoes
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_echo_body();

-- ── chat message validation ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_chat_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF length(trim(NEW.message)) < 1 OR length(NEW.message) > 500 THEN
    RAISE EXCEPTION 'Chat message must be 1–500 characters.';
  END IF;
  NEW.message = regexp_replace(NEW.message, '<script[^>]*>.*?</script>', '', 'gi');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chat_message_validate ON public.event_chat_messages;
CREATE TRIGGER chat_message_validate
  BEFORE INSERT OR UPDATE ON public.event_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message();

-- ── secure check-in RPC ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.secure_check_in(
  p_event_id uuid,
  p_rsvp_id  uuid,
  p_user_id  uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rsvp   event_rsvps%ROWTYPE;
  v_event  events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;

  IF auth.uid() != v_event.author_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM event_roles
      WHERE event_id = p_event_id AND user_id = auth.uid()
        AND role IN ('co_host','moderator','scanner')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: not an event organiser or team member';
    END IF;
  END IF;

  SELECT * INTO v_rsvp FROM event_rsvps WHERE id = p_rsvp_id AND event_id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found in guest list'; END IF;
  IF v_rsvp.status != 'going' THEN
    RAISE EXCEPTION 'RSVP status is "%" — not confirmed going', v_rsvp.status;
  END IF;
  IF v_rsvp.user_id != p_user_id THEN
    RAISE EXCEPTION 'Ticket user mismatch — possible forgery attempt';
  END IF;

  INSERT INTO event_checkins(event_id, rsvp_id, user_id)
  VALUES (p_event_id, p_rsvp_id, p_user_id)
  ON CONFLICT (rsvp_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'rsvp_id', p_rsvp_id, 'user_id', p_user_id);
END;
$$;

-- ── signed QR ticket token ────────────────────────────────────────────────────
-- Requires: ALTER DATABASE postgres SET app.qr_secret = '<your-256-bit-secret>';
DROP FUNCTION IF EXISTS public.generate_ticket_token(uuid);
CREATE OR REPLACE FUNCTION public.generate_ticket_token(p_rsvp_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rsvp    event_rsvps%ROWTYPE;
  v_payload text;
  v_sig     text;
BEGIN
  SELECT * INTO v_rsvp FROM event_rsvps WHERE id = p_rsvp_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'RSVP not found or does not belong to you'; END IF;

  v_payload := v_rsvp.event_id || '|' || v_rsvp.user_id || '|' || v_rsvp.id ||
               '|' || (EXTRACT(EPOCH FROM now() + INTERVAL '30 days')::bigint)::text;

  v_sig := encode(hmac(v_payload, current_setting('app.qr_secret', true), 'sha256'), 'hex');
  RETURN 'gruvsticket://' || encode(v_payload::bytea, 'base64') || '.' || v_sig;
END;
$$;

-- ── check-in rate limit ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_in_rate_limit(p_event_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM event_checkins
    WHERE event_id = p_event_id AND created_at > now() - INTERVAL '60 seconds'
  ) < 30;
END;
$$;

-- ── general rate limit helper ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action  text,
  p_max     int DEFAULT 30,
  p_window  interval DEFAULT '1 minute'
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_logs' AND table_schema = 'public') THEN
    RETURN true;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.security_logs
  WHERE user_id = p_user_id AND event_type = p_action AND created_at > now() - p_window;
  RETURN v_count < p_max;
END;
$$;

-- ── RPC helpers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_vibe_count(p_event_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_vibes(event_id, user_id) VALUES (p_event_id, p_user_id) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_vibe_count(p_event_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.event_vibes WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_activity_read(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.activity_feed SET is_read = true WHERE recipient_id = p_user_id AND is_read = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_poll_id uuid, p_option_index int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_poll_votes(poll_id, user_id, option_index)
  VALUES (p_poll_id, auth.uid(), p_option_index)
  ON CONFLICT (poll_id, user_id) DO UPDATE SET option_index = p_option_index;
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_track(p_track_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cannot vote as another user.'; END IF;
  INSERT INTO public.event_track_votes(track_id, user_id) VALUES (p_track_id, p_user_id) ON CONFLICT DO NOTHING;
  UPDATE public.event_playlist_tracks SET votes = votes + 1 WHERE id = p_track_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unvote_track(p_track_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cannot unvote as another user.'; END IF;
  DELETE FROM public.event_track_votes WHERE track_id = p_track_id AND user_id = p_user_id;
  UPDATE public.event_playlist_tracks SET votes = GREATEST(0, votes - 1) WHERE id = p_track_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_reel_caption(p_reel_id uuid, p_caption text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(p_caption) > 500 THEN RAISE EXCEPTION 'Caption too long (max 500 chars).'; END IF;
  UPDATE public.reels SET caption = trim(p_caption) WHERE id = p_reel_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Reel not found or permission denied.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_insert_chat_message(
  p_event_id uuid, p_user_id uuid, p_message text, p_reply_to uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cannot send messages as another user.'; END IF;
  IF length(trim(p_message)) < 1 OR length(p_message) > 500 THEN RAISE EXCEPTION 'Message must be between 1 and 500 characters.'; END IF;
  INSERT INTO public.event_chat_messages(event_id, user_id, message, reply_to)
  VALUES (p_event_id, p_user_id, trim(p_message), p_reply_to)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_carpool_request(p_request_id uuid, p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_driver_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.event_carpool_requests SET status = 'accepted'
  WHERE id = p_request_id AND carpool_id IN (SELECT id FROM public.event_carpools WHERE driver_id = p_driver_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_carpool_request(p_request_id uuid, p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_driver_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.event_carpool_requests SET status = 'declined'
  WHERE id = p_request_id AND carpool_id IN (SELECT id FROM public.event_carpools WHERE driver_id = p_driver_id);
END;
$$;


-- ── 14. PUSH NOTIFICATION INFRASTRUCTURE ────────────────────────────────────

-- Service role can read push_token to deliver pushes
GRANT SELECT (push_token) ON public.profiles TO service_role;

-- pg_cron job: send event-day notifications daily at 08:00 SAST (06:00 UTC)
CREATE OR REPLACE FUNCTION public.send_event_day_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT er.user_id AS recipient_id, e.id AS event_id, e.title AS event_title, e.author_id
    FROM event_rsvps er
    JOIN events e ON e.id = er.event_id
    WHERE er.status IN ('going','maybe')
      AND date_trunc('day', e.event_date AT TIME ZONE 'Africa/Johannesburg')
          = date_trunc('day', now() AT TIME ZONE 'Africa/Johannesburg')
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.recipient_id = er.user_id AND n.event_id = e.id AND n.type = 'event_day'
          AND n.created_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Johannesburg')
      )
  LOOP
    INSERT INTO notifications (recipient_id, actor_id, event_id, type, title, body, data, read)
    VALUES (
      r.recipient_id, r.author_id, r.event_id, 'event_day',
      '🎉 Today''s the day!',
      r.event_title || ' is happening today. Check in when you arrive!',
      jsonb_build_object('event_id', r.event_id), false
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('event-day-notifications', '0 6 * * *', 'SELECT public.send_event_day_notifications()');
  END IF;
END;
$$;

-- ── security views ────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
  SELECT id, username, display_name, avatar_url, bio, city, vibe_score, is_verified, is_discoverable, updated_at
  FROM public.profiles
  WHERE is_discoverable = true OR id = auth.uid();

REVOKE ALL ON public.public_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── harden schema access ──────────────────────────────────────────────────────
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================
--  REQUIRED MANUAL STEPS AFTER RUNNING THIS FILE:
--
--  1. Set QR ticket signing secret (once, in SQL Editor):
--       ALTER DATABASE postgres SET app.qr_secret = '<strong-256-bit-secret>';
--
--  2. Deploy push-notify Edge Function:
--       supabase functions deploy push-notify
--
--  3. Wire DB Webhook in Supabase Dashboard:
--       Database → Webhooks → Create webhook
--       Table: notifications | Event: INSERT
--       URL: https://<project>.supabase.co/functions/v1/push-notify
--       Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--
--  4. Set Apple Team ID in:
--       public/.well-known/apple-app-site-association
--       Replace "TEAMID" with your 10-char Apple Developer Team ID
--
--  5. Set Android SHA-256 fingerprint in:
--       public/.well-known/assetlinks.json
--       Run: keytool -list -v -keystore your.keystore | grep SHA256
-- ============================================================
