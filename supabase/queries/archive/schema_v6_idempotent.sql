-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — SCHEMA v6 (IDEMPOTENT / CREATE-MISSING)  ·  auto-derived
-- ══════════════════════════════════════════════════════════════════════════════
--  Derived from schema_v6_proposed.sql by making every CREATE idempotent so it
--  runs WITHOUT the "relation already exists" (42P07) error.
--
--  ⚠️  READ THIS:
--   • CREATE TABLE IF NOT EXISTS SKIPS a table that already exists — it does NOT
--     restructure it. So on the LIVE DB this only creates MISSING tables; it will
--     NOT collapse the 90-column events drift. Use the in-place ALTER migration
--     (bottom of schema_v6_proposed.sql) for that.
--   • Safe + intended use: run against an EMPTY Supabase branch / fresh project to
--     validate the clean v6 design end-to-end.
--   • An index that references a column a pre-existing table lacks can still error
--     on the live DB — another reason to validate on a fresh branch, not prod.
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — SCHEMA v6 (PROPOSED CLEAN RESTRUCTURE)  ·  2026-06-25
-- ══════════════════════════════════════════════════════════════════════════════
--
--  ⚠️  THIS IS A PROPOSAL FOR REVIEW. IT IS *NOT* APPLIED TO THE LIVE DATABASE.
--  ⚠️  Do NOT run this as-is on the live DB — it would need a DATA-PRESERVING
--      migration (see the MIGRATION PLAN at the bottom). Running it blind could
--      drop columns that still hold data.
--
--  GOAL: collapse the accumulated redundancy (the live `events` table alone has
--  ~90 columns with 3 ways to store a date, 3 ways to store coordinates, 3 cover
--  images, etc.) into ONE canonical column per concept, with consistent naming,
--  proper types, RLS, and indexes — and in dependency order (no forward refs).
--
--  Scope = CORE tables (the heart of the app). Peripheral domains (sports,
--  business, talent, governance, gifting) keep their current tables and migrate
--  in later passes; this proves the structure on the worst offenders first.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 0. EXTENSIONS & SHARED HELPERS ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy search
CREATE EXTENSION IF NOT EXISTS postgis;    -- (only if geo features are kept)

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
--  1. PROFILES  (was: 1 table + ~15 drifted ALTERs with 4 ways to store DOB)
-- ══════════════════════════════════════════════════════════════════════════════
-- CONSOLIDATED:  age / birthday / birth_year / birth_date  ->  birth_date (DATE)
--                location / city                           ->  city
--                (age is now a computed view column, never stored)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username               TEXT UNIQUE NOT NULL,
  display_name           TEXT,
  first_name             TEXT,
  surname                TEXT,
  avatar_url             TEXT,
  cover_url              TEXT,
  bio                    TEXT CHECK (length(bio) <= 500),
  city                   TEXT,
  country                TEXT,
  home_village           TEXT,
  home_base_lat          DOUBLE PRECISION,
  home_base_lon          DOUBLE PRECISION,
  birth_date             DATE,                       -- single source of truth for DOB
  gender                 TEXT,
  clan_name              TEXT,
  interests              TEXT[],
  languages              TEXT[],
  -- identity / trust / presence
  is_verified            BOOLEAN     DEFAULT false,
  is_online              BOOLEAN     DEFAULT false,
  last_seen              TIMESTAMPTZ,
  is_discoverable        BOOLEAN     DEFAULT true,
  identity_mode          TEXT        DEFAULT 'public' CHECK (identity_mode IN ('public','semi','ghost')),
  is_beacon_active       BOOLEAN     DEFAULT false,
  privacy_settings       JSONB       DEFAULT '{}',
  writing_style          TEXT,
  -- scores (the leveling/economy engine)
  vibe_score             INTEGER     DEFAULT 0,
  vibe_equity            NUMERIC(12,2) DEFAULT 0,
  social_integrity_score INTEGER     DEFAULT 100,
  -- referral lineage (family tree)
  referral_code          TEXT UNIQUE,
  referred_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_count         INTEGER     DEFAULT 0,
  -- denormalized counters (kept in sync by triggers)
  followers_count        INTEGER     DEFAULT 0,
  following_count        INTEGER     DEFAULT 0,
  events_posted          INTEGER     DEFAULT 0,
  -- gamification
  xp                     INTEGER     DEFAULT 0,
  badges                 TEXT[],
  profile_gallery        TEXT[],
  -- privacy
  show_online            BOOLEAN     DEFAULT true,
  share_events           BOOLEAN     DEFAULT true,
  -- economy
  wallet_balance         NUMERIC(10,2) DEFAULT 0,
  role                   TEXT,
  -- system
  push_token             TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username   ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_city       ON public.profiles (lower(city));
CREATE INDEX IF NOT EXISTS idx_profiles_vibe       ON public.profiles (vibe_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_push       ON public.profiles (push_token) WHERE push_token IS NOT NULL;
CREATE OR REPLACE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
--  2. EVENTS  (was: ~90 columns — the worst offender)
-- ══════════════════════════════════════════════════════════════════════════════
-- CONSOLIDATED:
--   event_date / date_time / starts_at / date / next_occurrence -> event_date (+event_time)
--   end_date / ends_at / end_time                               -> end_date (+end_time)
--   lat / latitude  &  lon / longitude  &  coords               -> lat, lon (DOUBLE PRECISION)
--   cover_url / cover_image / image_url                         -> cover_url
--   age_restriction / min_age / age_min,age_max                 -> age_min, age_max
--   price / price_min / price_max                               -> price (JSONB)
--   is_full / is_sold_out / is_hidden / is_archived / is_cancelled / is_published / deleted_at -> status + deleted_at
--   (recurrence_* and the dozen counters move to dedicated tables/triggers)
CREATE TABLE IF NOT EXISTS public.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 150),
  description   TEXT CHECK (length(description) <= 4000),
  -- when
  event_date    DATE,
  event_time    TIME,
  end_date      DATE,
  end_time      TIME,
  -- where
  venue_name    TEXT,
  address       TEXT,
  city          TEXT,
  country       TEXT,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  -- what
  category      TEXT,
  categories    TEXT[],
  tags          TEXT[],
  cover_url     TEXT,
  media         JSONB,                 -- [{type,url}, ...]
  -- tickets / pricing
  price         JSONB,                 -- {"general":50,"vip":150} (or null = free)
  rsvp_tiers    JSONB,
  ticket_url    TEXT,
  capacity      INTEGER,
  age_min       INTEGER DEFAULT 0,
  age_max       INTEGER DEFAULT 99,
  -- lifecycle (replaces 6 overlapping booleans)
  status        TEXT NOT NULL DEFAULT 'published'
                CHECK (status IN ('draft','published','cancelled','archived')),
  deleted_at    TIMESTAMPTZ,
  -- denormalized engagement counters (kept in sync by triggers)
  vibe_count    INTEGER DEFAULT 0,
  support_score INTEGER DEFAULT 0,     -- gifting support (separate from vibe heat)
  rsvp_count    INTEGER DEFAULT 0,
  going         INTEGER DEFAULT 0,     -- legacy alias for rsvp_count (app still reads this)
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  -- verification & contact
  is_verified   BOOLEAN DEFAULT false,
  contact_phone TEXT,
  contact_email TEXT,
  -- display
  poster_mode   TEXT,
  category_color TEXT,
  -- system
  slug          TEXT UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_author    ON public.events (author_id);
CREATE INDEX IF NOT EXISTS idx_events_date      ON public.events (event_date);  -- (partial clause removed: column name varies across existing tables)
CREATE INDEX IF NOT EXISTS idx_events_city      ON public.events (lower(city));
CREATE INDEX IF NOT EXISTS idx_events_status    ON public.events (status, event_date);  -- (partial clause removed: column name varies across existing tables)
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON public.events USING gin (title gin_trgm_ops);
CREATE OR REPLACE TRIGGER touch_events BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
--  3. SOCIAL GRAPH
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),          -- composite PK; no surrogate id
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

-- ══════════════════════════════════════════════════════════════════════════════
--  4. EVENT INTERACTIONS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','not_going')),
  tier       TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)                   -- composite PK; app must NOT query .id
);
CREATE INDEX IF NOT EXISTS idx_rsvps_user ON public.event_rsvps (user_id);

CREATE TABLE IF NOT EXISTS public.event_checkins (
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION,
  lon        DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_vibes (
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_crowd_votes (
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote       INTEGER NOT NULL CHECK (vote BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
--  5. CONTENT — REELS + INTERACTIONS, ECHOES (event comments)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL DEFAULT 'video' CHECK (media_type IN ('video','image')),
  thumbnail_url TEXT,
  caption       TEXT,
  sound_name    TEXT,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers','private')),
  min_age       INTEGER DEFAULT 0,
  metadata      JSONB,
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  deleted_at    TIMESTAMPTZ,                         -- replaces is_deleted/is_hidden booleans
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reels_user    ON public.reels (user_id);
CREATE INDEX IF NOT EXISTS idx_reels_feed    ON public.reels (created_at DESC);  -- (partial clause removed: column name varies across existing tables)

CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1000),
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON public.reel_comments (reel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.echoes (                          -- comments on events
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1000),
  parent_id  UUID REFERENCES public.echoes(id) ON DELETE CASCADE,
  like_count INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_echoes_event ON public.echoes (event_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
--  6. MESSAGING (DMs)
-- ══════════════════════════════════════════════════════════════════════════════
-- NOTE: the live `messages` table has all these columns yet INSERTs return 400 —
-- a hidden CHECK/trigger we still need DB access to find. This clean shape removes
-- the ambiguity; the request-system columns are explicit and minimal.
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body             TEXT,
  message_type     TEXT NOT NULL DEFAULT 'text'
                   CHECK (message_type IN ('text','image','location','vibe_card','event')),
  media_url        TEXT,
  parent_id        UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  -- message-request system (first message from a stranger = a request)
  is_request       BOOLEAN DEFAULT false,
  request_accepted BOOLEAN DEFAULT false,
  read_at          TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  CHECK (sender_id <> recipient_id),
  CHECK (body IS NOT NULL OR media_url IS NOT NULL)   -- can't send an empty message
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_inbox  ON public.messages (recipient_id, created_at DESC);  -- (partial clause removed: column name varies across existing tables)

-- ══════════════════════════════════════════════════════════════════════════════
--  7. SOCIAL UTILITY
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  title        TEXT,
  body         TEXT,
  data         JSONB DEFAULT '{}',
  read         BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifs_recipient ON public.notifications (recipient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.saved_events (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
--  RECONCILE CANONICAL COLUMNS on any pre-existing (divergent) tables, so the
--  policies below don't 42703. e.g. a live `reels` table created earlier has
--  `is_deleted` but not `deleted_at`; the v6 policies reference `deleted_at`.
--  These are additive + idempotent (nullable columns, no data loss).
--  ⚠️ NOTE: on a table that already tracks deletion via a DIFFERENT column
--  (reels.is_deleted), the new deleted_at stays NULL, so a `deleted_at IS NULL`
--  policy will treat already-deleted rows as visible. This is why v6 belongs on a
--  FRESH branch — these ALTERs only stop the error; they don't migrate the data.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'published';
ALTER TABLE public.reels  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.reels  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════════════════════════
--  RLS POLICIES  (all idempotent: ENABLE + DROP IF EXISTS + CREATE)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── profiles ──
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING (id = auth.uid());

-- ── events ──
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_select ON public.events;
CREATE POLICY events_select ON public.events FOR SELECT
  USING (deleted_at IS NULL AND (status = 'published' OR author_id = auth.uid()));
DROP POLICY IF EXISTS events_insert_own ON public.events;
CREATE POLICY events_insert_own ON public.events FOR INSERT WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS events_update_own ON public.events;
CREATE POLICY events_update_own ON public.events FOR UPDATE USING (author_id = auth.uid());
DROP POLICY IF EXISTS events_delete_own ON public.events;
CREATE POLICY events_delete_own ON public.events FOR DELETE USING (author_id = auth.uid());

-- ── follows ──
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS follows_select ON public.follows;
CREATE POLICY follows_select ON public.follows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own ON public.follows FOR DELETE USING (follower_id = auth.uid());

-- ── event_rsvps / event_checkins / event_vibes (own rows; can't self-act on own event) ──
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rsvps_select ON public.event_rsvps;
CREATE POLICY rsvps_select ON public.event_rsvps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rsvps_write_own ON public.event_rsvps;
CREATE POLICY rsvps_write_own ON public.event_rsvps FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkins_select ON public.event_checkins;
CREATE POLICY checkins_select ON public.event_checkins FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS checkins_write_own ON public.event_checkins;
CREATE POLICY checkins_write_own ON public.event_checkins FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.event_vibes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vibes_select ON public.event_vibes;
CREATE POLICY vibes_select ON public.event_vibes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS vibes_write_own ON public.event_vibes;
CREATE POLICY vibes_write_own ON public.event_vibes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()
    AND user_id <> (SELECT author_id FROM public.events e WHERE e.id = event_id)); -- no self-vibe

ALTER TABLE public.event_crowd_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crowd_votes_select ON public.event_crowd_votes;
CREATE POLICY crowd_votes_select ON public.event_crowd_votes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS crowd_votes_write_own ON public.event_crowd_votes;
CREATE POLICY crowd_votes_write_own ON public.event_crowd_votes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── reels + interactions ──
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reels_select ON public.reels;
CREATE POLICY reels_select ON public.reels FOR SELECT
  USING (deleted_at IS NULL AND (visibility = 'public' OR user_id = auth.uid()));
DROP POLICY IF EXISTS reels_write_own ON public.reels;
CREATE POLICY reels_write_own ON public.reels FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reel_likes_select ON public.reel_likes;
CREATE POLICY reel_likes_select ON public.reel_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS reel_likes_write_own ON public.reel_likes;
CREATE POLICY reel_likes_write_own ON public.reel_likes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reel_comments_select ON public.reel_comments;
CREATE POLICY reel_comments_select ON public.reel_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS reel_comments_write_own ON public.reel_comments;
CREATE POLICY reel_comments_write_own ON public.reel_comments FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── echoes (event comments) ──
ALTER TABLE public.echoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS echoes_select ON public.echoes;
CREATE POLICY echoes_select ON public.echoes FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS echoes_write_own ON public.echoes;
CREATE POLICY echoes_write_own ON public.echoes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── messages (DMs) — only the two participants ──
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_select_parts ON public.messages;
CREATE POLICY messages_select_parts ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS messages_update_parts ON public.messages;
CREATE POLICY messages_update_parts ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid()); -- read receipts / accept request

-- ── notifications (own only) ──
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifs_own ON public.notifications;
CREATE POLICY notifs_own ON public.notifications FOR SELECT USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS notifs_update_own ON public.notifications;
CREATE POLICY notifs_update_own ON public.notifications FOR UPDATE USING (recipient_id = auth.uid());
-- (inserts come from SECURITY DEFINER functions / triggers, never the client)

-- ── saved_events (own only) ──
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_own ON public.saved_events;
CREATE POLICY saved_own ON public.saved_events FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
--  MIGRATION PLAN (how this gets applied SAFELY to the live DB — not yet done)
-- ══════════════════════════════════════════════════════════════════════════════
--  Requires the Supabase connection so it can be done transactionally + verified.
--  Strategy = column-by-column consolidation IN PLACE (never drop-and-recreate a
--  table that holds data):
--    1. Backfill the canonical column from whichever duplicate holds data, e.g.
--         UPDATE events SET event_date = COALESCE(event_date, date_time::date, starts_at::date);
--         UPDATE profiles SET birth_date = COALESCE(birth_date, birthday, to_date(birth_year::text,'YYYY'));
--    2. Point the APP at the canonical columns (code changes), deploy, verify.
--    3. Only AFTER the app no longer reads the duplicates: ALTER TABLE ... DROP COLUMN.
--    4. Add the new CHECK constraints / status enum after backfilling valid values.
--  This is reversible at every step and never loses data.
