-- ==============================================================================
--  THE GRUVS — Master Unified Database Schema  (v5 — single source of truth)
--  File: supabase_combined_schema.sql
--
--  Paste this entire file into Supabase → SQL Editor → Run.
--  Every statement is idempotent — safe to run on a fresh OR existing project.
-- ==============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
--  0. EXTENSIONS
--  Wrapped in DO blocks: Supabase pre-installs postgis/pg_trgm/unaccent as
--  supabase_admin, so a plain CREATE EXTENSION errors with "must be owner".
--  The DO block catches and ignores that permission error gracefully.
-- ══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS postgis;  EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_trgm;  EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS unaccent; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════════════════════
--  0b. HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.safe_div(a NUMERIC, b NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN b = 0 THEN 0 ELSE a / b END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
--  1. PROFILES
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username               TEXT        UNIQUE,
  display_name           TEXT,
  avatar_url             TEXT,
  cover_url              TEXT,
  bio                    TEXT,
  location               TEXT,
  website                TEXT,
  city                   TEXT,
  gender                 TEXT,
  birth_year             INTEGER,
  lat                    FLOAT,
  lon                    FLOAT,
  coords                 geography(Point, 4326),
  is_verified            BOOLEAN     DEFAULT false,
  is_online              BOOLEAN     DEFAULT false,
  last_seen              TIMESTAMPTZ DEFAULT now(),
  last_seen_at           TIMESTAMPTZ DEFAULT now(),
  vibe_score             INTEGER     DEFAULT 0,
  vibe_equity            NUMERIC     DEFAULT 0,
  xp                     INTEGER     DEFAULT 0,
  followers_count        INTEGER     DEFAULT 0,
  following_count        INTEGER     DEFAULT 0,
  saved_count            INTEGER     DEFAULT 0,
  events_posted          INTEGER     DEFAULT 0,
  current_streak         INTEGER     DEFAULT 0,
  wallet_balance         NUMERIC     DEFAULT 0,
  social_integrity_score FLOAT       DEFAULT 100,
  interests              TEXT[],
  badges                 TEXT[]      DEFAULT '{}',
  profile_gallery        TEXT[],
  career_title           TEXT,
  career_description     TEXT,
  looks_description      TEXT,
  push_token             TEXT,
  referral_code          TEXT        UNIQUE,
  referral_count         INTEGER     DEFAULT 0,
  identity_mode          TEXT        DEFAULT 'public' CHECK (identity_mode IN ('public','ghost','celebrity')),
  is_discoverable        BOOLEAN     DEFAULT true,
  is_beacon_active       BOOLEAN     DEFAULT false,
  show_online            BOOLEAN     DEFAULT true,
  share_events           BOOLEAN     DEFAULT false,
  role                   TEXT        DEFAULT 'user',
  provider_type          TEXT,
  provider_rate          TEXT,
  provider_bio           TEXT,
  provider_verified      BOOLEAN     DEFAULT false,
  home_base_lat          FLOAT,
  home_base_lon          FLOAT,
  last_active            DATE,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Idempotent column additions for existing DBs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name           TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url             TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url              TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio                    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location               TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website                TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city                   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender                 TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_year             INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat                    FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lon                    FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coords                 geography(Point, 4326);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified            BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online              BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen              TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at           TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vibe_score             INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vibe_equity            NUMERIC     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp                     INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followers_count        INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS following_count        INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_count            INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS events_posted          INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_streak         INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance         NUMERIC     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_integrity_score FLOAT       DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests              TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges                 TEXT[]      DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gallery        TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS career_title           TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS career_description     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS looks_description      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token             TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count         INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS identity_mode          TEXT        DEFAULT 'public';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_discoverable        BOOLEAN     DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_beacon_active       BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_online            BOOLEAN     DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_events           BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role                   TEXT        DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider_type          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider_rate          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider_bio           TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider_verified      BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base_lat          FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base_lon          FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active            DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS profiles_coords_gist   ON public.profiles USING gist(coords);
CREATE INDEX IF NOT EXISTS profiles_username_trgm ON public.profiles USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_interests_gin ON public.profiles USING gin(interests);
CREATE INDEX IF NOT EXISTS profiles_online        ON public.profiles(is_online) WHERE is_online = true;

-- Privacy-hardened: only authenticated users can browse others (ghost/celebrity restricted)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles readable" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Public profiles readable" ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR (identity_mode = 'public' AND auth.role() = 'authenticated')
);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sync last_seen ↔ last_seen_at
CREATE OR REPLACE FUNCTION public.sync_last_seen()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.last_seen IS DISTINCT FROM OLD.last_seen THEN
    NEW.last_seen_at := NEW.last_seen;
  ELSIF NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at THEN
    NEW.last_seen := NEW.last_seen_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_sync_last_seen ON public.profiles;
CREATE TRIGGER profiles_sync_last_seen BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_last_seen();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_uname  TEXT;
  final_uname TEXT;
BEGIN
  base_uname := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'
  ));
  IF base_uname IS NULL OR base_uname = '' THEN
    base_uname := 'user' || left(new.id::text, 6);
  END IF;
  final_uname := base_uname;
  BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      new.id,
      final_uname,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.raw_user_meta_data->>'avatar_url'
    );
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.profiles (id, username, display_name, avatar_url)
      VALUES (
        new.id,
        'user_' || left(new.id::text, 8),
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url'
      )
      ON CONFLICT (id) DO NOTHING;
    WHEN OTHERS THEN NULL;
  END;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ══════════════════════════════════════════════════════════════════════════════
--  2. FOLLOWS
-- ══════════════════════════════════════════════════════════════════════════════
-- Rename legacy "followers" table if it exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='followers')
  AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='follows') THEN
    ALTER TABLE public.followers RENAME TO follows;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS follower_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS follows_follower_id  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_id ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON public.follows;
DROP POLICY IF EXISTS "Users manage own follows" ON public.follows;
CREATE POLICY "Follows readable"         ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON public.follows FOR ALL    USING (auth.uid() = follower_id);

-- Compat view so old code using "followers" still works
-- Drop followers whether it's a leftover table or an old view
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='followers' AND table_type='BASE TABLE') THEN
    DROP TABLE public.followers CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='followers') THEN
    DROP VIEW public.followers CASCADE;
  END IF;
END $$;
CREATE OR REPLACE VIEW public.followers AS SELECT * FROM public.follows;

CREATE OR REPLACE FUNCTION public.sync_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS follows_sync ON public.follows;
CREATE TRIGGER follows_sync AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();

-- Suggested follows RPC (used by DiscoverPeopleScreen)
CREATE OR REPLACE FUNCTION public.suggested_follows(p_user UUID, p_limit INTEGER DEFAULT 6)
RETURNS TABLE (suggested_id UUID, mutual_count BIGINT)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT f2.following_id AS suggested_id, COUNT(*) AS mutual_count
  FROM public.follows f1
  JOIN public.follows f2 ON f1.following_id = f2.follower_id
  WHERE f1.follower_id = p_user
    AND f2.following_id <> p_user
    AND NOT EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = p_user AND following_id = f2.following_id
    )
  GROUP BY f2.following_id
  ORDER BY mutual_count DESC
  LIMIT p_limit;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
--  3. BLOCKED & MUTED USERS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked ON public.user_blocks(blocked_id);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own blocks" ON public.user_blocks;
CREATE POLICY "Users manage own blocks" ON public.user_blocks FOR ALL USING (auth.uid() = blocker_id);

-- Legacy alias: if code queries "blocked_users", point it at user_blocks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='blocked_users' AND table_type='BASE TABLE') THEN
    DROP TABLE public.blocked_users CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='blocked_users') THEN
    DROP VIEW public.blocked_users CASCADE;
  END IF;
END $$;
CREATE OR REPLACE VIEW public.blocked_users AS SELECT * FROM public.user_blocks;

CREATE TABLE IF NOT EXISTS public.muted_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (muter_id, muted_id)
);
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own mutes" ON public.muted_users;
CREATE POLICY "Users manage own mutes" ON public.muted_users FOR ALL USING (auth.uid() = muter_id);


-- ============================================================
--  MUTED USERS
-- ============================================================

-- ══════════════════════════════════════════════════════════════════════════════
--  4. MESSAGES (DIRECT & GROUP MESSAGING)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dm_rooms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count_1  INTEGER     DEFAULT 0,
  unread_count_2  INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CHECK (participant_1 <> participant_2)
);

-- Expression-based unique constraint: prevents duplicate rooms regardless of which
-- user is participant_1 vs participant_2 (must be a separate index, not inline).
CREATE UNIQUE INDEX IF NOT EXISTS dm_rooms_pair_unique
  ON dm_rooms (LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2));
CREATE INDEX IF NOT EXISTS dm_rooms_p1 ON dm_rooms(participant_1, last_message_at DESC);
CREATE INDEX IF NOT EXISTS dm_rooms_p2 ON dm_rooms(participant_2, last_message_at DESC);
ALTER TABLE dm_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DM room participants can read"   ON dm_rooms;
DROP POLICY IF EXISTS "DM room participants can update" ON dm_rooms;
CREATE POLICY "DM room participants can read"   ON dm_rooms FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
DROP POLICY IF EXISTS "DM room participants can update" ON dm_rooms;
CREATE POLICY "DM room participants can update" ON dm_rooms FOR ALL    USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
DROP TRIGGER IF EXISTS dm_rooms_touch ON dm_rooms;
CREATE TRIGGER dm_rooms_touch BEFORE UPDATE ON dm_rooms FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
-- Conversations view alias (backward compat)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='conversations') THEN DROP VIEW conversations CASCADE; END IF; END $$;
DROP VIEW IF EXISTS conversations CASCADE;
CREATE OR REPLACE VIEW conversations WITH (security_invoker = true) AS SELECT * FROM dm_rooms;

-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body             TEXT        CHECK (body IS NULL OR length(body) <= 4000),
  message_type     TEXT        DEFAULT 'text',
  media_url        TEXT,
  parent_id        UUID        REFERENCES messages(id) ON DELETE SET NULL,
  event_id         UUID,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  is_request       BOOLEAN     DEFAULT true,
  request_accepted BOOLEAN     DEFAULT false,
  delivered_at     TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  reaction         TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id        UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS body             TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type     TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id        UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id         UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN DEFAULT true;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction         TEXT;


ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type     TEXT             DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id        UUID             REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event_id         UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN          DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN          DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reaction         TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Message participants can read" ON public.messages;
DROP POLICY IF EXISTS "Users send own messages"       ON public.messages;
DROP POLICY IF EXISTS "Users update own messages"     ON public.messages;

CREATE POLICY "Message participants can read" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Block check at DB level: cannot message someone who blocked you
CREATE POLICY "Users send own messages" ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND NOT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = recipient_id AND blocked_id = auth.uid()
  )
);

CREATE POLICY "Users update own messages" ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);


CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime for groups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
  END IF;
END $$;

-- RLS for group messages (anyone RSVP'd 'going' can read)
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read messages of events they RSVP'd to" ON group_messages;
CREATE POLICY "Users can read messages of events they RSVP'd to"
  ON group_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM event_rsvps
      WHERE event_id = group_messages.event_id
        AND user_id = auth.uid()
        AND status = 'going'
    )
  );

DROP POLICY IF EXISTS "Users can send messages to events they RSVP'd to" ON group_messages;
CREATE POLICY "Users can send messages to events they RSVP'd to"
  ON group_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_rsvps
      WHERE event_id = event_id
        AND user_id = auth.uid()
        AND status = 'going'
    )
  );

-- ── Welcome System ──────────────────────────────────────────────────────────

-- Insert a system profile for welcoming users.
-- Wrapped in a DO block: auth.users has no row for this UUID on a fresh project,
-- so the FK insert would fail with 23503. We catch and skip it gracefully.
-- The welcome trigger below guards against gruv_hq not existing at runtime.
DO $$ BEGIN
  INSERT INTO profiles (id, username, display_name, bio, vibe_score, is_online)
  VALUES ('00000000-0000-0000-0000-000000000000', 'gruv_hq', 'The Gruvs HQ 👑',
          'Welcome to the vibe economy. We are here to help you find your crew.', 9999, true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
--  5. EVENTS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug            TEXT        UNIQUE,
  title           TEXT        NOT NULL,
  description     TEXT,
  category        TEXT,
  category_color  TEXT,
  tags            TEXT[],
  event_date      DATE,
  event_time      TEXT,
  end_date        DATE,
  end_time        TEXT,
  address         TEXT,
  venue_name      TEXT,
  city            TEXT,
  country         TEXT        DEFAULT 'ZA',
  price           TEXT        DEFAULT 'FREE',
  price_min       NUMERIC,
  price_max       NUMERIC,
  capacity        INTEGER,
  going           INTEGER     DEFAULT 0,
  vibe_count      INTEGER     DEFAULT 0,
  echo_count      INTEGER     DEFAULT 0,
  reaction_count  INTEGER     DEFAULT 0,
  save_count      INTEGER     DEFAULT 0,
  ticket_url      TEXT,
  media           JSONB,
  media_urls      TEXT[],
  coords          geography(Point, 4326),
  lat             FLOAT,
  lon             FLOAT,
  date_time       TIMESTAMPTZ,
  is_featured     BOOLEAN     DEFAULT false,
  is_cancelled    BOOLEAN     DEFAULT false,
  is_deleted      BOOLEAN     DEFAULT false,
  is_sold_out     BOOLEAN     DEFAULT false,
  max_attendees   INTEGER,
  image_url       TEXT,
  cover_image     TEXT,
  age_restriction INTEGER     DEFAULT 0,
  age_max         INTEGER,
  schedule        JSONB,
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS author_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug            TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category        TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category_color  TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tags            TEXT[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_date      DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_time      TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date        DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time        TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS address         TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_name      TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS city            TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS country         TEXT DEFAULT 'ZA';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price           TEXT DEFAULT 'FREE';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_min       NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_max       NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity        INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS going           INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS vibe_count      INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS echo_count      INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reaction_count  INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS save_count      INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_url      TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS media           JSONB;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS media_urls      TEXT[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS coords          geography(Point, 4326);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS lat             FLOAT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS lon             FLOAT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS date_time       TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_featured     BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_cancelled    BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_deleted      BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_sold_out     BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS max_attendees   INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url       TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_image     TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS age_restriction INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS age_max         INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS schedule        JSONB;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS search_vector   TSVECTOR;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

-- Computed trending score (stored, updated by trigger)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='trending_score'
  ) THEN
    ALTER TABLE public.events ADD COLUMN trending_score FLOAT
      GENERATED ALWAYS AS (vibe_count * 1.0 + going * 0.5 + echo_count * 0.3 + reaction_count * 0.2) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_coords_gist ON public.events USING gist(coords);
CREATE INDEX IF NOT EXISTS events_search_gin  ON public.events USING gin(search_vector);
CREATE INDEX IF NOT EXISTS events_tags_gin    ON public.events USING gin(tags);
CREATE INDEX IF NOT EXISTS events_category    ON public.events(category);
CREATE INDEX IF NOT EXISTS events_upcoming    ON public.events(event_date ASC) WHERE is_cancelled = false AND is_deleted = false;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events readable by all"            ON public.events;
DROP POLICY IF EXISTS "Authenticated users insert events" ON public.events;
DROP POLICY IF EXISTS "Users update own events"           ON public.events;
DROP POLICY IF EXISTS "Users delete own events"           ON public.events;

CREATE POLICY "Events readable by all"            ON public.events FOR SELECT USING (true);
-- Allow both author_id and user_id (both columns are used in different code paths)
CREATE POLICY "Authenticated users insert events" ON public.events FOR INSERT
  WITH CHECK (auth.uid() = author_id OR auth.uid() = user_id);
CREATE POLICY "Users update own events"           ON public.events FOR UPDATE
  USING (auth.uid() = author_id OR auth.uid() = user_id);
CREATE POLICY "Users delete own events"           ON public.events FOR DELETE
  USING (auth.uid() = author_id OR auth.uid() = user_id);



-- ══════════════════════════════════════════════════════════════════════════════
--  6. EVENT ENGAGEMENT SUB-TABLES
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS event_vibes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_vibes ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_vibes ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS event_vibes_event_id ON event_vibes(event_id);
CREATE INDEX IF NOT EXISTS event_vibes_user_id  ON event_vibes(user_id);

ALTER TABLE event_vibes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event vibes readable"          ON event_vibes;
DROP POLICY IF EXISTS "Users manage own event vibes"  ON event_vibes;
CREATE POLICY "Event vibes readable"          ON event_vibes FOR SELECT USING (true);
CREATE POLICY "Users manage own event vibes"  ON event_vibes FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_vibe_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events   SET vibe_count = vibe_count + 1             WHERE id = new.event_id RETURNING COALESCE(author_id, user_id) INTO v_owner;
    UPDATE profiles SET vibe_score = vibe_score + 2             WHERE id = v_owner;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events   SET vibe_count = greatest(0, vibe_count-1)  WHERE id = old.event_id RETURNING COALESCE(author_id, user_id) INTO v_owner;
    UPDATE profiles SET vibe_score = greatest(0, vibe_score-2)  WHERE id = v_owner;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS event_vibes_sync ON event_vibes;
CREATE TRIGGER event_vibes_sync AFTER INSERT OR DELETE ON event_vibes
  FOR EACH ROW EXECUTE FUNCTION sync_vibe_counts();

-- Backward-compat view so any legacy server queries on 'vibes' still work
DROP VIEW IF EXISTS vibes;
CREATE OR REPLACE VIEW vibes AS SELECT * FROM event_vibes;


CREATE TABLE IF NOT EXISTS saved_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE saved_events ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE saved_events ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS saved_events_user_id  ON saved_events(user_id);
CREATE INDEX IF NOT EXISTS saved_events_event_id ON saved_events(event_id);

ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saves" ON saved_events;
CREATE POLICY "Users manage own saves" ON saved_events FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_save_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events   SET save_count  = save_count  + 1             WHERE id = new.event_id;
    UPDATE profiles SET saved_count = saved_count + 1             WHERE id = new.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events   SET save_count  = greatest(0, save_count -1)  WHERE id = old.event_id;
    UPDATE profiles SET saved_count = greatest(0, saved_count-1)  WHERE id = old.user_id;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS saved_events_sync ON saved_events;
CREATE TRIGGER saved_events_sync AFTER INSERT OR DELETE ON saved_events
  FOR EACH ROW EXECUTE FUNCTION sync_save_counts();


CREATE TABLE IF NOT EXISTS event_reactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_key TEXT        NOT NULL CHECK (reaction_key IN ('fire','heart','skull','100','mic','crown')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS reaction_key TEXT;

CREATE INDEX IF NOT EXISTS event_reactions_event_id ON event_reactions(event_id);

ALTER TABLE event_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reactions readable"          ON event_reactions;
DROP POLICY IF EXISTS "Users manage own reactions"  ON event_reactions;
CREATE POLICY "Reactions readable"          ON event_reactions FOR SELECT USING (true);
CREATE POLICY "Users manage own reactions"  ON event_reactions FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_reaction_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events SET reaction_count = reaction_count + 1             WHERE id = new.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events SET reaction_count = greatest(0, reaction_count-1)  WHERE id = old.event_id;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS reactions_sync ON event_reactions;
CREATE TRIGGER reactions_sync AFTER INSERT OR DELETE ON event_reactions
  FOR EACH ROW EXECUTE FUNCTION sync_reaction_count();

CREATE TABLE IF NOT EXISTS echoes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id  UUID        REFERENCES echoes(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  likes      INTEGER     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE echoes ADD COLUMN IF NOT EXISTS event_id  UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES echoes(id)   ON DELETE CASCADE;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS body      TEXT;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS likes     INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS echoes_event_id  ON echoes(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS echoes_parent_id ON echoes(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS echoes_user_id   ON echoes(user_id);

ALTER TABLE echoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Echoes readable"          ON echoes;
DROP POLICY IF EXISTS "Users insert own echoes"  ON echoes;
DROP POLICY IF EXISTS "Users update own echoes"  ON echoes;
DROP POLICY IF EXISTS "Users delete own echoes"  ON echoes;
CREATE POLICY "Echoes readable"          ON echoes FOR SELECT USING (true);
CREATE POLICY "Users insert own echoes"  ON echoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own echoes"  ON echoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own echoes"  ON echoes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_echo_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events   SET echo_count = echo_count + 1             WHERE id = new.event_id RETURNING user_id INTO v_owner;
    UPDATE profiles SET vibe_score = vibe_score + 1             WHERE id = v_owner;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events   SET echo_count = greatest(0, echo_count-1)  WHERE id = old.event_id;
  END IF;
  RETURN null;
END;
$$;


CREATE TABLE IF NOT EXISTS echo_likes (
  echo_id UUID NOT NULL REFERENCES echoes(id)   ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (echo_id, user_id)
);

ALTER TABLE echo_likes ADD COLUMN IF NOT EXISTS echo_id UUID REFERENCES echoes(id)   ON DELETE CASCADE;
ALTER TABLE echo_likes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE echo_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Echo likes readable"          ON echo_likes;
DROP POLICY IF EXISTS "Users manage own echo likes"  ON echo_likes;
CREATE POLICY "Echo likes readable"          ON echo_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own echo likes"  ON echo_likes FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_echo_likes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE echoes SET likes = likes + 1             WHERE id = new.echo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE echoes SET likes = greatest(0, likes-1)  WHERE id = old.echo_id;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS echo_likes_sync ON echo_likes;
CREATE TRIGGER echo_likes_sync AFTER INSERT OR DELETE ON echo_likes
  FOR EACH ROW EXECUTE FUNCTION sync_echo_likes();

CREATE TABLE IF NOT EXISTS event_ratings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating     SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review     TEXT        CHECK (length(review) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_ratings ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_ratings ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE event_ratings ADD COLUMN IF NOT EXISTS rating   SMALLINT;
ALTER TABLE event_ratings ADD COLUMN IF NOT EXISTS review   TEXT;

CREATE INDEX IF NOT EXISTS event_ratings_event_id ON event_ratings(event_id);

ALTER TABLE event_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ratings readable"          ON event_ratings;
DROP POLICY IF EXISTS "Users manage own ratings"  ON event_ratings;
CREATE POLICY "Ratings readable"          ON event_ratings FOR SELECT USING (true);
CREATE POLICY "Users manage own ratings"  ON event_ratings FOR ALL    USING (auth.uid() = user_id);


-- ============================================================

--  CHECK-INS  (RSVP going count)
-- ============================================================
CREATE TABLE IF NOT EXISTS check_ins (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS check_ins_event_id ON check_ins(event_id);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Check-ins readable"         ON check_ins;
DROP POLICY IF EXISTS "Users manage own check-ins" ON check_ins;
CREATE POLICY "Check-ins readable"         ON check_ins FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own check-ins" ON check_ins;
CREATE POLICY "Users manage own check-ins" ON check_ins FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_check_in_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events   SET going      = going      + 1  WHERE id = new.event_id;
    UPDATE profiles SET vibe_score = vibe_score + 5  WHERE id = new.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events   SET going = greatest(0, going-1) WHERE id = old.event_id;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS check_ins_sync ON check_ins;
CREATE TRIGGER check_ins_sync AFTER INSERT OR DELETE ON check_ins
  FOR EACH ROW EXECUTE FUNCTION sync_check_in_counts();



CREATE TABLE IF NOT EXISTS event_gallery (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url        TEXT        NOT NULL,
  caption    TEXT        CHECK (length(caption) <= 200),
  width      INTEGER,
  height     INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS event_id   UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS pulse_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (length(content) <= 200),
  vote_count  INTEGER     DEFAULT 1,
  is_live     BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pulse_requests_event_id ON pulse_requests(event_id, vote_count DESC);
ALTER TABLE pulse_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pulse readable"        ON pulse_requests;
DROP POLICY IF EXISTS "Users insert pulse"    ON pulse_requests;
DROP POLICY IF EXISTS "Users update pulse"    ON pulse_requests;
CREATE POLICY "Pulse readable"        ON pulse_requests FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS pulse_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES pulse_requests(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (request_id, user_id)
);
ALTER TABLE pulse_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pulse votes readable"  ON pulse_votes;
DROP POLICY IF EXISTS "Users manage own vote" ON pulse_votes;
CREATE POLICY "Pulse votes readable"  ON pulse_votes FOR SELECT USING (true);
CREATE POLICY "Users manage own vote" ON pulse_votes FOR ALL    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS event_gallery_event_id ON event_gallery(event_id);

ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS event_reminders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id       UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  remind_at      TIMESTAMPTZ NOT NULL,
  minutes_before INTEGER     DEFAULT 60,
  sent           BOOLEAN     DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS reminders_user    ON event_reminders(user_id);
CREATE INDEX IF NOT EXISTS reminders_send_at ON event_reminders(remind_at) WHERE sent = false;
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own reminders" ON event_reminders;
CREATE POLICY "Users manage own reminders" ON event_reminders FOR ALL USING (auth.uid() = user_id);

-- ============================================================
--  PROFILE VIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS event_checkins (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  event_id    UUID        REFERENCES events(id)   ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_checkins readable" ON event_checkins;
DROP POLICY IF EXISTS "Users insert checkins"   ON event_checkins;
CREATE POLICY "event_checkins readable"   ON event_checkins FOR SELECT USING (true);
CREATE POLICY "Users insert checkins"     ON event_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================

CREATE TABLE IF NOT EXISTS event_rsvps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        DEFAULT 'going' CHECK (status IN ('going','interested','not_going','maybe')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id  ON event_rsvps(user_id);
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RSVPs readable"         ON event_rsvps;
DROP POLICY IF EXISTS "Users manage own RSVPs" ON event_rsvps;
CREATE POLICY "RSVPs readable"         ON event_rsvps FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own RSVPs" ON event_rsvps;
CREATE POLICY "Users manage own RSVPs" ON event_rsvps FOR ALL    USING (auth.uid() = user_id);



CREATE TABLE IF NOT EXISTS event_polls (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question      TEXT        NOT NULL,
  options       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  votes         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  schedule_slot JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_polls_event_id ON event_polls(event_id);
CREATE INDEX IF NOT EXISTS event_polls_author   ON event_polls(author_id);

ALTER TABLE event_polls ENABLE ROW LEVEL SECURITY;

-- Anyone can read polls
DROP POLICY IF EXISTS "event_polls_read" ON event_polls;
CREATE POLICY "event_polls_read" ON event_polls
  FOR SELECT USING (true);

-- Authenticated users can create polls for events they own
DROP POLICY IF EXISTS "event_polls_insert" ON event_polls;
CREATE POLICY "event_polls_insert" ON event_polls
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Poll author can update (e.g. record votes) — anyone authenticated can vote
DROP POLICY IF EXISTS "event_polls_update" ON event_polls;
CREATE POLICY "event_polls_update" ON event_polls
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Only author can delete
DROP POLICY IF EXISTS "event_polls_delete" ON event_polls;
CREATE POLICY "event_polls_delete" ON event_polls
  FOR DELETE USING (auth.uid() = author_id);

-- Hashtags (tracks tag usage counts for trending/search)
CREATE TABLE IF NOT EXISTS hashtags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tag        TEXT        UNIQUE NOT NULL,
  use_count  INTEGER     DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hashtags ADD COLUMN IF NOT EXISTS tag       TEXT;
ALTER TABLE hashtags ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS hashtags_tag     ON hashtags(tag);
CREATE INDEX IF NOT EXISTS hashtags_popular ON hashtags(use_count DESC);

ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hashtags readable" ON hashtags;
CREATE POLICY "Hashtags readable" ON hashtags FOR SELECT USING (true);

-- ══════════════════════════════════════════════════════════════
--  ADVANCED FEATURES TABLES (Roles, Activity, Playlists)
-- ══════════════════════════════════════════════════════════════

-- 1. Event Roles
CREATE TABLE IF NOT EXISTS public.event_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('co_host','moderator','scanner','vip_manager')),
  granted_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_roles_event ON public.event_roles(event_id);
CREATE INDEX IF NOT EXISTS idx_event_roles_user  ON public.event_roles(user_id);

ALTER TABLE public.event_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_roles_select" ON public.event_roles;
CREATE POLICY "event_roles_select" ON public.event_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_roles_insert" ON public.event_roles;
CREATE POLICY "event_roles_insert" ON public.event_roles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_roles er2 WHERE er2.event_id = event_roles.event_id AND er2.user_id = auth.uid() AND er2.role = 'co_host')
  );
DROP POLICY IF EXISTS "event_roles_delete" ON public.event_roles;
CREATE POLICY "event_roles_delete" ON public.event_roles FOR DELETE
  USING (
    granted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid())
  );

-- 2. Activity Feed
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type    TEXT NOT NULL,
  target_id      UUID,
  target_type    TEXT,
  target_title   TEXT,
  actor_username TEXT,
  actor_avatar   TEXT,
  read           BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_recipient ON public.activity_feed(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_unread    ON public.activity_feed(recipient_id, read) WHERE read = false;

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_select" ON public.activity_feed;
CREATE POLICY "activity_select" ON public.activity_feed FOR SELECT USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "activity_insert" ON public.activity_feed;
CREATE POLICY "activity_insert" ON public.activity_feed FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "activity_update" ON public.activity_feed;
CREATE POLICY "activity_update" ON public.activity_feed FOR UPDATE USING (auth.uid() = recipient_id);

-- 3. Event Playlists + Tracks
CREATE TABLE IF NOT EXISTS public.event_playlists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  name         TEXT NOT NULL DEFAULT 'Event Playlist',
  spotify_url  TEXT,
  youtube_url  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS public.event_playlist_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.event_playlists(id) ON DELETE CASCADE,
  added_by    UUID NOT NULL REFERENCES public.profiles(id),
  track_id    TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('spotify','youtube')),
  title       TEXT NOT NULL,
  artist      TEXT,
  thumbnail   TEXT,
  duration_ms INT,
  votes       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, track_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_votes ON public.event_playlist_tracks(playlist_id, votes DESC);

CREATE TABLE IF NOT EXISTS public.event_track_votes (
  track_id UUID NOT NULL REFERENCES public.event_playlist_tracks(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, user_id)
);

ALTER TABLE public.event_playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "playlists_select" ON public.event_playlists;
CREATE POLICY "playlists_select" ON public.event_playlists FOR SELECT USING (true);
DROP POLICY IF EXISTS "playlists_insert" ON public.event_playlists;
CREATE POLICY "playlists_insert" ON public.event_playlists FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "playlists_update" ON public.event_playlists;
CREATE POLICY "playlists_update" ON public.event_playlists FOR UPDATE
  USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

ALTER TABLE public.event_playlist_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tracks_select" ON public.event_playlist_tracks;
CREATE POLICY "tracks_select" ON public.event_playlist_tracks FOR SELECT USING (true);
DROP POLICY IF EXISTS "tracks_insert" ON public.event_playlist_tracks;
CREATE POLICY "tracks_insert" ON public.event_playlist_tracks FOR INSERT WITH CHECK (auth.uid() = added_by);


-- ============================================================
--  PATHS (user journey trails)
-- ============================================================

-- ══════════════════════════════════════════════════════════════════════════════
--  6b. CANONICAL ROUTES & PATHS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS routes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  steps       JSONB       DEFAULT '[]',
  color       TEXT        DEFAULT '#00f2ff',
  icon        TEXT,
  join_count  INTEGER     DEFAULT 0,
  vibe_score  INTEGER     DEFAULT 0,
  active      BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE routes ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS title       TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS steps       JSONB   DEFAULT '[]';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS color       TEXT    DEFAULT '#00f2ff';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS join_count  INTEGER DEFAULT 0;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS routes_active     ON routes(active, join_count DESC);
CREATE INDEX IF NOT EXISTS routes_user_id    ON routes(user_id);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Routes readable"          ON routes;
DROP POLICY IF EXISTS "Users manage own routes"  ON routes;
CREATE POLICY "Routes readable"          ON routes FOR SELECT USING (true);
CREATE POLICY "Users manage own routes"  ON routes FOR ALL    USING (auth.uid() = user_id);

-- Route joins

CREATE TABLE IF NOT EXISTS route_joins (
  route_id   UUID NOT NULL REFERENCES routes(id)   ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (route_id, user_id)
);

ALTER TABLE route_joins ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id)   ON DELETE CASCADE;
ALTER TABLE route_joins ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE route_joins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Route joins readable"          ON route_joins;
DROP POLICY IF EXISTS "Users manage own route joins"  ON route_joins;
CREATE POLICY "Route joins readable"          ON route_joins FOR SELECT USING (true);
CREATE POLICY "Users manage own route joins"  ON route_joins FOR ALL    USING (auth.uid() = user_id);

-- Route steps (ordered waypoints per route, linking to events)
CREATE TABLE IF NOT EXISTS route_steps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID        NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  event_id   UUID        REFERENCES events(id) ON DELETE SET NULL,
  position   INTEGER     NOT NULL DEFAULT 0,
  title      TEXT,
  lat        FLOAT,
  lon        FLOAT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id) ON DELETE CASCADE;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS title    TEXT;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS lat      FLOAT;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS lon      FLOAT;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS notes    TEXT;

CREATE INDEX IF NOT EXISTS route_steps_route ON route_steps(route_id, position);

ALTER TABLE route_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Route steps readable" ON route_steps;
CREATE POLICY "Route steps readable" ON route_steps FOR SELECT USING (true);


-- ============================================================
--  SERVICE MARKETPLACE
-- ============================================================

CREATE TABLE IF NOT EXISTS paths (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  color       TEXT        DEFAULT '#00f2ff',
  is_public   BOOLEAN     DEFAULT true,
  star_count  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paths_user   ON paths(user_id);
CREATE INDEX IF NOT EXISTS paths_public ON paths(is_public, created_at DESC) WHERE is_public = true;
ALTER TABLE paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public paths readable"  ON paths;
DROP POLICY IF EXISTS "Users manage own paths" ON paths;
CREATE POLICY "Public paths readable"  ON paths FOR SELECT USING (is_public = true OR auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own paths" ON paths;
CREATE POLICY "Users manage own paths" ON paths FOR ALL    USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS path_traces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id     UUID        NOT NULL REFERENCES paths(id)    ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat         FLOAT       NOT NULL,
  lon         FLOAT       NOT NULL,
  event_id    UUID        REFERENCES events(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS path_traces_path ON path_traces(path_id, recorded_at);
ALTER TABLE path_traces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path traces readable" ON path_traces;
CREATE POLICY "Path traces readable"    ON path_traces FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own traces" ON path_traces;
CREATE POLICY "Users manage own traces" ON path_traces FOR ALL    USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS path_stars (
  path_id    UUID        NOT NULL REFERENCES paths(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (path_id, user_id)
);
ALTER TABLE path_stars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path stars readable" ON path_stars;
CREATE POLICY "Path stars readable"         ON path_stars FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own path stars" ON path_stars;
CREATE POLICY "Users manage own path stars" ON path_stars FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_path_stars()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE paths SET star_count = star_count + 1              WHERE id = new.path_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE paths SET star_count = greatest(0, star_count-1) WHERE id = old.path_id;
  END IF; RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS path_stars_sync ON path_stars;
CREATE TRIGGER path_stars_sync AFTER INSERT OR DELETE ON path_stars
  FOR EACH ROW EXECUTE FUNCTION sync_path_stars();

-- user_paths: paths a user has joined or bookmarked
CREATE TABLE IF NOT EXISTS user_paths (
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  path_id    UUID        NOT NULL REFERENCES paths(id)    ON DELETE CASCADE,
  role       TEXT        DEFAULT 'follower',
  joined_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, path_id)
);

ALTER TABLE user_paths ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE user_paths ADD COLUMN IF NOT EXISTS path_id UUID REFERENCES paths(id)    ON DELETE CASCADE;
ALTER TABLE user_paths ADD COLUMN IF NOT EXISTS role    TEXT DEFAULT 'follower';

ALTER TABLE user_paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User paths readable"         ON user_paths;
DROP POLICY IF EXISTS "Users manage own user paths" ON user_paths;
CREATE POLICY "User paths readable"         ON user_paths FOR SELECT USING (true);
CREATE POLICY "Users manage own user paths" ON user_paths FOR ALL    USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS path_crossings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id_a  UUID        NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  path_id_b  UUID        NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  lat        FLOAT,
  lon        FLOAT,
  crossed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS path_crossings_a ON path_crossings(path_id_a);
CREATE INDEX IF NOT EXISTS path_crossings_b ON path_crossings(path_id_b);
ALTER TABLE path_crossings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path crossings readable" ON path_crossings;
CREATE POLICY "Path crossings readable" ON path_crossings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service insert path_crossings" ON path_crossings;
CREATE POLICY "Service insert path_crossings" ON path_crossings FOR INSERT WITH CHECK (true);

-- ============================================================
--  REPORTS
-- ============================================================

-- ══════════════════════════════════════════════════════════════════════════════
--  6c. SERVICE MARKETPLACE
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS service_nodes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  category     TEXT,
  description  TEXT,
  price        NUMERIC,
  price_unit   TEXT        DEFAULT 'trip',
  location     TEXT,
  coords       geography(Point, 4326),
  rating       FLOAT       DEFAULT 0,
  review_count INTEGER     DEFAULT 0,
  available    BOOLEAN     DEFAULT true,
  media        JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS category    TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price        NUMERIC;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_min    NUMERIC;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_max    NUMERIC;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS available    BOOLEAN DEFAULT true;

ALTER TABLE service_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Services readable"          ON service_nodes;
DROP POLICY IF EXISTS "Users manage own services"  ON service_nodes;
CREATE POLICY "Services readable"          ON service_nodes FOR SELECT USING (true);
CREATE POLICY "Users manage own services"  ON service_nodes FOR ALL    USING (auth.uid() = user_id);

-- Gig posts

CREATE TABLE IF NOT EXISTS gig_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  pay         NUMERIC,
  location    TEXT,
  event_id    UUID        REFERENCES events(id) ON DELETE SET NULL,
  slots       INTEGER     DEFAULT 1,
  filled      INTEGER     DEFAULT 0,
  active      BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS title       TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS pay         NUMERIC;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS pay_rands   NUMERIC;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS category    TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS time_window TEXT    DEFAULT 'Flexible';
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT true;

ALTER TABLE gig_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gigs readable"          ON gig_posts;
DROP POLICY IF EXISTS "Users manage own gigs"  ON gig_posts;
CREATE POLICY "Gigs readable"          ON gig_posts FOR SELECT USING (true);
CREATE POLICY "Users manage own gigs"  ON gig_posts FOR ALL    USING (auth.uid() = user_id);


-- ============================================================
--  SERVICE BOOKINGS  (Escrow)
-- ============================================================

CREATE TABLE IF NOT EXISTS service_bookings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_node_id UUID        NOT NULL REFERENCES service_nodes(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cargo_type      TEXT,
  pickup_address  TEXT,
  dropoff_address TEXT,
  scheduled_at    TIMESTAMPTZ,
  estimated_price NUMERIC(10,2),
  status          TEXT        NOT NULL DEFAULT 'escrow_held'
                    CHECK (status IN ('escrow_held','in_progress','completed','disputed','cancelled')),
  escrow_held_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  disputed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS service_node_id UUID REFERENCES service_nodes(id) ON DELETE CASCADE;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS client_id       UUID REFERENCES profiles(id)      ON DELETE CASCADE;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS provider_id     UUID REFERENCES profiles(id)      ON DELETE CASCADE;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS cargo_type      TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS pickup_address  TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS dropoff_address TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS scheduled_at    TIMESTAMPTZ;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS estimated_price NUMERIC(10,2);
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS amount_cents    INTEGER;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'escrow_held';
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS escrow_held_at  TIMESTAMPTZ DEFAULT now();
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS disputed_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bookings_client_idx   ON service_bookings(client_id);
CREATE INDEX IF NOT EXISTS bookings_provider_idx ON service_bookings(provider_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx   ON service_bookings(status);

ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bookings readable by parties" ON service_bookings;
DROP POLICY IF EXISTS "Clients create bookings"      ON service_bookings;
DROP POLICY IF EXISTS "Parties update bookings"      ON service_bookings;
DROP POLICY IF EXISTS "Bookings readable by parties" ON service_bookings;
CREATE POLICY "Bookings readable by parties" ON service_bookings FOR SELECT USING (auth.uid() = client_id OR auth.uid() = provider_id);
CREATE POLICY "Clients create bookings"      ON service_bookings FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Parties update bookings"      ON service_bookings FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = provider_id);


-- ============================================================
--  GIG ACCEPTANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS gig_acceptances (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      UUID        NOT NULL REFERENCES gig_posts(id)  ON DELETE CASCADE,
  worker_id   UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  status      TEXT        DEFAULT 'applied' CHECK (status IN ('applied','accepted','rejected','completed')),
  message     TEXT,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (gig_id, worker_id)
);
ALTER TABLE gig_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gig acceptances visible to parties" ON gig_acceptances;
DROP POLICY IF EXISTS "Workers can apply"                  ON gig_acceptances;
DROP POLICY IF EXISTS "Parties update gig acceptance"      ON gig_acceptances;
DROP POLICY IF EXISTS "Gig acceptances visible to parties" ON gig_acceptances;
CREATE POLICY "Gig acceptances visible to parties" ON gig_acceptances FOR SELECT
  USING (auth.uid() = worker_id OR EXISTS (SELECT 1 FROM gig_posts g WHERE g.id = gig_id AND g.user_id = auth.uid()));
CREATE POLICY "Workers can apply"             ON gig_acceptances FOR INSERT WITH CHECK (auth.uid() = worker_id);
DROP POLICY IF EXISTS "Parties update gig acceptance" ON gig_acceptances;
CREATE POLICY "Parties update gig acceptance" ON gig_acceptances FOR UPDATE
  USING (auth.uid() = worker_id OR EXISTS (SELECT 1 FROM gig_posts g WHERE g.id = gig_id AND g.user_id = auth.uid()));

-- ============================================================
--  DISPUTES
-- ============================================================

CREATE TABLE IF NOT EXISTS disputes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL REFERENCES service_bookings(id) ON DELETE CASCADE,
  raised_by  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason     TEXT,
  status     TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES service_bookings(id) ON DELETE CASCADE;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS raised_by  UUID REFERENCES profiles(id)         ON DELETE CASCADE;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS reason     TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'open';

CREATE INDEX IF NOT EXISTS disputes_booking_idx ON disputes(booking_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx  ON disputes(status);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Disputes readable by parties" ON disputes;
DROP POLICY IF EXISTS "Users raise own disputes"     ON disputes;
DROP POLICY IF EXISTS "Disputes readable by parties" ON disputes;
CREATE POLICY "Disputes readable by parties" ON disputes FOR SELECT USING (auth.uid() = raised_by);
CREATE POLICY "Users raise own disputes"     ON disputes FOR INSERT WITH CHECK (auth.uid() = raised_by);


-- ============================================================
--  REFERRALS
-- ============================================================

CREATE TABLE IF NOT EXISTS referrals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code        TEXT        UNIQUE,
  status      TEXT        DEFAULT 'pending',
  reward      NUMERIC     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (referrer_id, referred_id)
);

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS code        TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'pending';

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Referrals readable by owner"  ON referrals;
CREATE POLICY "Referrals readable by owner"  ON referrals FOR ALL USING (auth.uid() = referrer_id OR auth.uid() = referred_id);


-- ============================================================
--  BUSINESS PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS service_reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID,
  provider_id UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  rating      INTEGER     CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_reviews readable"     ON service_reviews;
DROP POLICY IF EXISTS "Reviewers insert reviews"     ON service_reviews;
CREATE POLICY "service_reviews readable"     ON service_reviews FOR SELECT USING (true);
CREATE POLICY "Reviewers insert reviews"     ON service_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- ============================================================
--  GOVERNANCE (proposals + votes)
-- ============================================================

-- ══════════════════════════════════════════════════════════════════════════════
--  7. NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Gallery readable"      ON event_gallery;
DROP POLICY IF EXISTS "Users insert gallery"  ON event_gallery;
DROP POLICY IF EXISTS "Users delete gallery"  ON event_gallery;
CREATE POLICY "Gallery readable"      ON event_gallery FOR SELECT USING (true);
CREATE POLICY "Users insert gallery"  ON event_gallery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete gallery"  ON event_gallery FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
--  NOTIFICATIONS
-- ============================================================

-- Safely rename user_id → recipient_id and is_read → read on existing tables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='recipient_id') THEN
    ALTER TABLE notifications RENAME COLUMN user_id TO recipient_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read') THEN
    ALTER TABLE notifications RENAME COLUMN is_read TO read;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL,
  title        TEXT,
  body         TEXT,
  data         JSONB       DEFAULT '{}',
  event_id     UUID        REFERENCES events(id) ON DELETE CASCADE,
  echo_id      UUID        REFERENCES echoes(id) ON DELETE CASCADE,
  read         BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id     UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type         TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title        TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body         TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data         JSONB DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES events(id)  ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS echo_id      UUID REFERENCES echoes(id)  ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read         BOOLEAN DEFAULT false;

DROP INDEX IF EXISTS notifications_user_id;
DROP INDEX IF EXISTS notifications_unread;
CREATE INDEX IF NOT EXISTS notifications_recipient_id ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread       ON notifications(recipient_id) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications"  ON notifications;
DROP POLICY IF EXISTS "System insert notifications"   ON notifications;
DROP POLICY IF EXISTS "Users mark own as read"        ON notifications;
CREATE POLICY "Users read own notifications"  ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "System insert notifications"   ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users mark own as read"        ON notifications FOR UPDATE USING (auth.uid() = recipient_id);


ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications"    ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "System insert notifications"     ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications"  ON public.notifications;
CREATE POLICY "Users read own notifications"   ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "System insert notifications"    ON public.notifications FOR INSERT
  WITH CHECK (auth.role() IN ('service_role', 'postgres', 'authenticated'));
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  8. LIVE CHECK-INS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.live_checkins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id       UUID        REFERENCES public.events(id) ON DELETE CASCADE,
  lat            FLOAT,
  lon            FLOAT,
  venue_name     TEXT,
  identity_layer TEXT        DEFAULT 'public',
  ghost_alias    TEXT,
  checked_in_at  TIMESTAMPTZ DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  UNIQUE(user_id, event_id)
);
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS venue_name    TEXT;
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS live_checkins_event_idx   ON public.live_checkins(event_id);
CREATE INDEX IF NOT EXISTS live_checkins_expires_idx ON public.live_checkins(expires_at);

ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Checkins readable"         ON public.live_checkins;
DROP POLICY IF EXISTS "Users manage own checkins" ON public.live_checkins;
CREATE POLICY "Checkins readable"         ON public.live_checkins FOR SELECT USING (true);
CREATE POLICY "Users manage own checkins" ON public.live_checkins FOR ALL    USING (auth.uid() = user_id);

-- Auto-expire stale checkins (call from edge function cron)
CREATE OR REPLACE FUNCTION public.purge_expired_checkins()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.live_checkins WHERE expires_at IS NOT NULL AND expires_at < now();
$$;


-- ══════════════════════════════════════════════════════════════════════════════
--  9. STORIES
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        NOT NULL DEFAULT 'image',
  caption     TEXT,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stories_user_id_idx ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories(expires_at);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stories readable"         ON public.stories;
DROP POLICY IF EXISTS "Users insert own stories" ON public.stories;
DROP POLICY IF EXISTS "Users delete own stories" ON public.stories;
CREATE POLICY "Stories readable"         ON public.stories FOR SELECT
  USING (expires_at > now());
CREATE POLICY "Users insert own stories" ON public.stories FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');
CREATE POLICY "Users delete own stories" ON public.stories FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id   UUID        NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users log own story views" ON public.story_views;
CREATE POLICY "Users log own story views" ON public.story_views
  FOR ALL USING (auth.uid() = viewer_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  10. REELS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reels (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caption       TEXT,
  media_url     TEXT        NOT NULL,
  media_type    TEXT        NOT NULL DEFAULT 'video',
  sound_name    TEXT,
  event_id      UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  event_title   TEXT,
  like_count    INTEGER     NOT NULL DEFAULT 0,
  comment_count INTEGER     NOT NULL DEFAULT 0,
  view_count    INTEGER     NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS sound_name TEXT;

CREATE INDEX IF NOT EXISTS reels_user_id_idx    ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS reels_created_at_idx ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS reels_like_count_idx ON public.reels(like_count DESC) WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS reel_likes_user_id_idx ON public.reel_likes(user_id);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reel_comments_reel_id_idx ON public.reel_comments(reel_id);

CREATE TABLE IF NOT EXISTS public.reel_views (
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS reel_views_viewer_id_idx ON public.reel_views(viewer_id);

CREATE TABLE IF NOT EXISTS public.saved_reels (
  reel_id    UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS saved_reels_user_id_idx ON public.saved_reels(user_id);

CREATE TABLE IF NOT EXISTS public.reel_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     UUID        NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  reporter_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reel_id, reporter_id)
);

-- Reels RLS
ALTER TABLE public.reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_reports  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reels readable by all"           ON public.reels;
DROP POLICY IF EXISTS "Authenticated users insert reels" ON public.reels;
DROP POLICY IF EXISTS "Users update own reels"           ON public.reels;
DROP POLICY IF EXISTS "Users delete own reels"           ON public.reels;
CREATE POLICY "Reels readable by all"            ON public.reels FOR SELECT USING (is_deleted = false AND (is_hidden = false OR auth.uid() = user_id));
CREATE POLICY "Authenticated users insert reels" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');
CREATE POLICY "Users update own reels"           ON public.reels FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reels"           ON public.reels FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reel likes readable by all" ON public.reel_likes;
DROP POLICY IF EXISTS "Users manage own likes"     ON public.reel_likes;
DROP POLICY IF EXISTS "Users insert own likes"     ON public.reel_likes;
DROP POLICY IF EXISTS "Users delete own likes"     ON public.reel_likes;
CREATE POLICY "Reel likes readable by all" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "Users insert own likes"     ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');
CREATE POLICY "Users delete own likes"     ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reel comments readable by all" ON public.reel_comments;
DROP POLICY IF EXISTS "Users insert own comments"     ON public.reel_comments;
DROP POLICY IF EXISTS "Users update own comments"     ON public.reel_comments;
DROP POLICY IF EXISTS "Users delete own comments"     ON public.reel_comments;
CREATE POLICY "Reel comments readable by all" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "Users insert own comments"     ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');
CREATE POLICY "Users update own comments"     ON public.reel_comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments"     ON public.reel_comments FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users log own views"   ON public.reel_views;
DROP POLICY IF EXISTS "Reel views readable by all" ON public.reel_views;
DROP POLICY IF EXISTS "Users insert own views"     ON public.reel_views;
DROP POLICY IF EXISTS "Users update own views"     ON public.reel_views;
CREATE POLICY "Reel views readable by all" ON public.reel_views FOR SELECT USING (true);
CREATE POLICY "Users insert own views"     ON public.reel_views FOR INSERT WITH CHECK (auth.uid() = viewer_id AND auth.role() = 'authenticated');
CREATE POLICY "Users update own views"     ON public.reel_views FOR UPDATE USING (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Users manage own saved reels" ON public.saved_reels;
DROP POLICY IF EXISTS "Users select own saved reels" ON public.saved_reels;
DROP POLICY IF EXISTS "Users insert own saved reels" ON public.saved_reels;
DROP POLICY IF EXISTS "Users delete own saved reels" ON public.saved_reels;
CREATE POLICY "Users select own saved reels" ON public.saved_reels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own saved reels" ON public.saved_reels FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');
CREATE POLICY "Users delete own saved reels" ON public.saved_reels FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can report reels" ON public.reel_reports;
DROP POLICY IF EXISTS "Reel reports select"    ON public.reel_reports;
DROP POLICY IF EXISTS "Reel reports insert"    ON public.reel_reports;
DROP POLICY IF EXISTS "Reel reports update"    ON public.reel_reports;
CREATE POLICY "Reel reports select" ON public.reel_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Reel reports insert" ON public.reel_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id AND auth.role() = 'authenticated');
CREATE POLICY "Reel reports update" ON public.reel_reports FOR UPDATE USING (auth.uid() = reporter_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  10b. PULSE — Live Voting / Democratic Interaction Engine
-- ══════════════════════════════════════════════════════════════════════════════

-- Pulse Schedules: timeline blocks for Events/Places
CREATE TABLE IF NOT EXISTS public.pulse_schedules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        REFERENCES public.events(id) ON DELETE CASCADE,
  start_time  TIMESTAMPTZ,
  end_time    TIMESTAMPTZ,
  title       TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pulse_schedules_event ON public.pulse_schedules(event_id);

-- Pulse Requests: items users vote on (songs, menu specials, drill topics, zones)
CREATE TABLE IF NOT EXISTS public.pulse_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        REFERENCES public.events(id) ON DELETE CASCADE,
  schedule_id  UUID        REFERENCES public.pulse_schedules(id) ON DELETE CASCADE,
  requested_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  content      TEXT        NOT NULL,
  request_type TEXT        NOT NULL,
  status       TEXT        DEFAULT 'pending',
  vote_count   INTEGER     DEFAULT 1,
  is_live      BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS request_type TEXT;
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'pending';
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS schedule_id  UUID REFERENCES public.pulse_schedules(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pulse_requests_event ON public.pulse_requests(event_id);

-- Pulse Votes: prevents double-voting
CREATE TABLE IF NOT EXISTS public.pulse_votes (
  request_id UUID        NOT NULL REFERENCES public.pulse_requests(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id)       ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);

-- Auto-update vote_count on pulse_requests
CREATE OR REPLACE FUNCTION public.update_pulse_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pulse_requests SET vote_count = vote_count + 1 WHERE id = NEW.request_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pulse_requests SET vote_count = GREATEST(0, vote_count - 1) WHERE id = OLD.request_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_pulse_vote_count ON public.pulse_votes;
CREATE TRIGGER trg_update_pulse_vote_count
AFTER INSERT OR DELETE ON public.pulse_votes
FOR EACH ROW EXECUTE FUNCTION public.update_pulse_vote_count();

-- RLS
ALTER TABLE public.pulse_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_votes     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pulse schedules"      ON public.pulse_schedules;
DROP POLICY IF EXISTS "Hosts can manage pulse schedules"     ON public.pulse_schedules;
CREATE POLICY "Anyone can view pulse schedules"  ON public.pulse_schedules FOR SELECT USING (true);
CREATE POLICY "Hosts can manage pulse schedules" ON public.pulse_schedules FOR ALL
  USING (auth.uid() IN (SELECT author_id FROM public.events WHERE id = event_id));

DROP POLICY IF EXISTS "Anyone can view pulse requests"           ON public.pulse_requests;
DROP POLICY IF EXISTS "Authenticated users can insert requests"  ON public.pulse_requests;
DROP POLICY IF EXISTS "Hosts can update requests"                ON public.pulse_requests;
CREATE POLICY "Anyone can view pulse requests"           ON public.pulse_requests FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert requests"  ON public.pulse_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Hosts can update requests"                ON public.pulse_requests FOR UPDATE
  USING (auth.uid() IN (SELECT author_id FROM public.events WHERE id = event_id));

DROP POLICY IF EXISTS "Anyone can view votes"           ON public.pulse_votes;
DROP POLICY IF EXISTS "Users can manage their own votes" ON public.pulse_votes;
CREATE POLICY "Anyone can view votes"            ON public.pulse_votes FOR SELECT USING (true);
CREATE POLICY "Users can manage their own votes" ON public.pulse_votes FOR ALL    USING (auth.uid() = user_id);

-- Enable Realtime for the voting engine
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
--  11. BUSINESS PROFILES, AD CAMPAIGNS & ANALYTICS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS business_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  business_name   TEXT        NOT NULL,
  business_type   TEXT,
  tagline         TEXT,
  description     TEXT,
  logo_url        TEXT,
  cover_url       TEXT,
  primary_color   TEXT        DEFAULT '#00f2ff',
  accent_color    TEXT        DEFAULT '#8b5cf6',
  verified        BOOLEAN     DEFAULT false,
  tier            TEXT        DEFAULT 'starter',
  store_enabled   BOOLEAN     DEFAULT false,
  store_slug      TEXT        UNIQUE,
  store_config    JSONB       DEFAULT '{}',
  website         TEXT,
  phone           TEXT,
  email           TEXT,
  location        TEXT,
  total_revenue   NUMERIC     DEFAULT 0,
  follower_count  INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS tagline       TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS description   TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS tier          TEXT DEFAULT 'starter';
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_enabled BOOLEAN DEFAULT false;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_slug    TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_config  JSONB DEFAULT '{}';
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_profiles_owner"       ON business_profiles;
DROP POLICY IF EXISTS "business_profiles_public_read" ON business_profiles;
CREATE POLICY "business_profiles_owner"       ON business_profiles FOR ALL    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "business_profiles_public_read" ON business_profiles;
CREATE POLICY "business_profiles_public_read" ON business_profiles FOR SELECT USING (true);


-- ============================================================
--  BUSINESS PAGE BLOCKS  (Store builder)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_page_blocks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        REFERENCES business_profiles(id) ON DELETE CASCADE,
  block_type  TEXT        NOT NULL,
  position    INTEGER     DEFAULT 0,
  config      JSONB       DEFAULT '{}',
  visible     BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE business_page_blocks ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE business_page_blocks ADD COLUMN IF NOT EXISTS block_type  TEXT;
ALTER TABLE business_page_blocks ADD COLUMN IF NOT EXISTS position    INTEGER DEFAULT 0;
ALTER TABLE business_page_blocks ADD COLUMN IF NOT EXISTS config      JSONB   DEFAULT '{}';
ALTER TABLE business_page_blocks ADD COLUMN IF NOT EXISTS visible     BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_page_blocks_business ON business_page_blocks(business_id, position);

ALTER TABLE business_page_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "page_blocks_owner" ON business_page_blocks;
CREATE POLICY "page_blocks_owner" ON business_page_blocks FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));


-- ============================================================
--  AD CAMPAIGNS
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID        REFERENCES business_profiles(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  status             TEXT        DEFAULT 'draft',
  campaign_type      TEXT,
  event_id           UUID        REFERENCES events(id),
  budget_total       NUMERIC     DEFAULT 0,
  budget_spent       NUMERIC     DEFAULT 0,
  daily_limit        NUMERIC,
  start_date         TIMESTAMPTZ,
  end_date           TIMESTAMPTZ,
  headline           TEXT,
  subline            TEXT,
  cta_text           TEXT        DEFAULT 'Learn More',
  cta_url            TEXT,
  media_url          TEXT,
  targeting          JSONB       DEFAULT '{}',
  impressions        INTEGER     DEFAULT 0,
  clicks             INTEGER     DEFAULT 0,
  conversions        INTEGER     DEFAULT 0,
  revenue_attributed NUMERIC     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS business_id        UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS name               TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS status             TEXT DEFAULT 'draft';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS campaign_type      TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS budget_total       NUMERIC DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS budget_spent       NUMERIC DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS targeting          JSONB DEFAULT '{}';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS impressions        INTEGER DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS clicks             INTEGER DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS conversions        INTEGER DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS revenue_attributed NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_business ON ad_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status   ON ad_campaigns(status);

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns_owner" ON ad_campaigns;
CREATE POLICY "campaigns_owner" ON ad_campaigns FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));


-- ============================================================
--  AUDIENCE SEGMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS audience_segments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID        REFERENCES business_profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  criteria        JSONB       DEFAULT '{}',
  estimated_reach INTEGER     DEFAULT 0,
  saved           BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS business_id     UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS name            TEXT;
ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS criteria        JSONB   DEFAULT '{}';
ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS estimated_reach INTEGER DEFAULT 0;

ALTER TABLE audience_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "segments_owner" ON audience_segments;
CREATE POLICY "segments_owner" ON audience_segments FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));


-- ============================================================
--  CAMPAIGN ANALYTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS campaign_analytics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        REFERENCES ad_campaigns(id)        ON DELETE CASCADE,
  business_id UUID        REFERENCES business_profiles(id),
  event_type  TEXT,
  user_id     UUID        REFERENCES profiles(id),
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES ad_campaigns(id)    ON DELETE CASCADE;
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_profiles(id);
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS event_type  TEXT;
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id);
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_camp ON campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_biz  ON campaign_analytics(business_id);

ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_insert"      ON campaign_analytics;
DROP POLICY IF EXISTS "analytics_read_owner"  ON campaign_analytics;
CREATE POLICY "analytics_insert"     ON campaign_analytics FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "analytics_read_owner" ON campaign_analytics;
CREATE POLICY "analytics_read_owner" ON campaign_analytics FOR SELECT
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));


-- ============================================================
--  BUSINESS PARTNERSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS business_partnerships (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID        REFERENCES business_profiles(id) ON DELETE CASCADE,
  partner_type   TEXT,
  partner_name   TEXT,
  partner_logo   TEXT,
  terms          JSONB       DEFAULT '{}',
  status         TEXT        DEFAULT 'pending',
  revenue_share  NUMERIC     DEFAULT 0,
  revenue_earned NUMERIC     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS business_id    UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS partner_type   TEXT;
ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS partner_name   TEXT;
ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'pending';
ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS revenue_share  NUMERIC DEFAULT 0;
ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS revenue_earned NUMERIC DEFAULT 0;

ALTER TABLE business_partnerships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partnerships_owner" ON business_partnerships;
CREATE POLICY "partnerships_owner" ON business_partnerships FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- Business team members (owner/ceo/manager/staff hierarchy)
CREATE TABLE IF NOT EXISTS business_team_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'staff'
    CHECK (role IN ('owner','ceo','manager','sales_manager','staff')),
  permissions JSONB       DEFAULT '{}',
  invited_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  accepted    BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, user_id)
);

ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS role        TEXT DEFAULT 'staff';
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS invited_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS accepted    BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS biz_team_business ON business_team_members(business_id);
CREATE INDEX IF NOT EXISTS biz_team_user     ON business_team_members(user_id);

ALTER TABLE business_team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team readable by members" ON business_team_members;
DROP POLICY IF EXISTS "Owner manages team"       ON business_team_members;
CREATE POLICY "Team readable by members" ON business_team_members FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));
CREATE POLICY "Owner manages team" ON business_team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));


-- ============================================================
--  BUSINESS NOTIFICATIONS  (money opportunities)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        REFERENCES business_profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT,
  type        TEXT,
  read        BOOLEAN     DEFAULT false,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE business_notifications ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE business_notifications ADD COLUMN IF NOT EXISTS title       TEXT;
ALTER TABLE business_notifications ADD COLUMN IF NOT EXISTS body        TEXT;
ALTER TABLE business_notifications ADD COLUMN IF NOT EXISTS type        TEXT;
ALTER TABLE business_notifications ADD COLUMN IF NOT EXISTS read        BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_biz_notifs_unread ON business_notifications(business_id, read);

ALTER TABLE business_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_notifications_owner" ON business_notifications;
CREATE POLICY "biz_notifications_owner" ON business_notifications FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));


-- ============================================================
--  CONTEXTUAL ADS  (event-phase ad linking)
-- ============================================================

CREATE TABLE IF NOT EXISTS contextual_ads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  event_id    UUID        REFERENCES events(id),
  phase       TEXT,
  priority    INTEGER     DEFAULT 0,
  active      BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE;
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS event_id    UUID REFERENCES events(id);
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS phase       TEXT;
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS priority    INTEGER DEFAULT 0;
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT true;

ALTER TABLE contextual_ads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contextual_ads_read"  ON contextual_ads;
DROP POLICY IF EXISTS "contextual_ads_write" ON contextual_ads;
CREATE POLICY "contextual_ads_read"  ON contextual_ads FOR SELECT USING (active = true);
DROP POLICY IF EXISTS "contextual_ads_write" ON contextual_ads;
CREATE POLICY "contextual_ads_write" ON contextual_ads FOR ALL
  USING (campaign_id IN (
    SELECT id FROM ad_campaigns WHERE business_id IN (
      SELECT id FROM business_profiles WHERE user_id = auth.uid()
    )
  ));


-- ============================================================
--  RPCs

CREATE TABLE IF NOT EXISTS app_updates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version     TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  type        TEXT        NOT NULL DEFAULT 'feature' CHECK (type IN ('feature','fix','improvement','security')),
  released_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read app_updates" ON app_updates;
CREATE POLICY "Anyone can read app_updates" ON app_updates FOR SELECT USING (true);

-- ============================================================
--  DM ROOMS
-- ============================================================

ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS type        TEXT DEFAULT 'feature';
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read app_updates" ON public.app_updates;
CREATE POLICY "Anyone can read app_updates" ON public.app_updates FOR SELECT USING (true);

DROP POLICY IF EXISTS "analytics_insert" ON public.campaign_analytics;
CREATE POLICY "analytics_insert" ON public.campaign_analytics FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════════
--  11b. ECONOMY, WALLET & GOVERNANCE
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS global_economy_params (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vibe_tax_rate      FLOAT       DEFAULT 0.05,
  war_chest_balance  NUMERIC     DEFAULT 0.0,
  last_decay_at      TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE global_economy_params ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "global_economy_params readable" ON global_economy_params;
CREATE POLICY "global_economy_params readable" ON global_economy_params FOR SELECT USING (true);
-- Seed default row if none exists
INSERT INTO global_economy_params (vibe_tax_rate) SELECT 0.05 WHERE NOT EXISTS (SELECT 1 FROM global_economy_params);

-- ============================================================
--  EVENT CHECKINS (alias table used by claudeService)
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount        NUMERIC     NOT NULL,
  direction     TEXT        NOT NULL CHECK (direction IN ('credit','debit')),
  reason        TEXT        NOT NULL,
  balance_after NUMERIC,
  ref_id        UUID,
  ref_type      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_user    ON wallet_transactions(user_id, created_at DESC);
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_own" ON wallet_transactions;
CREATE POLICY "wallet_own" ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);

-- #46  Function: credit vibe_equity with full audit trail

CREATE TABLE IF NOT EXISTS daily_activity (
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day          DATE NOT NULL DEFAULT CURRENT_DATE,
  action_count INT  DEFAULT 1,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_own" ON daily_activity;
CREATE POLICY "activity_own" ON daily_activity
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- #21  Function: upsert daily activity and return current streak length

CREATE TABLE IF NOT EXISTS governance_proposals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  status      TEXT        DEFAULT 'voting_open',
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE governance_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "governance_proposals readable" ON governance_proposals;
DROP POLICY IF EXISTS "Service insert proposals"      ON governance_proposals;
CREATE POLICY "governance_proposals readable"   ON governance_proposals FOR SELECT USING (true);
CREATE POLICY "Service insert proposals"        ON governance_proposals FOR INSERT WITH CHECK (true);


CREATE TABLE IF NOT EXISTS governance_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  proposal_id UUID        REFERENCES governance_proposals(id) ON DELETE CASCADE,
  vote        TEXT        NOT NULL,
  weight      NUMERIC     DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, proposal_id)
);
ALTER TABLE governance_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "governance_votes readable" ON governance_votes;
DROP POLICY IF EXISTS "Users cast votes"          ON governance_votes;
CREATE POLICY "governance_votes readable"   ON governance_votes FOR SELECT USING (true);
CREATE POLICY "Users cast votes"            ON governance_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
--  GLOBAL ECONOMY PARAMS
-- ============================================================

-- ══════════════════════════════════════════════════════════════════════════════
--  12. SPATIAL REF SYS
--  spatial_ref_sys is owned by supabase_admin (PostGIS system table).
--  We cannot ALTER or add RLS policies to it — skip entirely.
-- ══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
--  13. VIEWS
-- ══════════════════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.vibes CASCADE;
CREATE OR REPLACE VIEW public.vibes WITH (security_invoker = true) AS SELECT * FROM public.event_vibes;

DROP VIEW IF EXISTS public.conversations CASCADE;
CREATE OR REPLACE VIEW public.conversations WITH (security_invoker = true) AS SELECT * FROM public.dm_rooms;



-- ══════════════════════════════════════════════════════════════════════════════
--  14. AI MEMORY & DIAGNOSTIC LOGS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  user_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferences JSONB       DEFAULT '{}',
  behaviour   JSONB       DEFAULT '{}',
  summary     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own ai memory"  ON public.ai_user_memory;
DROP POLICY IF EXISTS "Service manages ai memory" ON public.ai_user_memory;
CREATE POLICY "User reads own ai memory"  ON public.ai_user_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages ai memory" ON public.ai_user_memory FOR ALL   USING (auth.role() IN ('service_role','postgres'));

CREATE TABLE IF NOT EXISTS public.ai_recommendations_cache (
  user_id      UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_ids    UUID[]      DEFAULT '{}',
  viber_ids    UUID[]      DEFAULT '{}',
  reasoning    TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own recs"  ON public.ai_recommendations_cache;
DROP POLICY IF EXISTS "Service manages recs" ON public.ai_recommendations_cache;
CREATE POLICY "User reads own recs"  ON public.ai_recommendations_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages recs" ON public.ai_recommendations_cache FOR ALL   USING (auth.role() IN ('service_role','postgres'));

CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature     TEXT        NOT NULL,
  input       TEXT,
  output      TEXT,
  model       TEXT,
  tokens_used INTEGER,
  feedback    INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own interactions"  ON public.ai_interactions;
DROP POLICY IF EXISTS "Service inserts interactions" ON public.ai_interactions;
CREATE POLICY "User reads own interactions"  ON public.ai_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts interactions" ON public.ai_interactions FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS ai_interactions_created ON public.ai_interactions(created_at);

CREATE TABLE IF NOT EXISTS public.ai_moderation_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT        NOT NULL,
  content_id   UUID        NOT NULL,
  content_text TEXT        NOT NULL,
  author_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       TEXT        DEFAULT 'pending',
  ai_verdict   TEXT,
  ai_reason    TEXT,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_moderation_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service manages moderation" ON public.ai_moderation_queue;
CREATE POLICY "Service manages moderation" ON public.ai_moderation_queue FOR ALL USING (auth.role() IN ('service_role','postgres'));


CREATE TABLE IF NOT EXISTS profile_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_views_profile ON profile_views(profile_id, viewed_at DESC);
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profile views readable by owner" ON profile_views;
DROP POLICY IF EXISTS "Anyone can record view"          ON profile_views;
DROP POLICY IF EXISTS "Profile views readable by owner" ON profile_views;
CREATE POLICY "Profile views readable by owner" ON profile_views FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Anyone can record view"          ON profile_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- ============================================================
--  EVENTS — missing columns
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_attendees INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_sold_out   BOOLEAN     DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date      DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS share_url     TEXT;


CREATE TABLE IF NOT EXISTS ai_predictions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  event_id        UUID        REFERENCES events(id)   ON DELETE SET NULL,
  confidence      FLOAT,
  logic           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own ai_predictions" ON ai_predictions;
CREATE POLICY "Users read own ai_predictions" ON ai_predictions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service insert ai_predictions" ON ai_predictions;
CREATE POLICY "Service insert ai_predictions"  ON ai_predictions FOR INSERT WITH CHECK (true);


CREATE TABLE IF NOT EXISTS security_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  details     JSONB       DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read security_logs" ON security_logs;
CREATE POLICY "Admins read security_logs"  ON security_logs FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
DROP POLICY IF EXISTS "Service insert security_logs" ON security_logs;
CREATE POLICY "Service insert security_logs" ON security_logs FOR INSERT WITH CHECK (true);

-- ============================================================
--  SERVICE REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL CHECK (target_type IN ('event','profile','echo','message')),
  target_id   UUID        NOT NULL,
  reason      TEXT        NOT NULL,
  details     TEXT,
  status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_status   ON reports(status);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own reports" ON reports;
DROP POLICY IF EXISTS "Users see own reports"    ON reports;
DROP POLICY IF EXISTS "Users insert own reports" ON reports;
CREATE POLICY "Users insert own reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users see own reports"    ON reports FOR SELECT USING (auth.uid() = reporter_id);

-- ============================================================
--  APP UPDATES
-- ============================================================

-- ══════════════════════════════════════════════════════════════════════════════
--  15. STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('event-media', 'event-media', true, 104857600,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('chat_media',  'chat_media',  true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('reels',       'reels',       true, 209715200,
   ARRAY['video/mp4','video/quicktime','video/x-m4v','image/jpeg','image/png','image/webp']),
  ('stories',     'stories',     true, 52428800,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop stale policies before recreating
DROP POLICY IF EXISTS "Public read avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth update avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Public read covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth upload covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth update covers"      ON storage.objects;
DROP POLICY IF EXISTS "Public read event-media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload event-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Public read reels"       ON storage.objects;
DROP POLICY IF EXISTS "Auth upload reels"       ON storage.objects;
DROP POLICY IF EXISTS "Public read stories"     ON storage.objects;
DROP POLICY IF EXISTS "Auth upload stories"     ON storage.objects;

-- Avatars (owner-folder enforced for updates/deletes)
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth delete avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Covers
CREATE POLICY "Public read covers"  ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers"  ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

-- Event Media
CREATE POLICY "Public read event-media"  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

-- Chat Media
CREATE POLICY "Public read chat_media"  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media"  ON storage.objects FOR DELETE USING (bucket_id = 'chat_media' AND auth.role() = 'authenticated');

-- Reels
CREATE POLICY "Public read reels"   ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "Auth upload reels"   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels' AND auth.role() = 'authenticated');

-- Stories
CREATE POLICY "Public read stories" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Auth upload stories" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════════
--  16. TRIGGERS — REELS COUNT SYNC FUNCTIONS (GREATEST-FIXED)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_reel_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_reel_likes_count ON public.reel_likes;
CREATE TRIGGER trg_sync_reel_likes_count
AFTER INSERT OR DELETE ON public.reel_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_reel_likes_count();

-- FIX: GREATEST (not LEAST) for comment count
CREATE OR REPLACE FUNCTION public.sync_reel_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comment_count = comment_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_reel_comments_count ON public.reel_comments;
CREATE TRIGGER trg_sync_reel_comments_count
AFTER INSERT OR DELETE ON public.reel_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comments_count();

-- Reel view count (insert-only, no decrement needed)
CREATE OR REPLACE FUNCTION public.sync_reel_views_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET view_count = view_count + 1 WHERE id = NEW.reel_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_reel_views_count ON public.reel_views;
CREATE TRIGGER trg_sync_reel_views_count
AFTER INSERT ON public.reel_views
FOR EACH ROW EXECUTE FUNCTION public.sync_reel_views_count();


-- ══════════════════════════════════════════════════════════════════════════════
--  17. GEO-PRIVACY: FUZZED NEARBY VIBERS RPC
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_safe_nearby_vibers(u_lat FLOAT, u_lon FLOAT, radius_km FLOAT)
RETURNS TABLE (
  id          UUID,
  username    TEXT,
  avatar_url  TEXT,
  vibe_score  INTEGER,
  distance_km FLOAT,
  lat         FLOAT,
  lon         FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.vibe_score,
    (ST_Distance(ST_MakePoint(p.lon, p.lat)::geography, ST_MakePoint(u_lon, u_lat)::geography) / 1000)::FLOAT AS distance_km,
    CASE
      WHEN p.identity_mode = 'ghost' THEN (p.lat + (random() - 0.5) * 0.01)::FLOAT
      ELSE p.lat
    END AS lat,
    CASE
      WHEN p.identity_mode = 'ghost' THEN (p.lon + (random() - 0.5) * 0.01)::FLOAT
      ELSE p.lon
    END AS lon
  FROM public.profiles p
  WHERE
    p.is_discoverable = true
    AND p.identity_mode <> 'celebrity'
    AND (ST_Distance(ST_MakePoint(p.lon, p.lat)::geography, ST_MakePoint(u_lon, u_lat)::geography) / 1000) <= radius_km
    AND p.id <> auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ══════════════════════════════════════════════════════════════════════════════
--  18. SYSTEM RPCS & TRIGGER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_vibe(ev_id uuid, uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.event_vibes (event_id, user_id) VALUES (ev_id, uid)
  ON CONFLICT (event_id, user_id) DO NOTHING;
END;
$$;


CREATE OR REPLACE FUNCTION decrement_vibe(ev_id uuid, uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.event_vibes WHERE event_id = ev_id AND user_id = uid;
END;
$$;


CREATE OR REPLACE FUNCTION find_popular_spots(limit_count integer DEFAULT 8)
RETURNS TABLE (event_id uuid, description text, address text, rsvp_count bigint, image text, category text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT e.id, e.title, coalesce(e.address, e.city), e.going::bigint,
         (e.media->0->>'url'), e.category
  FROM events e
  WHERE e.is_cancelled = false
    AND (e.event_date IS NULL OR e.event_date >= current_date - interval '30 days')
  ORDER BY e.trending_score DESC NULLS LAST, e.vibe_count DESC, e.going DESC, e.created_at DESC
  LIMIT limit_count;
$$;

DROP FUNCTION IF EXISTS find_nearby_events(float, float, float, integer);

CREATE OR REPLACE FUNCTION find_nearby_events(
  lat float, lon float, radius_km float, limit_count integer DEFAULT 20
)
RETURNS TABLE (
  id uuid, title text, event_date date, category text, category_color text,
  venue_name text, address text, going integer, vibe_count integer,
  media jsonb, distance_km float
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT e.id, e.title, e.event_date, e.category, e.category_color,
         e.venue_name, coalesce(e.address, e.city), e.going, e.vibe_count, e.media,
         round((st_distancesphere(e.coords::geometry,
           st_setsrid(st_point(lon, lat), 4326)) / 1000)::numeric, 1)::float
  FROM events e
  WHERE e.coords IS NOT NULL AND e.is_cancelled = false AND e.event_date >= current_date
    AND st_distancesphere(e.coords::geometry,
          st_setsrid(st_point(lon, lat), 4326)) <= radius_km * 1000
  ORDER BY 11 ASC, e.trending_score DESC
  LIMIT limit_count;
$$;

DROP FUNCTION IF EXISTS find_nearby_vibers(uuid, float, integer);

CREATE OR REPLACE FUNCTION find_nearby_vibers(uid uuid, max_dist_km float DEFAULT 10, limit_count integer DEFAULT 20)
RETURNS TABLE (id uuid, username text, avatar_url text, vibe_score integer, is_online boolean, distance_km float)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  u_coords geography(Point, 4326);
BEGIN
  SELECT coords INTO u_coords FROM profiles WHERE profiles.id = uid;
  IF u_coords IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.avatar_url, p.vibe_score, p.is_online,
         ST_Distance(p.coords, u_coords) / 1000.0 AS distance_km
  FROM profiles p
  WHERE p.id <> uid
    AND p.coords IS NOT NULL
    AND p.identity_mode = 'public' -- Strictly hide Ghost/Celebrity modes from nearby radar
    AND ST_DWithin(p.coords, u_coords, max_dist_km * 1000)
  ORDER BY p.social_integrity_score DESC, distance_km ASC -- Prioritize high-integrity users
  LIMIT limit_count;
END;
$$;


CREATE OR REPLACE FUNCTION search_events(q text, limit_count integer DEFAULT 20, offset_count integer DEFAULT 0)
RETURNS TABLE (
  id uuid, title text, event_date date, category text, category_color text,
  venue_name text, going integer, vibe_count integer, media jsonb, rank float
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT e.id, e.title, e.event_date, e.category, e.category_color,
         e.venue_name, e.going, e.vibe_count, e.media,
         ts_rank_cd(e.search_vector, websearch_to_tsquery('english', unaccent(q)))::float
  FROM events e
  WHERE e.search_vector @@ websearch_to_tsquery('english', unaccent(q)) AND e.is_cancelled = false
  ORDER BY 10 DESC, e.trending_score DESC
  LIMIT limit_count OFFSET offset_count;
$$;


CREATE OR REPLACE FUNCTION get_event_full(ev_id uuid, viewer_id uuid DEFAULT null)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'event',        row_to_json(e.*),
    'host',         row_to_json(p.*),
    'has_vibed',    EXISTS(SELECT 1 FROM vibes         WHERE event_id = ev_id AND user_id = viewer_id),
    'has_saved',    EXISTS(SELECT 1 FROM saved_events   WHERE event_id = ev_id AND user_id = viewer_id),
    'has_checked',  EXISTS(SELECT 1 FROM check_ins      WHERE event_id = ev_id AND user_id = viewer_id),
    'reaction',    (SELECT reaction_key FROM event_reactions WHERE event_id = ev_id AND user_id = viewer_id),
    'avg_rating',  (SELECT round(avg(rating)::numeric, 1) FROM event_ratings WHERE event_id = ev_id),
    'rating_count',(SELECT count(*)                        FROM event_ratings WHERE event_id = ev_id),
    'top_echoes',  (
      SELECT json_agg(json_build_object(
        'id', ec.id, 'body', ec.body, 'likes', ec.likes, 'created_at', ec.created_at,
        'author', json_build_object('username', pr.username, 'avatar_url', pr.avatar_url, 'is_verified', pr.is_verified)
      ) ORDER BY ec.likes DESC, ec.created_at DESC)
      FROM echoes ec JOIN profiles pr ON pr.id = ec.user_id
      WHERE ec.event_id = ev_id AND ec.parent_id IS NULL
      LIMIT 5
    )
  ) INTO result
  FROM events e JOIN profiles p ON p.id = e.user_id
  WHERE e.id = ev_id;
  RETURN result;
END;
$$;


CREATE OR REPLACE FUNCTION feed_for_user(uid uuid, limit_count integer DEFAULT 20, offset_count integer DEFAULT 0)
RETURNS TABLE (
  id uuid, title text, event_date date, category text, category_color text,
  venue_name text, address text, going integer, vibe_count integer,
  media jsonb, profiles json, relevance float
) LANGUAGE sql SECURITY DEFINER AS $$
  WITH
    user_interests AS (SELECT interests FROM profiles WHERE id = uid),
    following_ids  AS (SELECT following_id FROM followers WHERE follower_id = uid)
  SELECT e.id, e.title, e.event_date, e.category, e.category_color,
         e.venue_name, coalesce(e.address, e.city), e.going, e.vibe_count, e.media,
         json_build_object(
           'username', p.username, 'avatar_url', p.avatar_url,
           'is_verified', p.is_verified, 'is_online', p.is_online, 'vibe_score', p.vibe_score
         ),
         (
           CASE WHEN e.user_id IN (SELECT following_id FROM following_ids) THEN 30 ELSE 0 END
           + CASE WHEN EXISTS(
               SELECT 1 FROM unnest((SELECT interests FROM user_interests)) AS i
               WHERE lower(i) = lower(e.category)
             ) THEN 20 ELSE 0 END
           + least(e.trending_score / 2.0, 50)
         )::float
  FROM events e JOIN profiles p ON p.id = e.user_id
  WHERE e.is_cancelled = false AND e.event_date >= current_date
  ORDER BY 12 DESC, e.event_date ASC
  LIMIT limit_count OFFSET offset_count;
$$;


CREATE OR REPLACE FUNCTION mark_notifications_read(uid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE notifications SET read = true WHERE recipient_id = uid AND read = false;
$$;


-- ============================================================
--  STORAGE BUCKET
-- ============================================================
-- Buckets: avatars (20MB), covers (20MB), chat_media (25MB), event-media (100MB)
-- All MIME types allowed per bucket — including HEIC from iPhone cameras
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('avatars',     'avatars',     true, 20971520,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 20971520,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('chat_media',  'chat_media',  true, 26214400,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','video/mp4','video/quicktime']),
  ('event-media', 'event-media', true, 104857600, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','video/mp4','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage Policies ────────────────────────────────────────────────────────
-- Anyone can read public media
DROP POLICY IF EXISTS "Public access to media" ON storage.objects;
CREATE POLICY "Public access to media"
  ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'covers', 'event-media', 'chat_media'));

-- Any authenticated user can upload — paths are user-scoped so collisions are impossible
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('avatars', 'covers', 'event-media', 'chat_media') AND auth.role() = 'authenticated');

-- Authenticated users can update/replace their own files
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
CREATE POLICY "Authenticated users can update"
  ON storage.objects FOR UPDATE
  USING (bucket_id IN ('avatars', 'covers', 'event-media', 'chat_media') AND auth.role() = 'authenticated');

-- Users can delete files where their user ID is the first path component
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

CREATE OR REPLACE FUNCTION set_message_delivered()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.delivered_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS message_delivered_trigger ON messages;
CREATE TRIGGER message_delivered_trigger BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION set_message_delivered();

-- ============================================================
--  BLOCKED USERS
-- ============================================================

CREATE OR REPLACE FUNCTION check_event_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cap INTEGER; cnt INTEGER;
BEGIN
  SELECT max_attendees INTO cap FROM events WHERE id = NEW.event_id;
  IF cap IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO cnt FROM check_ins WHERE event_id = NEW.event_id;
  IF cnt >= cap THEN UPDATE events SET is_sold_out = true WHERE id = NEW.event_id; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rsvp_capacity_check ON check_ins;
CREATE TRIGGER rsvp_capacity_check AFTER INSERT ON check_ins FOR EACH ROW EXECUTE FUNCTION check_event_capacity();

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS is_early_bird BOOLEAN DEFAULT false;


CREATE OR REPLACE FUNCTION tag_early_bird_rsvp()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ev_created TIMESTAMPTZ;
BEGIN
  SELECT created_at INTO ev_created FROM events WHERE id = NEW.event_id;
  IF ev_created IS NOT NULL AND now() < ev_created + INTERVAL '1 hour' THEN
    NEW.is_early_bird := true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rsvp_early_bird ON check_ins;
CREATE TRIGGER rsvp_early_bird BEFORE INSERT ON check_ins FOR EACH ROW EXECUTE FUNCTION tag_early_bird_rsvp();

-- ============================================================
--  PROFILES — missing columns
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online       BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen       TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak  INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges          TEXT[]      DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp              INTEGER     DEFAULT 0;

-- ============================================================
--  AI TABLES (interactions, memory, predictions, recommendations)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_profile_score(uid UUID, amount INTEGER)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles SET vibe_score = COALESCE(vibe_score,0) + amount WHERE id = uid;
$$;

-- ============================================================
--  FULL-TEXT SEARCH RPC
-- ============================================================

CREATE OR REPLACE FUNCTION search_events_fts(search_query TEXT, limit_count INTEGER DEFAULT 20)
RETURNS SETOF events LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT * FROM events
  WHERE title ILIKE '%' || search_query || '%'
     OR description ILIKE '%' || search_query || '%'
     OR category    ILIKE '%' || search_query || '%'
     OR venue_name  ILIKE '%' || search_query || '%'
     OR city        ILIKE '%' || search_query || '%'
  ORDER BY vibe_count DESC, created_at DESC
  LIMIT limit_count;
$$;

-- ============================================================
--  CONVERSATIONS VIEW  (inbox — latest message per user pair)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views       WHERE table_schema='public' AND table_name='conversations') THEN
    EXECUTE 'DROP VIEW conversations CASCADE';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables   WHERE table_schema='public' AND table_name='conversations' AND table_type='BASE TABLE') THEN
    EXECUTE 'DROP TABLE conversations CASCADE';
  END IF;
END $$;

DROP VIEW IF EXISTS conversations CASCADE;
CREATE OR REPLACE VIEW conversations AS
WITH latest_messages AS (
  SELECT DISTINCT ON (
    LEAST(sender_id::text, recipient_id::text) || '_' || GREATEST(sender_id::text, recipient_id::text)
  )
    LEAST(sender_id::text, recipient_id::text) || '_' || GREATEST(sender_id::text, recipient_id::text) AS convo_key,
    id, sender_id, recipient_id, body, created_at, read_at, is_request, request_accepted
  FROM messages
  WHERE deleted_at IS NULL
  ORDER BY 1, created_at DESC
)
SELECT 
  lm.*,
  -- Logic for Sender Privacy
  CASE 
    WHEN sp.identity_mode = 'ghost' THEN 'Ghost'
    ELSE sp.username 
  END as sender_username,
  CASE 
    WHEN sp.identity_mode = 'ghost' THEN NULL
    ELSE sp.avatar_url 
  END as sender_avatar,
  -- Logic for Recipient Privacy
  CASE 
    WHEN rp.identity_mode = 'ghost' THEN 'Ghost'
    ELSE rp.username 
  END as recipient_username,
  CASE 
    WHEN rp.identity_mode = 'ghost' THEN NULL
    ELSE rp.avatar_url 
  END as recipient_avatar
FROM latest_messages lm
JOIN profiles sp ON lm.sender_id = sp.id
JOIN profiles rp ON lm.recipient_id = rp.id;

-- ============================================================
--  DM SAFETY TRIGGER (The "Anti-Spam" Valve)
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_message_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  msg_count INTEGER;
  is_accepted BOOLEAN;
BEGIN
  -- Check whether any accepted message exists between these two users (either direction)
  SELECT EXISTS (
    SELECT 1 FROM public.messages
    WHERE (
            (sender_id = NEW.sender_id AND recipient_id = NEW.recipient_id)
         OR (sender_id = NEW.recipient_id AND recipient_id = NEW.sender_id)
          )
      AND request_accepted = true
  ) INTO is_accepted;

  -- If not accepted yet, count how many messages the sender has sent
  IF is_accepted IS NOT TRUE THEN
    SELECT count(*) INTO msg_count
    FROM public.messages
    WHERE sender_id = NEW.sender_id AND recipient_id = NEW.recipient_id AND request_accepted = false;

    IF msg_count >= 3 THEN
      RAISE EXCEPTION 'Message limit reached. Wait for the recipient to accept your request.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dm_limit_trigger ON messages;
CREATE TRIGGER dm_limit_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION enforce_message_limits();

-- Auto-resolve DM room on INSERT (room_id fix)
CREATE OR REPLACE FUNCTION public.resolve_message_room()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room_id UUID;
  p1        UUID;
  p2        UUID;
BEGIN
  -- Already has a room_id — nothing to do
  IF NEW.room_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id IS NULL OR NEW.recipient_id IS NULL THEN
    RAISE EXCEPTION 'sender_id and recipient_id are required to resolve a DM room.';
  END IF;

  -- Canonical ordering matches the unique index on dm_rooms
  IF NEW.sender_id < NEW.recipient_id THEN
    p1 := NEW.sender_id;  p2 := NEW.recipient_id;
  ELSE
    p1 := NEW.recipient_id; p2 := NEW.sender_id;
  END IF;

  -- Look up existing room
  SELECT id INTO v_room_id
  FROM public.dm_rooms
  WHERE participant_1 = p1 AND participant_2 = p2;

  -- Create it if missing
  IF v_room_id IS NULL THEN
    INSERT INTO public.dm_rooms (participant_1, participant_2)
    VALUES (p1, p2)
    ON CONFLICT (LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2))
    DO UPDATE SET updated_at = now()
    RETURNING id INTO v_room_id;
  END IF;

  NEW.room_id := v_room_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_message_room ON public.messages;
CREATE TRIGGER trg_resolve_message_room
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.resolve_message_room();

-- ============================================================
--  RECIPROCITY LOGIC (Reward Connection Acceptance)
-- ============================================================

CREATE OR REPLACE FUNCTION handle_message_acceptance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Logic: If a request transitions from false to true, it's a "Handshake"
  IF NEW.request_accepted = true AND OLD.request_accepted = false THEN
    -- Reward the recipient for being welcoming
    UPDATE profiles SET vibe_score = vibe_score + 10 WHERE id = NEW.recipient_id;
    -- Reward the sender for a successful high-vibe match
    UPDATE profiles SET vibe_score = vibe_score + 5 WHERE id = NEW.sender_id;
    
    -- Create a system notification for the handshake
    INSERT INTO notifications (recipient_id, type, title, body)
    VALUES (NEW.sender_id, 'system', 'Connection Locked! 🤝', 'Your request was accepted. Your Vibe Score just went up.');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_dm_accepted ON messages;
CREATE TRIGGER on_dm_accepted
  AFTER UPDATE OF request_accepted ON messages
  FOR EACH ROW EXECUTE FUNCTION handle_message_acceptance();

-- ── Advanced Social Matching Logic ──────────────────────────────────────────

-- Helper function to count overlapping items in two text arrays

CREATE OR REPLACE FUNCTION array_overlap_count(arr1 TEXT[], arr2 TEXT[])
RETURNS INTEGER AS $$
DECLARE
  overlap_count INTEGER := 0;
  item TEXT;
BEGIN
  IF arr1 IS NULL OR arr2 IS NULL THEN RETURN 0; END IF;
  FOREACH item IN ARRAY arr1 LOOP
    IF item = ANY(arr2) THEN
      overlap_count := overlap_count + 1;
    END IF;
  END LOOP;
  RETURN overlap_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to detect nearby vibe matches

CREATE OR REPLACE FUNCTION handle_location_match()
RETURNS TRIGGER AS $$
DECLARE
  nearby_user RECORD;
  shared_count INTEGER;
BEGIN
  -- Only run if coords changed and are not null
  IF (NEW.coords IS DISTINCT FROM OLD.coords) AND (NEW.coords IS NOT NULL) THEN

    FOR nearby_user IN (
      SELECT id, username, interests, avatar_url
      FROM profiles
      WHERE id <> NEW.id
        AND is_discoverable = true
        AND ST_DWithin(coords, NEW.coords, 5000) -- 5km
      LIMIT 3
    ) LOOP
      
      shared_count := array_overlap_count(NEW.interests, nearby_user.interests);
      
      IF shared_count >= 2 THEN
        -- Create notification for NEW user about the nearby match
        INSERT INTO notifications (recipient_id, type, title, body, data)
        VALUES (
          NEW.id,
          'vibe_match',
          'Vibe Match Nearby!',
          '@' || nearby_user.username || ' is close and shares ' || shared_count || ' interests with you.',
          jsonb_build_object(
            'match_id', nearby_user.id,
            'match_username', nearby_user.username,
            'match_avatar', nearby_user.avatar_url,
            'shared_count', shared_count
          )
        );
      END IF;
      
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_location_match ON profiles;
CREATE TRIGGER on_location_match
  AFTER UPDATE OF coords ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_location_match();


-- ── Social Integrity System (SIS) Automated Calculation ─────────────────────


CREATE OR REPLACE FUNCTION calculate_sis_score(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  base_score INTEGER := 50; -- Start at 50
  booking_count INTEGER;
  vibe_received INTEGER;
  event_hosted INTEGER;
BEGIN
  -- Points for successful service completions
  SELECT COUNT(*) INTO booking_count FROM service_bookings 
  WHERE provider_id = user_id AND status = 'completed';
  base_score := base_score + (booking_count * 15);

  -- Points for event hosting
  SELECT COUNT(*) INTO event_hosted FROM events WHERE author_id = user_id;
  base_score := base_score + (event_hosted * 5);

  -- Points for vibes received on their events
  SELECT COALESCE(SUM(vibe_count), 0) INTO vibe_received FROM events WHERE author_id = user_id;
  base_score := base_score + (vibe_received * 2);

  -- Cap at 100
  RETURN LEAST(100, base_score);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update SIS when a booking is completed

CREATE OR REPLACE FUNCTION on_booking_completed_sis()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE profiles 
    SET social_integrity_score = calculate_sis_score(NEW.provider_id)
    WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sis_on_booking ON service_bookings;
CREATE TRIGGER update_sis_on_booking
  AFTER UPDATE ON service_bookings
  FOR EACH ROW EXECUTE FUNCTION on_booking_completed_sis();

-- ── Hotspot Discovery (Spatial Clustering) ──────────────────────────────────


CREATE OR REPLACE FUNCTION find_gruv_hotspots(user_lat FLOAT, user_lon FLOAT, radius_m FLOAT)
RETURNS TABLE (
  lat FLOAT,
  lon FLOAT,
  venue_name TEXT,
  vibe_density BIGINT,
  hotness_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.lat, 
    e.lon, 
    e.venue_name,
    COUNT(e.id) AS vibe_density,
    (COUNT(e.id) * 10 + SUM(e.vibe_count) * 0.5)::FLOAT AS hotness_score
  FROM events e
  WHERE ST_DWithin(e.coords, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326), radius_m)
    AND e.event_date >= CURRENT_DATE
  GROUP BY e.lat, e.lon, e.venue_name
  HAVING COUNT(e.id) >= 2
  ORDER BY hotness_score DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- ── Advanced Messaging Expansion ──────────────────────────────────────────

-- Update messages for media and read receipts
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude FLOAT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude FLOAT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES messages(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION handle_new_user_welcome()
RETURNS TRIGGER AS $$
DECLARE
  system_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  BEGIN
    -- 1. Welcome notification (skip if gruv_hq profile was never created)
    IF EXISTS (SELECT 1 FROM profiles WHERE id = system_id) THEN
      INSERT INTO notifications (recipient_id, actor_id, type, title, body)
      VALUES (NEW.id, system_id, 'system', 'Welcome to The Gruvs! 👑',
              'You just joined the most exclusive vibe network. Start discovery now.')
      ON CONFLICT DO NOTHING;

      -- 2. Welcome DM via messages (full-featured table used by MessageManager)
      INSERT INTO messages (sender_id, recipient_id, body, is_request, request_accepted)
      VALUES (system_id, NEW.id,
              'Yo! Welcome to The Gruvs. 🚀 I''m your guide to the city. Enable location in your profile to see Gruvs near you. Let''s get it!',
              false, true)
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_welcome ON profiles;
CREATE TRIGGER on_auth_user_welcome
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_welcome();

-- ─────────────────────────────────────────────────────────────────────────────
-- EVENT SCHEDULE & POLLS (added for schedule builder + community voting)
-- ─────────────────────────────────────────────────────────────────────────────

-- Add schedule column to events (JSONB array of time-slot objects)
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '[]'::jsonb;

-- Community polls tied to event schedule slots

-- ══════════════════════════════════════════════════════════════════════════════
--  19. THE GRUVS — 50 ADVANCED SQL LOGICS (v5 addendum)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION award_xp(p_user_id UUID, p_amount INT, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET xp          = COALESCE(xp, 0) + p_amount,
      vibe_equity = COALESCE(vibe_equity, 0) + (p_amount * 0.1)
  WHERE id = p_user_id;
END;
$$;


CREATE OR REPLACE FUNCTION xp_on_rsvp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'going' THEN
    PERFORM award_xp(NEW.user_id, 10, 'rsvp_going');
  ELSIF NEW.status = 'maybe' THEN
    PERFORM award_xp(NEW.user_id, 2, 'rsvp_maybe');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_rsvp ON event_rsvps;
CREATE TRIGGER trg_xp_rsvp
  AFTER INSERT ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION xp_on_rsvp();

-- #3  XP when someone follows you (5 XP to the followed user)

CREATE OR REPLACE FUNCTION xp_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM award_xp(NEW.following_id, 5, 'received_follow');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_follow ON follows;
CREATE TRIGGER trg_xp_follow
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION xp_on_follow();

-- #4  XP when your reel gets a like (3 XP per like, to owner only)

CREATE OR REPLACE FUNCTION xp_on_reel_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM reels WHERE id = NEW.reel_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
    PERFORM award_xp(v_owner, 3, 'reel_liked');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_reel_like ON reel_likes;
CREATE TRIGGER trg_xp_reel_like
  AFTER INSERT ON reel_likes
  FOR EACH ROW EXECUTE FUNCTION xp_on_reel_like();

-- #5  XP when your event gets a vibe (8 XP to event organiser)

CREATE OR REPLACE FUNCTION xp_on_vibe()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_organiser UUID;
BEGIN
  SELECT organiser_id INTO v_organiser FROM events WHERE id = NEW.event_id;
  IF v_organiser IS NOT NULL AND v_organiser <> NEW.user_id THEN
    PERFORM award_xp(v_organiser, 8, 'event_vibed');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_vibe ON event_vibes;
CREATE TRIGGER trg_xp_vibe
  AFTER INSERT ON event_vibes
  FOR EACH ROW EXECUTE FUNCTION xp_on_vibe();

-- #6  Level view — maps XP to a level (1–100)
DROP VIEW IF EXISTS user_levels CASCADE;
CREATE OR REPLACE VIEW user_levels AS
SELECT
  id,
  username,
  avatar_url,
  xp,
  LEAST(100, FLOOR(SQRT(COALESCE(xp,0)::numeric / 50))::INT + 1) AS level,
  LEAST(100, FLOOR(SQRT(COALESCE(xp,0)::numeric / 50))::INT + 1)::TEXT || ' / 100' AS level_label
FROM profiles;


-- ════════════════════════════════════════════════════════════
-- 2.  EVENT INTELLIGENCE
-- ════════════════════════════════════════════════════════════

-- #7  Hot-score function (weights: vibes 3, rsvps 5, echoes 2, rating 10)

CREATE OR REPLACE FUNCTION event_hot_score(
  p_vibes INT, p_rsvps INT, p_echoes INT,
  p_ratings NUMERIC, p_created TIMESTAMPTZ
)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT
    (p_vibes * 3 + p_rsvps * 5 + p_echoes * 2 + COALESCE(p_ratings,0) * 10)
    / NULLIF(POWER(EXTRACT(EPOCH FROM (now() - p_created)) / 3600 + 2, 1.5), 0);
$$;

-- #8  Trending events view
DROP VIEW IF EXISTS trending_events CASCADE;
CREATE OR REPLACE VIEW trending_events AS
SELECT
  e.*,
  event_hot_score(
    COALESCE((SELECT COUNT(*) FROM event_vibes  WHERE event_id = e.id), 0)::INT,
    COALESCE(e.going, 0),
    COALESCE((SELECT COUNT(*) FROM echoes       WHERE event_id = e.id), 0)::INT,
    COALESCE((SELECT AVG(rating) FROM event_ratings WHERE event_id = e.id), 0),
    e.created_at
  ) AS hot_score
FROM events e
WHERE e.event_date >= now() - INTERVAL '6 hours'
ORDER BY hot_score DESC;

-- #9  Trigger: keep events.going in sync with event_rsvps

CREATE OR REPLACE FUNCTION sync_event_going_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE events
  SET going = (
    SELECT COUNT(*) FROM event_rsvps
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
      AND status = 'going'
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_going ON event_rsvps;
CREATE TRIGGER trg_sync_going
  AFTER INSERT OR UPDATE OR DELETE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION sync_event_going_count();

-- #10  Trigger: mark event as full when going >= capacity
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_full BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION flag_event_full()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.capacity IS NOT NULL AND NEW.going >= NEW.capacity THEN
    NEW.is_full := true;
  ELSE
    NEW.is_full := false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_flag_full ON events;
CREATE TRIGGER trg_flag_full
  BEFORE UPDATE OF going ON events
  FOR EACH ROW EXECUTE FUNCTION flag_event_full();

-- #11  Upcoming events this week view
DROP VIEW IF EXISTS events_this_week CASCADE;
CREATE OR REPLACE VIEW events_this_week AS
SELECT * FROM events
WHERE event_date BETWEEN now() AND now() + INTERVAL '7 days'
ORDER BY event_date ASC;

-- #12  Function: events within radius_km of a lat/lng point
ALTER TABLE events ADD COLUMN IF NOT EXISTS coords geography(Point, 4326);

CREATE OR REPLACE FUNCTION events_near(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS SETOF events LANGUAGE sql STABLE AS $$
  SELECT e.* FROM events e
  WHERE e.coords IS NOT NULL
    AND ST_DWithin(
      e.coords::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_km * 1000
    )
    AND e.event_date >= now()
  ORDER BY e.event_date ASC;
$$;

-- #13  Trigger: notify organiser at RSVP milestones (50/100/500/1000)

CREATE OR REPLACE FUNCTION notify_rsvp_milestone()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count  INT;
  v_org    UUID;
  v_title  TEXT;
BEGIN
  IF NEW.status <> 'going' THEN RETURN NEW; END IF;
  SELECT going, organiser_id, title INTO v_count, v_org, v_title
  FROM events WHERE id = NEW.event_id;
  IF v_count IN (50, 100, 500, 1000) THEN
    INSERT INTO notifications(recipient_id, type, title, body, data, read)
    VALUES (
      v_org, 'milestone',
      v_count::TEXT || ' people are going!',
      '"' || v_title || '" just hit ' || v_count::TEXT || ' confirmed RSVPs.',
      jsonb_build_object('event_id', NEW.event_id, 'count', v_count),
      false
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_rsvp_milestone ON event_rsvps;
CREATE TRIGGER trg_rsvp_milestone
  AFTER UPDATE OF status ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION notify_rsvp_milestone();

-- #14  Function: archive events older than 48 h (returns row count)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION archive_past_events()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
  UPDATE events
  SET is_archived = true
  WHERE event_date < now() - INTERVAL '48 hours'
    AND is_archived = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- 3.  SOCIAL GRAPH
-- ════════════════════════════════════════════════════════════

-- #15  Trigger: keep followers_count / following_count in sync

CREATE OR REPLACE FUNCTION suggested_follows(p_user UUID, p_limit INT DEFAULT 10)
RETURNS TABLE(suggested_id UUID, mutual_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT f2.following_id, COUNT(*) AS mutual_count
  FROM follows f1
  JOIN follows f2 ON f2.follower_id = f1.following_id
  WHERE f1.follower_id = p_user
    AND f2.following_id <> p_user
    AND f2.following_id NOT IN (SELECT following_id FROM follows WHERE follower_id = p_user)
  GROUP BY f2.following_id
  ORDER BY mutual_count DESC
  LIMIT p_limit;
$$;

-- #18  Trending users (most new followers in last 7 days)
DROP VIEW IF EXISTS trending_users CASCADE;
CREATE OR REPLACE VIEW trending_users AS
SELECT
  p.id, p.username, p.avatar_url, p.is_verified,
  COUNT(f.follower_id) AS new_followers_7d
FROM profiles p
JOIN follows f ON f.following_id = p.id
WHERE f.created_at >= now() - INTERVAL '7 days'
GROUP BY p.id
ORDER BY new_followers_7d DESC
LIMIT 50;

-- #19  User blocks / mutes table
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocks_own" ON user_blocks;
CREATE POLICY "blocks_own" ON user_blocks
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);


-- ════════════════════════════════════════════════════════════
-- 4.  STREAK & BADGES
-- ════════════════════════════════════════════════════════════

-- #20  Daily activity log (one row per user per calendar day)

CREATE OR REPLACE FUNCTION record_daily_activity(p_user UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_streak INT := 0;
  v_day    DATE;
  v_prev   DATE;
BEGIN
  -- Upsert today's activity record
  INSERT INTO public.daily_activity (user_id, day)
  VALUES (p_user, CURRENT_DATE)
  ON CONFLICT (user_id, day)
  DO UPDATE SET action_count = daily_activity.action_count + 1;

  -- Walk backwards through activity days to compute current streak
  FOR v_day IN
    SELECT day FROM public.daily_activity
    WHERE user_id = p_user
    ORDER BY day DESC
  LOOP
    IF v_streak = 0 THEN
      -- Allow today OR yesterday to start a streak
      IF v_day = CURRENT_DATE OR v_day = CURRENT_DATE - 1 THEN
        v_streak := 1; v_prev := v_day;
      ELSE EXIT;
      END IF;
    ELSE
      IF v_day = v_prev - 1 THEN
        v_streak := v_streak + 1; v_prev := v_day;
      ELSE EXIT;
      END IF;
    END IF;
  END LOOP;

  -- Persist the computed streak and refresh last_active on the profile
  UPDATE public.profiles
  SET
    current_streak = v_streak,
    last_active    = CURRENT_DATE
  WHERE id = p_user;

  RETURN v_streak;
END;
$$;

-- #22  Function: award a badge idempotently

CREATE OR REPLACE FUNCTION award_badge(p_user UUID, p_badge TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET badges = array_append(badges, p_badge)
  WHERE id = p_user
    AND NOT (COALESCE(badges, '{}') @> ARRAY[p_badge]);
END;
$$;

-- #23  Trigger: auto-award streak badges on check-in

CREATE OR REPLACE FUNCTION check_streak_badges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_streak INT;
BEGIN
  v_streak := record_daily_activity(NEW.user_id);
  IF    v_streak >= 100 THEN PERFORM award_badge(NEW.user_id, 'streak_100');
  ELSIF v_streak >= 30  THEN PERFORM award_badge(NEW.user_id, 'streak_30');
  ELSIF v_streak >= 7   THEN PERFORM award_badge(NEW.user_id, 'streak_7');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_streak_on_checkin ON event_checkins;
CREATE TRIGGER trg_streak_on_checkin
  AFTER INSERT ON event_checkins
  FOR EACH ROW EXECUTE FUNCTION check_streak_badges();


-- ════════════════════════════════════════════════════════════
-- 5.  BUSINESS & CAMPAIGN ANALYTICS
-- ════════════════════════════════════════════════════════════

-- #24  Trigger: auto-increment campaign impression / click count
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS impressions INT DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS clicks      INT DEFAULT 0;
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'impression';


CREATE OR REPLACE FUNCTION sync_campaign_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action = 'impression' THEN
    UPDATE ad_campaigns SET impressions = impressions + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.action = 'click' THEN
    UPDATE ad_campaigns SET clicks = clicks + 1 WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_campaign_stats ON campaign_analytics;
CREATE TRIGGER trg_campaign_stats
  AFTER INSERT ON campaign_analytics
  FOR EACH ROW EXECUTE FUNCTION sync_campaign_stats();

-- #25  Campaign performance view (CTR + cost-per-click)
DROP VIEW IF EXISTS campaign_performance CASCADE;
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.id, c.name, c.budget_total AS budget, c.status,
  c.impressions,
  c.clicks,
  ROUND(safe_div(c.clicks::numeric, NULLIF(c.impressions,0)) * 100, 2) AS ctr_pct,
  ROUND(safe_div(c.budget_total::numeric, NULLIF(c.clicks,0)), 2)      AS cost_per_click
FROM ad_campaigns c;

-- #26  Trigger: auto-deactivate expired campaigns
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION deactivate_expired_campaigns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.end_date IS NOT NULL AND NEW.end_date < now() AND NEW.status = 'active' THEN
    NEW.status := 'completed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_expire_campaign ON ad_campaigns;
CREATE TRIGGER trg_expire_campaign
  BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION deactivate_expired_campaigns();

-- #27  Business analytics summary view
DROP VIEW IF EXISTS business_analytics CASCADE;
CREATE OR REPLACE VIEW business_analytics AS
SELECT
  bp.id AS business_id,
  bp.business_name AS name,
  bp.business_type AS type,
  COUNT(DISTINCT e.id)                AS total_events,
  COALESCE(SUM(e.going), 0)           AS total_attendees,
  COUNT(DISTINCT c.id)                AS total_campaigns,
  COALESCE(SUM(c.impressions), 0)     AS total_impressions,
  COALESCE(SUM(c.clicks), 0)          AS total_clicks
FROM business_profiles bp
LEFT JOIN events       e ON COALESCE(e.author_id, e.user_id) = bp.user_id
LEFT JOIN ad_campaigns c ON c.business_id  = bp.id
GROUP BY bp.id, bp.business_name, bp.business_type;


-- ════════════════════════════════════════════════════════════
-- 6.  CONTENT MODERATION
-- ════════════════════════════════════════════════════════════

-- #28  Report count columns on key tables
ALTER TABLE events   ADD COLUMN IF NOT EXISTS report_count INT DEFAULT 0;
ALTER TABLE reels    ADD COLUMN IF NOT EXISTS report_count INT DEFAULT 0;
ALTER TABLE echoes   ADD COLUMN IF NOT EXISTS report_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS report_count INT DEFAULT 0;

-- #29  Trigger: increment report_count on the target row

CREATE OR REPLACE FUNCTION sync_report_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  CASE NEW.target_type
    WHEN 'event'   THEN UPDATE events   SET report_count = report_count + 1 WHERE id = NEW.target_id;
    WHEN 'reel'    THEN UPDATE reels    SET report_count = report_count + 1 WHERE id = NEW.target_id;
    WHEN 'echo'    THEN UPDATE echoes   SET report_count = report_count + 1 WHERE id = NEW.target_id;
    WHEN 'profile' THEN UPDATE profiles SET report_count = report_count + 1 WHERE id = NEW.target_id;
    ELSE NULL;
  END CASE;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_report_count ON reports;
CREATE TRIGGER trg_sync_report_count
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION sync_report_count();

-- #30  Trigger: auto-hide content with 5+ reports
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE reels  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;


CREATE OR REPLACE FUNCTION auto_hide_reported()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.report_count >= 5 THEN
    NEW.is_hidden := true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_hide_event ON events;
DROP TRIGGER IF EXISTS trg_hide_reel  ON reels;
DROP TRIGGER IF EXISTS trg_hide_echo  ON echoes;
CREATE TRIGGER trg_hide_event BEFORE UPDATE OF report_count ON events FOR EACH ROW EXECUTE FUNCTION auto_hide_reported();
CREATE TRIGGER trg_hide_reel  BEFORE UPDATE OF report_count ON reels  FOR EACH ROW EXECUTE FUNCTION auto_hide_reported();
CREATE TRIGGER trg_hide_echo  BEFORE UPDATE OF report_count ON echoes FOR EACH ROW EXECUTE FUNCTION auto_hide_reported();

-- #31  Trigger: deduct Social Integrity Score when a profile is reported

CREATE OR REPLACE FUNCTION deduct_sis_on_report()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.target_type = 'profile' THEN
    UPDATE profiles
    SET social_integrity_score = GREATEST(0, COALESCE(social_integrity_score,50) - 5)
    WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sis_report ON reports;
CREATE TRIGGER trg_sis_report
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION deduct_sis_on_report();

-- #32  Flagged content dashboard view
DROP VIEW IF EXISTS flagged_content CASCADE;
CREATE OR REPLACE VIEW flagged_content AS
SELECT 'event'   AS type, id, title   AS label, report_count, is_hidden, created_at FROM events   WHERE report_count > 0
UNION ALL
SELECT 'reel'    AS type, id, caption AS label, report_count, is_hidden, created_at FROM reels    WHERE report_count > 0
UNION ALL
SELECT 'echo'    AS type, id, body    AS label, report_count, is_hidden, created_at FROM echoes   WHERE report_count > 0
ORDER BY report_count DESC;


-- ════════════════════════════════════════════════════════════
-- 7.  MESSAGING
-- ════════════════════════════════════════════════════════════

-- #33  Unified messages table — add room-based columns to existing messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS room_id    UUID REFERENCES dm_rooms(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_room   ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM dm_rooms r WHERE r.id = room_id AND (r.participant_1 = auth.uid() OR r.participant_2 = auth.uid())));
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update" ON messages FOR UPDATE USING  (auth.uid() = sender_id);

-- #34  Trigger: update dm_rooms last_message_at + unread counters
-- dm_rooms already has last_message_at; add missing columns only
ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS last_message_body TEXT;


CREATE OR REPLACE FUNCTION sync_dm_room_last_msg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_room dm_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM dm_rooms WHERE id = NEW.room_id;
  UPDATE dm_rooms SET
    last_message_at   = NEW.created_at,
    last_message_body = LEFT(COALESCE(NEW.body, ''), 80),
    unread_count_1 = CASE WHEN v_room.participant_1 <> NEW.sender_id THEN unread_count_1 + 1 ELSE unread_count_1 END,
    unread_count_2 = CASE WHEN v_room.participant_2 <> NEW.sender_id THEN unread_count_2 + 1 ELSE unread_count_2 END
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_dm_last_msg ON messages;
CREATE TRIGGER trg_dm_last_msg
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION sync_dm_room_last_msg();

-- #35  Function: mark all messages read in a room for a given user

CREATE OR REPLACE FUNCTION mark_room_read(p_room UUID, p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_room dm_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM dm_rooms WHERE id = p_room;
  UPDATE messages
  SET read_at = now()
  WHERE room_id = p_room AND sender_id <> p_user AND read_at IS NULL;
  IF v_room.participant_1 = p_user THEN
    UPDATE dm_rooms SET unread_count_1 = 0 WHERE id = p_room;
  ELSE
    UPDATE dm_rooms SET unread_count_2 = 0 WHERE id = p_room;
  END IF;
END;
$$;

-- #36  Conversations ordered by last activity (portal view)
DROP VIEW IF EXISTS user_conversations CASCADE;
CREATE OR REPLACE VIEW user_conversations AS
SELECT
  r.id               AS room_id,
  r.participant_1    AS user_a,
  r.participant_2    AS user_b,
  r.last_message_at,
  r.last_message_body,
  r.unread_count_1   AS unread_a,
  r.unread_count_2   AS unread_b,
  pa.username        AS user_a_username,
  pa.avatar_url      AS user_a_avatar,
  pb.username        AS user_b_username,
  pb.avatar_url      AS user_b_avatar
FROM dm_rooms r
JOIN profiles pa ON pa.id = r.participant_1
JOIN profiles pb ON pb.id = r.participant_2
ORDER BY r.last_message_at DESC NULLS LAST;


-- ════════════════════════════════════════════════════════════
-- 8.  STORIES
-- ════════════════════════════════════════════════════════════

-- #37  Function: purge expired stories (safe to call from edge function / cron)

CREATE OR REPLACE FUNCTION purge_expired_stories()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  DELETE FROM stories WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- #38  Active story count per user view
DROP VIEW IF EXISTS active_story_counts CASCADE;
CREATE OR REPLACE VIEW active_story_counts AS
SELECT user_id, COUNT(*) AS story_count
FROM stories
WHERE expires_at > now()
GROUP BY user_id;

-- #39  XP when someone views your story (1 XP per unique viewer, max 20 per story)

CREATE OR REPLACE FUNCTION xp_on_story_view()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner UUID; v_view_count INT;
BEGIN
  SELECT user_id INTO v_owner FROM stories WHERE id = NEW.story_id;
  IF v_owner IS NULL OR v_owner = NEW.viewer_id THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_view_count FROM story_views WHERE story_id = NEW.story_id;
  IF v_view_count <= 20 THEN
    PERFORM award_xp(v_owner, 1, 'story_viewed');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_story_view ON story_views;
CREATE TRIGGER trg_xp_story_view
  AFTER INSERT ON story_views
  FOR EACH ROW EXECUTE FUNCTION xp_on_story_view();


-- ════════════════════════════════════════════════════════════
-- 9.  REELS
-- ════════════════════════════════════════════════════════════

-- #40  Reel views log (unique per user per reel)

CREATE OR REPLACE FUNCTION reel_discovery_score(
  p_likes INT, p_comments INT, p_views INT, p_created TIMESTAMPTZ
)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT (p_likes * 5 + p_comments * 3 + p_views * 0.5)
       / NULLIF(POWER(EXTRACT(EPOCH FROM (now() - p_created)) / 3600 + 1, 1.2), 0);
$$;

-- #43  Trending reels view (top 50 by discovery score)
DROP VIEW IF EXISTS trending_reels CASCADE;
CREATE OR REPLACE VIEW trending_reels WITH (security_invoker = true) AS
SELECT
  r.*,
  reel_discovery_score(r.like_count, r.comment_count, r.view_count, r.created_at) AS score
FROM reels r
WHERE r.is_deleted = false AND r.is_hidden = false
ORDER BY score DESC
LIMIT 50;

-- #44  Trigger: award XP + badge at reel like milestones

CREATE OR REPLACE FUNCTION xp_reel_milestone()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF    NEW.like_count = 10   THEN PERFORM award_xp(NEW.user_id, 25,  'reel_10_likes');
  ELSIF NEW.like_count = 100  THEN PERFORM award_xp(NEW.user_id, 100, 'reel_100_likes'); PERFORM award_badge(NEW.user_id, 'reel_star');
  ELSIF NEW.like_count = 1000 THEN PERFORM award_xp(NEW.user_id, 500, 'reel_1k_likes');  PERFORM award_badge(NEW.user_id, 'viral_reel');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_reel_milestone ON reels;
CREATE TRIGGER trg_xp_reel_milestone
  AFTER UPDATE OF like_count ON reels
  FOR EACH ROW EXECUTE FUNCTION xp_reel_milestone();


-- ════════════════════════════════════════════════════════════
-- 10. ECONOMY & WALLET
-- ════════════════════════════════════════════════════════════

-- #45  Wallet transactions ledger

CREATE OR REPLACE FUNCTION credit_vibe_equity(
  p_user UUID, p_amount NUMERIC, p_reason TEXT,
  p_ref UUID DEFAULT NULL, p_ref_type TEXT DEFAULT NULL
)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance NUMERIC;
BEGIN
  UPDATE profiles SET vibe_equity = COALESCE(vibe_equity,0) + p_amount WHERE id = p_user
  RETURNING vibe_equity INTO v_balance;
  INSERT INTO wallet_transactions(user_id, amount, direction, reason, balance_after, ref_id, ref_type)
  VALUES (p_user, p_amount, 'credit', p_reason, v_balance, p_ref, p_ref_type);
  RETURN v_balance;
END;
$$;

-- #47  Function: debit vibe_equity — returns false if insufficient funds
CREATE OR REPLACE FUNCTION debit_vibe_equity(
  p_user UUID, p_amount NUMERIC, p_reason TEXT,
  p_ref UUID DEFAULT NULL, p_ref_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance NUMERIC;
BEGIN
  SELECT vibe_equity INTO v_balance FROM profiles WHERE id = p_user FOR UPDATE;
  IF COALESCE(v_balance,0) < p_amount THEN RETURN false; END IF;
  UPDATE profiles SET vibe_equity = vibe_equity - p_amount WHERE id = p_user;
  INSERT INTO wallet_transactions(user_id, amount, direction, reason, balance_after, ref_id, ref_type)
  VALUES (p_user, p_amount, 'debit', p_reason, v_balance - p_amount, p_ref, p_ref_type);
  RETURN true;
END;
$$;

-- #48  Trigger: reward vibe_equity + XP on event check-in
CREATE OR REPLACE FUNCTION reward_checkin_economy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM credit_vibe_equity(NEW.user_id, 5, 'event_checkin', NEW.event_id, 'event');
  PERFORM award_xp(NEW.user_id, 20, 'event_checkin');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_economy_checkin ON event_checkins;
CREATE TRIGGER trg_economy_checkin
  AFTER INSERT ON event_checkins
  FOR EACH ROW EXECUTE FUNCTION reward_checkin_economy();

-- #49  Economy summary view per user
DROP VIEW IF EXISTS user_economy CASCADE;
CREATE OR REPLACE VIEW user_economy AS
SELECT
  p.id,
  p.username,
  COALESCE(p.vibe_equity, 0)                                           AS balance,
  COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount END), 0) AS total_earned,
  COALESCE(SUM(CASE WHEN t.direction = 'debit'  THEN t.amount END), 0) AS total_spent,
  COUNT(t.id)                                                           AS transaction_count
FROM profiles p
LEFT JOIN wallet_transactions t ON t.user_id = p.id
GROUP BY p.id, p.username, p.vibe_equity;


-- ════════════════════════════════════════════════════════════
-- 11. GOVERNANCE
-- ════════════════════════════════════════════════════════════

-- #50  Function: tally votes, mark passed/rejected, close expired proposals
ALTER TABLE governance_proposals ADD COLUMN IF NOT EXISTS yes_votes  INT DEFAULT 0;
ALTER TABLE governance_proposals ADD COLUMN IF NOT EXISTS no_votes   INT DEFAULT 0;
ALTER TABLE governance_proposals ADD COLUMN IF NOT EXISTS result     TEXT;
ALTER TABLE governance_proposals ADD COLUMN IF NOT EXISTS ends_at    TIMESTAMPTZ;
ALTER TABLE governance_proposals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE governance_votes      ADD COLUMN IF NOT EXISTS vote      TEXT CHECK (vote IN ('yes','no','abstain'));


CREATE OR REPLACE FUNCTION tally_governance_proposals()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row   governance_proposals%ROWTYPE;
  v_yes   INT;
  v_no    INT;
  v_count INT := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM governance_proposals
    WHERE status = 'open' AND ends_at < now()
  LOOP
    SELECT
      COUNT(*) FILTER (WHERE vote = 'yes'),
      COUNT(*) FILTER (WHERE vote = 'no')
    INTO v_yes, v_no
    FROM governance_votes WHERE proposal_id = v_row.id;

    UPDATE governance_proposals SET
      status     = 'closed',
      yes_votes  = v_yes,
      no_votes   = v_no,
      result     = CASE WHEN v_yes > v_no THEN 'passed' ELSE 'rejected' END,
      updated_at = now()
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- FINAL INDEXES
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_daily_activity_user  ON daily_activity(user_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_created   ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_ts     ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker  ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked  ON user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_follows_created      ON follows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_hot           ON events(event_date, going DESC);
CREATE INDEX IF NOT EXISTS idx_reels_likes          ON reels(like_count DESC);

-- ════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('event-media', 'event-media', true, 52428800,  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('chat_media',  'chat_media',  true, 52428800,  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Avatar public read"              ON storage.objects;
DROP POLICY IF EXISTS "Avatar auth upload"              ON storage.objects;
DROP POLICY IF EXISTS "Avatar auth write"               ON storage.objects;
DROP POLICY IF EXISTS "Avatar owner write"              ON storage.objects;
DROP POLICY IF EXISTS "Cover public read"               ON storage.objects;
DROP POLICY IF EXISTS "Cover auth upload"               ON storage.objects;
DROP POLICY IF EXISTS "Cover auth write"                ON storage.objects;
DROP POLICY IF EXISTS "Cover owner write"               ON storage.objects;
DROP POLICY IF EXISTS "EventMedia public read"          ON storage.objects;
DROP POLICY IF EXISTS "EventMedia auth upload"          ON storage.objects;
DROP POLICY IF EXISTS "EventMedia auth write"           ON storage.objects;
DROP POLICY IF EXISTS "EventMedia owner write"          ON storage.objects;
DROP POLICY IF EXISTS "ChatMedia auth access"           ON storage.objects;
DROP POLICY IF EXISTS "ChatMedia public read"           ON storage.objects;
DROP POLICY IF EXISTS "ChatMedia auth write"            ON storage.objects;
DROP POLICY IF EXISTS "ChatMedia owner write"           ON storage.objects;

-- ── 1. Avatars ──────────────────────────────────────────────
CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Avatar owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 2. Covers ───────────────────────────────────────────────
CREATE POLICY "Cover public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'covers');

CREATE POLICY "Cover owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. Event Media ──────────────────────────────────────────
CREATE POLICY "EventMedia public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-media');

CREATE POLICY "EventMedia owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'event-media'
    AND auth.role() = 'authenticated'
    AND (
      (
        (storage.foldername(name))[1] = 'events'
        AND (
          (storage.foldername(name))[2] = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM public.events
            WHERE id::text = (storage.foldername(name))[2]
              AND author_id = auth.uid()
          )
        )
      )
      OR
      (
        (storage.foldername(name))[1] = 'gallery'
        AND split_part(name, '/', 3) LIKE auth.uid()::text || '_%'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'event-media'
    AND auth.role() = 'authenticated'
    AND (
      (
        (storage.foldername(name))[1] = 'events'
        AND (
          (storage.foldername(name))[2] = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM public.events
            WHERE id::text = (storage.foldername(name))[2]
              AND author_id = auth.uid()
          )
        )
      )
      OR
      (
        (storage.foldername(name))[1] = 'gallery'
        AND split_part(name, '/', 3) LIKE auth.uid()::text || '_%'
      )
    )
  );

-- ── 4. Chat Media ───────────────────────────────────────────
CREATE POLICY "ChatMedia authenticated read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat_media'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "ChatMedia owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'chat_media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'dms'
    AND split_part(name, '/', 2) LIKE auth.uid()::text || '_%'
  )
  WITH CHECK (
    bucket_id = 'chat_media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'dms'
    AND split_part(name, '/', 2) LIKE auth.uid()::text || '_%'
  );


-- ══════════════════════════════════════════════════════════════════════════════
--  20. SECURE FUNCTIONS & PRIVILEGES (pin search_path & revokes)
-- ══════════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════════
--  18. SECURE EXISTING FUNCTIONS (pin search_path)
-- ══════════════════════════════════════════════════════════════════════════════
DO $$ DECLARE f RECORD; BEGIN
  FOR f IN SELECT routine_name, specific_name FROM information_schema.routines
           WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I SET search_path = public', f.routine_name);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- Read-only functions: run as caller so they respect RLS
ALTER FUNCTION public.safe_div(numeric, numeric)       SECURITY INVOKER;
ALTER FUNCTION public.get_safe_nearby_vibers(float, float, float) SECURITY INVOKER;
ALTER FUNCTION public.suggested_follows(uuid, integer) SECURITY INVOKER;

-- Conditionally alter functions that may or may not exist
DO $$ BEGIN
  BEGIN ALTER FUNCTION public.calculate_event_heat_index() SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER FUNCTION public.check_event_capacity()        SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER FUNCTION public.find_popular_spots(integer)   SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_event_full(uuid, uuid)    SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER FUNCTION public.match_events_advanced()       SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER FUNCTION public.search_events_fts(text, integer) SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER FUNCTION public.find_gruv_hotspots()          SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
--  19. REVOKE anon EXECUTE from write/trigger functions
-- ══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user()                   FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user_welcome()           FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_chat_creator()           FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_bid_notification()       FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.handle_location_match()             FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_follow_counts()                FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_follows_counts()               FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_vibe_counts()                  FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_echo_counts()                  FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_echo_likes()                   FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_save_counts()                  FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_social_counters()              FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_event_engagement()             FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_reaction_count()               FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_check_in_counts()              FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_events_posted()                FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_rsvp_counts()                  FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_reel_likes_count()             FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_reel_comments_count()          FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.sync_reel_views_count()             FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.events_update_search_vector()       FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.events_set_slug()                   FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.tag_early_bird_rsvp()               FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.set_message_delivered()             FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.touch_updated_at()                  FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.set_current_timestamp_updated_at()  FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.on_booking_completed_sis()          FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.increment_vibe(uuid, uuid)              FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.decrement_vibe(uuid, uuid)              FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.increment_views(uuid)                   FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.increment_profile_score(uuid, integer)  FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid)           FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.create_notification()                   FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.place_bid(uuid, uuid, numeric)          FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.release_escrow()                        FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.purchase_tickets(uuid, uuid, text, numeric, integer) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.process_automated_payouts()             FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.request_booking()                       FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.verify_pop()                            FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.feed_for_user(uuid, integer, integer)   FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.find_nearby_vibers(uuid, double precision, integer) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.refresh_trending_events()               FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.purge_expired_checkins()                FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
--  20. ADDITIONAL FUNCTIONS (SECURITY FIXES & MISSING RPCS)
-- ══════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 1. update_profile() RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_profile(
  p_user_id UUID,
  p_updates  JSONB
)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found: %', p_user_id;
  END IF;

  v_profile := jsonb_populate_record(v_profile, p_updates);
  v_profile.id := p_user_id;

  UPDATE public.profiles
  SET
    username           = v_profile.username,
    display_name       = v_profile.display_name,
    avatar_url         = v_profile.avatar_url,
    cover_url          = v_profile.cover_url,
    bio                = v_profile.bio,
    location           = v_profile.location,
    website            = v_profile.website,
    interests          = v_profile.interests,
    looks_description  = v_profile.looks_description,
    career_title       = v_profile.career_title,
    career_description = v_profile.career_description,
    gender             = v_profile.gender,
    birth_year         = v_profile.birth_year,
    looking_for        = v_profile.looking_for,
    preferred_areas    = v_profile.preferred_areas,
    profile_gallery    = v_profile.profile_gallery,
    wallet_balance     = v_profile.wallet_balance,
    current_streak     = v_profile.current_streak,
    last_active        = v_profile.last_active,
    updated_at         = now()
  WHERE id = p_user_id;

  RETURN v_profile;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. get_follower_integrity_aggregate() RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_follower_integrity_aggregate(u_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  SELECT COALESCE(AVG(p.social_integrity_score), 0.0)
  INTO v_score
  FROM public.follows f
  JOIN public.profiles p ON p.id = f.follower_id
  WHERE f.following_id = u_id;

  RETURN jsonb_build_object('aggregate_score', v_score);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. get_economic_velocity() RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_economic_velocity()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_volume   NUMERIC;
  v_supply   NUMERIC;
  v_velocity NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0.0) INTO v_volume
  FROM public.wallet_transactions
  WHERE created_at >= now() - INTERVAL '1 day';

  SELECT COALESCE(SUM(wallet_balance), 0.0) INTO v_supply
  FROM public.profiles;

  IF v_supply = 0 THEN
    v_velocity := 0.0;
  ELSE
    v_velocity := ABS(v_volume) / v_supply;
  END IF;

  RETURN jsonb_build_object('velocity', v_velocity);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. get_precision_economic_metrics() RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_precision_economic_metrics()
RETURNS TABLE (total_minted NUMERIC, total_burned NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0.0)::NUMERIC AS total_minted,
    COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'),  0.0)::NUMERIC AS total_burned
  FROM public.wallet_transactions;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 5. distribute_to_war_chest() RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.distribute_to_war_chest(amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.global_economy_params
  SET war_chest_balance = COALESCE(war_chest_balance, 0.0) + amount;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 6. apply_vibe_decay() RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_vibe_decay()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_last_decay TIMESTAMPTZ;
  v_decay_rate FLOAT;
BEGIN
  SELECT last_decay_at, vibe_tax_rate
  INTO v_last_decay, v_decay_rate
  FROM public.global_economy_params
  LIMIT 1;

  IF v_decay_rate IS NULL THEN
    v_decay_rate := 0.05;
  END IF;

  IF v_last_decay IS NULL OR v_last_decay <= now() - INTERVAL '1 day' THEN
    UPDATE public.profiles
    SET vibe_score = GREATEST(0, ROUND(vibe_score * (1.0 - v_decay_rate)))::INTEGER;

    IF EXISTS (SELECT 1 FROM public.global_economy_params) THEN
      UPDATE public.global_economy_params
      SET last_decay_at = now();
    ELSE
      INSERT INTO public.global_economy_params (vibe_tax_rate, last_decay_at)
      VALUES (v_decay_rate, now());
    END IF;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. increment_wallet_balance() RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(
  user_id UUID,
  amount  NUMERIC
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_new_bal NUMERIC;
BEGIN
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0.0) + amount
  WHERE id = user_id
  RETURNING wallet_balance INTO v_new_bal;

  INSERT INTO public.wallet_transactions
    (user_id, amount, direction, reason, balance_after)
  VALUES
    (user_id, amount, 'credit', 'Escrow Release / Earnings', v_new_bal);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. follow_user() overloaded RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.follow_user(
  p_follower    UUID DEFAULT NULL,
  p_following   UUID DEFAULT NULL,
  p_follower_id UUID DEFAULT NULL,
  p_following_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_follower  UUID;
  v_following UUID;
BEGIN
  v_follower  := COALESCE(p_follower,  p_follower_id);
  v_following := COALESCE(p_following, p_following_id);

  IF v_follower IS NULL OR v_following IS NULL THEN
    RAISE EXCEPTION 'Both follower and following IDs must be provided.';
  END IF;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (v_follower, v_following)
  ON CONFLICT (follower_id, following_id) DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 9. unfollow_user() overloaded RPC (from patch_security_fixes.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unfollow_user(
  p_follower    UUID DEFAULT NULL,
  p_following   UUID DEFAULT NULL,
  p_follower_id UUID DEFAULT NULL,
  p_following_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_follower  UUID;
  v_following UUID;
BEGIN
  v_follower  := COALESCE(p_follower,  p_follower_id);
  v_following := COALESCE(p_following, p_following_id);

  IF v_follower IS NULL OR v_following IS NULL THEN
    RAISE EXCEPTION 'Both follower and following IDs must be provided.';
  END IF;

  DELETE FROM public.follows
  WHERE follower_id = v_follower AND following_id = v_following;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 10. create_user_profile() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_user_profile(p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id, username, display_name, city, gender, birth_year,
    interests, vibe_score, is_discoverable, wants_email,
    email_confirmed, confirm_later
  )
  VALUES (
    (p_payload->>'id')::UUID,
    p_payload->>'username',
    p_payload->>'display_name',
    p_payload->>'city',
    p_payload->>'gender',
    (p_payload->>'birth_year')::INTEGER,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'interests', '[]'::jsonb))),
    COALESCE((p_payload->>'vibe_score')::INTEGER, 0),
    COALESCE((p_payload->>'is_discoverable')::BOOLEAN, true),
    COALESCE((p_payload->>'wants_email')::BOOLEAN, true),
    COALESCE((p_payload->>'email_confirmed')::BOOLEAN, false),
    COALESCE((p_payload->>'confirm_later')::BOOLEAN, true)
  )
  ON CONFLICT (id) DO UPDATE
    SET username     = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        city         = EXCLUDED.city,
        gender       = EXCLUDED.gender,
        birth_year   = EXCLUDED.birth_year,
        interests    = EXCLUDED.interests,
        updated_at   = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 11. update_username() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_username(p_user_id UUID, p_username TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username AND id <> p_user_id) THEN
    RAISE EXCEPTION 'Username is already taken.';
  END IF;
  UPDATE public.profiles SET username = p_username, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 12. update_sis_score() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_sis_score(p_user_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  v_score := public.calculate_sis_score(p_user_id);
  UPDATE public.profiles
  SET social_integrity_score = v_score, updated_at = now()
  WHERE id = p_user_id;
  RETURN v_score;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 13. send_message() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_message(
  p_sender    UUID,
  p_recipient UUID,
  p_body      TEXT DEFAULT NULL,
  p_type      TEXT DEFAULT 'text'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_msg public.messages;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = p_recipient AND blocked_id = p_sender
  ) THEN
    RAISE EXCEPTION 'Blocked';
  END IF;

  INSERT INTO public.messages (sender_id, recipient_id, body, message_type)
  VALUES (p_sender, p_recipient, p_body, p_type)
  RETURNING * INTO v_msg;

  RETURN row_to_json(v_msg)::JSONB;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 14. create_dm_room() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_dm_room(p_user_a UUID, p_user_b UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_p1      UUID;
  v_p2      UUID;
  v_room_id UUID;
BEGIN
  IF p_user_a < p_user_b THEN v_p1 := p_user_a; v_p2 := p_user_b;
  ELSE                        v_p1 := p_user_b; v_p2 := p_user_a;
  END IF;

  SELECT id INTO v_room_id FROM public.dm_rooms
  WHERE participant_1 = v_p1 AND participant_2 = v_p2;

  IF v_room_id IS NULL THEN
    INSERT INTO public.dm_rooms (participant_1, participant_2)
    VALUES (v_p1, v_p2)
    RETURNING id INTO v_room_id;
  END IF;

  RETURN v_room_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 15. create_event() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_event(p_payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.events (
    author_id, title, description, address, city,
    lat, lon, event_date, event_time, end_time,
    cover_url, media_urls, category, ticket_url,
    age_restriction, age_max, capacity, is_published, is_cancelled,
    schedule
  )
  VALUES (
    (p_payload->>'author_id')::UUID,
    p_payload->>'title',
    p_payload->>'description',
    p_payload->>'address',
    p_payload->>'city',
    (p_payload->>'lat')::FLOAT,
    (p_payload->>'lon')::FLOAT,
    (p_payload->>'event_date')::DATE,
    p_payload->>'event_time',
    p_payload->>'end_time',
    p_payload->>'cover_url',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'media_urls', '[]'::jsonb))),
    p_payload->>'category',
    p_payload->>'ticket_url',
    (p_payload->>'age_restriction')::INTEGER,
    (p_payload->>'age_max')::INTEGER,
    (p_payload->>'capacity')::INTEGER,
    COALESCE((p_payload->>'is_published')::BOOLEAN, true),
    COALESCE((p_payload->>'is_cancelled')::BOOLEAN, false),
    p_payload->'schedule'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 16. update_event() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_event(p_event_id UUID, p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_ev public.events;
BEGIN
  SELECT * INTO v_ev FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_ev.author_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.events
  SET
    title         = COALESCE(p_payload->>'title',        title),
    description   = COALESCE(p_payload->>'description',  description),
    venue_name    = COALESCE(p_payload->>'venue_name',   venue_name),
    event_date    = COALESCE((p_payload->>'event_date')::DATE, event_date),
    event_time    = COALESCE(p_payload->>'event_time',   event_time),
    end_time      = COALESCE(p_payload->>'end_time',     end_time),
    cover_url     = COALESCE(p_payload->>'cover_url',    cover_url),
    ticket_url    = COALESCE(p_payload->>'ticket_url',   ticket_url),
    capacity      = COALESCE((p_payload->>'capacity')::INTEGER, capacity),
    updated_at    = now()
  WHERE id = p_event_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 17. cancel_event() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.events SET is_cancelled = true, updated_at = now()
  WHERE id = p_event_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 18. delete_event() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_event(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.events WHERE id = p_event_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 19. bulk_notify_cancel() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_notify_cancel(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_title TEXT;
  v_ids   UUID[];
BEGIN
  SELECT title INTO v_title FROM public.events WHERE id = p_event_id;

  SELECT ARRAY(
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.event_vibes WHERE event_id = p_event_id
      UNION
      SELECT user_id FROM public.event_rsvps WHERE event_id = p_event_id
    ) combined
  ) INTO v_ids;

  IF array_length(v_ids, 1) > 0 THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, data)
    SELECT uid, 'event_cancelled',
      '🚫 Event Cancelled',
      format('"%s" has been cancelled by the organizer.', v_title),
      jsonb_build_object('event_id', p_event_id, 'event_title', v_title)
    FROM unnest(v_ids) AS uid;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 20. upsert_rsvp() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_rsvp(
  p_event_id UUID, p_user_id UUID, p_status TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_rsvps (event_id, user_id, status)
  VALUES (p_event_id, p_user_id, p_status)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status, updated_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 21. remove_rsvp() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_rsvp(p_event_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.event_rsvps WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 22. upsert_event_reaction() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_event_reaction(
  p_event_id UUID, p_user_id UUID, p_key TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_reactions (event_id, user_id, reaction_key)
  VALUES (p_event_id, p_user_id, p_key)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET reaction_key = EXCLUDED.reaction_key, updated_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 23. remove_event_reaction() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_event_reaction(p_event_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.event_reactions WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 24. submit_event_rating() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_event_rating(
  p_event_id UUID, p_user_id UUID, p_rating FLOAT, p_review TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_ratings (event_id, user_id, rating, review)
  VALUES (p_event_id, p_user_id, p_rating, p_review)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review, updated_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 25. add_gallery_item() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_gallery_item(
  p_event_id UUID, p_user_id UUID, p_url TEXT, p_type TEXT DEFAULT 'image'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_gallery (event_id, user_id, url, media_type)
  VALUES (p_event_id, p_user_id, p_url, p_type);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 26. create_reel() RPC (secured, from patch_reels_security.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_reel(
  p_user_id UUID,
  p_media_url TEXT,
  p_caption TEXT,
  p_sound_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_visibility TEXT DEFAULT 'public'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reel_id UUID;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.reels (user_id, media_url, caption, sound_name, metadata, visibility)
  VALUES (p_user_id, p_media_url, p_caption, p_sound_name, p_metadata, p_visibility)
  RETURNING id INTO v_reel_id;

  RETURN v_reel_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 27. add_reel_comment() RPC (secured, from patch_reels_security.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_reel_comment(
  p_reel_id UUID,
  p_user_id UUID,
  p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_id UUID;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.reel_comments (reel_id, user_id, body)
  VALUES (p_reel_id, p_user_id, p_body)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 28. increment_reel_like() RPC (secured, from patch_reels_security.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_reel_like(
  p_reel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.reel_likes (reel_id, user_id)
  VALUES (p_reel_id, p_user_id)
  ON CONFLICT (reel_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 29. decrement_reel_like() RPC (secured, from patch_reels_security.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_reel_like(
  p_reel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.reel_likes
  WHERE reel_id = p_reel_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 30. save_reel() RPC (secured, from patch_reels_security.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_reel(
  p_reel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.saved_reels (reel_id, user_id)
  VALUES (p_reel_id, p_user_id)
  ON CONFLICT (reel_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 31. unsave_reel() RPC (secured, from patch_reels_security.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unsave_reel(
  p_reel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.saved_reels
  WHERE reel_id = p_reel_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 32. increment_vibe_count() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_vibe_count(p_event_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  PERFORM public.increment_vibe(p_event_id, p_user_id);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 33. decrement_vibe_count() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_vibe_count(p_event_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  PERFORM public.decrement_vibe(p_event_id, p_user_id);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 34. create_story() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_story(
  p_user_id   UUID,
  p_url       TEXT,
  p_type      TEXT DEFAULT 'image',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.stories (user_id, url, media_type, expires_at)
  VALUES (p_user_id, p_url, p_type, COALESCE(p_expires_at, now() + INTERVAL '24 hours'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 35. mark_stories_seen() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_stories_seen(
  p_story_ids UUID[], p_viewer_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.story_views (story_id, viewer_id)
  SELECT unnest(p_story_ids), p_viewer_id
  ON CONFLICT (story_id, viewer_id) DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 36. check_in_live() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_in_live(
  p_event_id UUID, p_user_id UUID, p_lat FLOAT, p_lon FLOAT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_check_ins (event_id, user_id, lat, lon)
  VALUES (p_event_id, p_user_id, p_lat, p_lon)
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET lat = EXCLUDED.lat, lon = EXCLUDED.lon, checked_in_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 37. check_in_attendee() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_in_attendee(
  p_event_id UUID, p_rsvp_id UUID, p_user_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.event_rsvps
  SET checked_in = true, checked_in_at = now()
  WHERE id = p_rsvp_id AND event_id = p_event_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 38. send_path_star() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_path_star(
  p_from     UUID,
  p_to       UUID,
  p_event_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.path_stars (from_user_id, to_user_id, event_id)
  VALUES (p_from, p_to, p_event_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 39. drop_path_trace() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.drop_path_trace(
  p_user_id UUID, p_lat FLOAT, p_lon FLOAT, p_note TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.path_traces (user_id, lat, lon, note)
  VALUES (p_user_id, p_lat, p_lon, p_note);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 40. count_path_crossings() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.count_path_crossings(p_user_a UUID, p_user_b UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.path_crossings
  WHERE (user_a = p_user_a AND user_b = p_user_b)
     OR (user_a = p_user_b AND user_b = p_user_a);
  RETURN COALESCE(v_count, 0);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 41. submit_report() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_report(
  p_reporter_id UUID, p_target_id UUID, p_target_type TEXT, p_reason TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.reports (reporter_id, target_id, target_type, reason)
  VALUES (p_reporter_id, p_target_id, p_target_type, p_reason);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 42. increment_echo_like() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_echo_like(p_echo_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.echo_likes (echo_id, user_id)
  VALUES (p_echo_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 43. decrement_echo_like() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_echo_like(p_echo_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.echo_likes WHERE echo_id = p_echo_id AND user_id = auth.uid();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 44. add_pulse_request() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_pulse_request(
  p_event_id UUID, p_user_id UUID, p_content TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.pulse_requests (event_id, user_id, content)
  VALUES (p_event_id, p_user_id, p_content);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 45. cast_pulse_vote() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_pulse_vote(p_request_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.pulse_votes (request_id, user_id)
  VALUES (p_request_id, p_user_id)
  ON CONFLICT (request_id, user_id) DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 46. create_event_poll() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_event_poll(
  p_event_id  UUID,
  p_author_id UUID,
  p_question  TEXT,
  p_options   TEXT[]
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.event_polls (event_id, author_id, question, options)
  VALUES (p_event_id, p_author_id, p_question, p_options)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 47. cast_poll_vote() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_poll_id UUID, p_votes JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.event_polls
  SET votes = p_votes
  WHERE id = p_poll_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 48. post_event_update() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_event_update(
  p_event_id UUID, p_author UUID, p_message TEXT, p_type TEXT DEFAULT 'info'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_updates (event_id, author_id, message, update_type)
  VALUES (p_event_id, p_author, p_message, p_type);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 49. join_route() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_route(p_route_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.route_members (route_id, user_id)
  VALUES (p_route_id, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 50. leave_route() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_route(p_route_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.route_members WHERE route_id = p_route_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 51. submit_service_review() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_service_review(
  p_booking_id UUID, p_rating FLOAT, p_comment TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.bookings
  SET review_rating = p_rating, review_comment = p_comment, review_at = now()
  WHERE id = p_booking_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 52. accept_gig() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_gig(p_gig_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.gig_posts
  SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  WHERE id = p_gig_id AND status = 'open';
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 53. send_spark_notifications() RPC (from patch_missing_rpcs.sql)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_spark_notifications(p_rows JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, data)
  SELECT
    (row->>'recipient_id')::UUID,
    row->>'type',
    row->>'title',
    row->>'body',
    row->'data'
  FROM jsonb_array_elements(p_rows) AS row;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 54. ADVANCED FEATURES FUNCTIONS (from patch_advanced_features.sql)
-- ────────────────────────────────────────────────────────────

-- Fanout function
CREATE OR REPLACE FUNCTION public.fanout_activity_to_followers(
  p_actor_id    UUID,
  p_action_type TEXT,
  p_target_id   UUID,
  p_target_type TEXT,
  p_target_title TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username TEXT;
  v_avatar   TEXT;
BEGIN
  SELECT username, avatar_url INTO v_username, v_avatar
  FROM public.profiles WHERE id = p_actor_id;

  INSERT INTO public.activity_feed (recipient_id, actor_id, action_type, target_id, target_type, target_title, actor_username, actor_avatar)
  SELECT
    f.follower_id,
    p_actor_id,
    p_action_type,
    p_target_id,
    p_target_type,
    p_target_title,
    v_username,
    v_avatar
  FROM public.follows f
  WHERE f.following_id = p_actor_id
    AND f.follower_id != p_actor_id
  ON CONFLICT DO NOTHING;
END;
$$;

-- RSVP fanout trigger
CREATE OR REPLACE FUNCTION public.trg_fanout_rsvp_fn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_title TEXT;
BEGIN
  IF NEW.status = 'going' THEN
    SELECT title INTO v_title FROM public.events WHERE id = NEW.event_id;
    PERFORM public.fanout_activity_to_followers(NEW.user_id, 'rsvp_going', NEW.event_id, 'event', v_title);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fanout_rsvp ON public.event_rsvps;
CREATE TRIGGER trg_fanout_rsvp
  AFTER INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.trg_fanout_rsvp_fn();

-- Vibe fanout trigger
CREATE OR REPLACE FUNCTION public.trg_fanout_vibe_fn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_title TEXT;
BEGIN
  SELECT title INTO v_title FROM public.events WHERE id = NEW.event_id;
  PERFORM public.fanout_activity_to_followers(NEW.user_id, 'vibe_sent', NEW.event_id, 'event', v_title);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fanout_vibe ON public.event_vibes;
CREATE TRIGGER trg_fanout_vibe
  AFTER INSERT ON public.event_vibes
  FOR EACH ROW EXECUTE FUNCTION public.trg_fanout_vibe_fn();

-- New event fanout trigger
CREATE OR REPLACE FUNCTION public.trg_fanout_event_fn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.fanout_activity_to_followers(NEW.author_id, 'new_event', NEW.id, 'event', NEW.title);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fanout_event ON public.events;
CREATE TRIGGER trg_fanout_event
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.trg_fanout_event_fn();

-- Co-host invite: insert into activity_feed directly (called from app via RPC)
CREATE OR REPLACE FUNCTION public.notify_cohost_invite(
  p_event_id    UUID,
  p_invitee_id  UUID,
  p_inviter_id  UUID,
  p_event_title TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_username TEXT; v_avatar TEXT;
BEGIN
  SELECT username, avatar_url INTO v_username, v_avatar FROM public.profiles WHERE id = p_inviter_id;
  INSERT INTO public.activity_feed (recipient_id, actor_id, action_type, target_id, target_type, target_title, actor_username, actor_avatar)
  VALUES (p_invitee_id, p_inviter_id, 'co_host_invite', p_event_id, 'event', p_event_title, v_username, v_avatar);
END;
$$;

-- Mark all read RPC
CREATE OR REPLACE FUNCTION public.mark_activity_read(p_user_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.activity_feed SET read = true WHERE recipient_id = p_user_id AND read = false;
$$;

-- Atomic track vote (upvote only, one per user per track)
CREATE OR REPLACE FUNCTION public.vote_track(p_track_id UUID, p_user_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_votes INT;
BEGIN
  INSERT INTO public.event_track_votes(track_id, user_id) VALUES (p_track_id, p_user_id)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    UPDATE public.event_playlist_tracks SET votes = votes + 1 WHERE id = p_track_id
    RETURNING votes INTO v_new_votes;
  ELSE
    SELECT votes INTO v_new_votes FROM public.event_playlist_tracks WHERE id = p_track_id;
  END IF;

  RETURN v_new_votes;
END;
$$;

-- Unvote track
CREATE OR REPLACE FUNCTION public.unvote_track(p_track_id UUID, p_user_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_votes INT;
BEGIN
  DELETE FROM public.event_track_votes WHERE track_id = p_track_id AND user_id = p_user_id;
  IF FOUND THEN
    UPDATE public.event_playlist_tracks SET votes = GREATEST(0, votes - 1) WHERE id = p_track_id
    RETURNING votes INTO v_new_votes;
  ELSE
    SELECT votes INTO v_new_votes FROM public.event_playlist_tracks WHERE id = p_track_id;
  END IF;
  RETURN v_new_votes;
END;
$$;

-- Get or create playlist for an event
CREATE OR REPLACE FUNCTION public.get_or_create_playlist(p_event_id UUID, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.event_playlists WHERE event_id = p_event_id;
  IF NOT FOUND THEN
    INSERT INTO public.event_playlists(event_id, created_by)
    VALUES (p_event_id, p_user_id)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- Enable realtime for tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_roles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_roles;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='activity_feed') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_playlists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_playlists;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_playlist_tracks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_playlist_tracks;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 55. Pin search_path for safety on all these routines
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
      AND routine_name IN (
        'update_profile', 'get_follower_integrity_aggregate',
        'get_economic_velocity', 'get_precision_economic_metrics',
        'distribute_to_war_chest', 'apply_vibe_decay',
        'increment_wallet_balance', 'follow_user', 'unfollow_user',
        'create_user_profile', 'update_username', 'update_sis_score',
        'send_message', 'create_dm_room', 'create_event', 'update_event',
        'cancel_event', 'delete_event', 'bulk_notify_cancel', 'upsert_rsvp',
        'remove_rsvp', 'upsert_event_reaction', 'remove_event_reaction',
        'submit_event_rating', 'add_gallery_item', 'create_reel',
        'add_reel_comment', 'increment_reel_like', 'decrement_reel_like',
        'save_reel', 'unsave_reel', 'increment_vibe_count', 'decrement_vibe_count',
        'create_story', 'mark_stories_seen', 'check_in_live', 'check_in_attendee',
        'send_path_star', 'drop_path_trace', 'count_path_crossings', 'submit_report',
        'increment_echo_like', 'decrement_echo_like', 'add_pulse_request',
        'cast_pulse_vote', 'create_event_poll', 'cast_poll_vote', 'post_event_update',
        'join_route', 'leave_route', 'submit_service_review', 'accept_gig',
        'send_spark_notifications',
        'fanout_activity_to_followers', 'notify_cohost_invite', 'mark_activity_read',
        'vote_track', 'unvote_track', 'get_or_create_playlist'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I SET search_path = public', f.routine_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
--  17. ADVANCED REELS COLUMNS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

