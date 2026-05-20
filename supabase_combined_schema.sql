-- ==============================================================================
--  THE GRUVS — Master Combined Database Schema  (v5 — single source of truth)
--  File: supabase_combined_schema.sql
--
--  Paste this entire file into Supabase → SQL Editor → Run.
--  Every statement is idempotent — safe to run on a fresh OR existing project.
-- ==============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
--  0. EXTENSIONS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;


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
    ALTER TABLE public.followers RENAME TO public.follows;
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
DROP VIEW IF EXISTS public.followers CASCADE;
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
-- App code uses "user_blocks" — provide both the canonical table and a compat alias
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
DROP VIEW IF EXISTS public.blocked_users CASCADE;
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


-- ══════════════════════════════════════════════════════════════════════════════
--  4. MESSAGES (DIRECT MESSAGING)
-- ══════════════════════════════════════════════════════════════════════════════
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
--  6. EVENT ENGAGEMENT TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- Event Vibes
ALTER TABLE public.event_vibes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event vibes readable"         ON public.event_vibes;
DROP POLICY IF EXISTS "Users manage own event vibes" ON public.event_vibes;
CREATE POLICY "Event vibes readable"         ON public.event_vibes FOR SELECT USING (true);
CREATE POLICY "Users manage own event vibes" ON public.event_vibes FOR ALL    USING (auth.uid() = user_id);

-- Saved Events
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saves" ON public.saved_events;
CREATE POLICY "Users manage own saves" ON public.saved_events FOR ALL USING (auth.uid() = user_id);

-- Event RSVPs
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RSVPs readable"         ON public.event_rsvps;
DROP POLICY IF EXISTS "Users manage own RSVPs" ON public.event_rsvps;
CREATE POLICY "RSVPs readable"         ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users manage own RSVPs" ON public.event_rsvps FOR ALL    USING (auth.uid() = user_id);

-- Echoes (Comments)
ALTER TABLE public.echoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Echoes readable"         ON public.echoes;
DROP POLICY IF EXISTS "Users insert own echoes" ON public.echoes;
DROP POLICY IF EXISTS "Users update own echoes" ON public.echoes;
DROP POLICY IF EXISTS "Users delete own echoes" ON public.echoes;
CREATE POLICY "Echoes readable"         ON public.echoes FOR SELECT USING (true);
CREATE POLICY "Users insert own echoes" ON public.echoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own echoes" ON public.echoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own echoes" ON public.echoes FOR DELETE USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  7. NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════════════
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
--  9. STORIES (used by StoriesRow component)
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
--  10. REELS (SHORT-FORM VIDEO)
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
CREATE POLICY "Reels readable by all"            ON public.reels FOR SELECT USING (is_deleted = false);
CREATE POLICY "Authenticated users insert reels" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');
CREATE POLICY "Users update own reels"           ON public.reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reels"           ON public.reels FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reel likes readable by all" ON public.reel_likes;
DROP POLICY IF EXISTS "Users manage own likes"     ON public.reel_likes;
CREATE POLICY "Reel likes readable by all" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own likes"     ON public.reel_likes FOR ALL    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reel comments readable by all" ON public.reel_comments;
DROP POLICY IF EXISTS "Users insert own comments"     ON public.reel_comments;
DROP POLICY IF EXISTS "Users update own comments"     ON public.reel_comments;
DROP POLICY IF EXISTS "Users delete own comments"     ON public.reel_comments;
CREATE POLICY "Reel comments readable by all" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "Users insert own comments"     ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');
CREATE POLICY "Users update own comments"     ON public.reel_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comments"     ON public.reel_comments FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users log own views"          ON public.reel_views;
DROP POLICY IF EXISTS "Users manage own saved reels" ON public.saved_reels;
DROP POLICY IF EXISTS "Users can report reels"       ON public.reel_reports;
CREATE POLICY "Users log own views"          ON public.reel_views   FOR ALL    USING (auth.uid() = viewer_id);
CREATE POLICY "Users manage own saved reels" ON public.saved_reels  FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "Users can report reels"       ON public.reel_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id AND auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════════
--  11. APP UPDATES & CAMPAIGN ANALYTICS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS type        TEXT DEFAULT 'feature';
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read app_updates" ON public.app_updates;
CREATE POLICY "Anyone can read app_updates" ON public.app_updates FOR SELECT USING (true);

DROP POLICY IF EXISTS "analytics_insert" ON public.campaign_analytics;
CREATE POLICY "analytics_insert" ON public.campaign_analytics FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════════
--  12. SPATIAL REF SYS (PostGIS system table)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spatial_ref_sys public read" ON public.spatial_ref_sys;
CREATE POLICY "spatial_ref_sys public read" ON public.spatial_ref_sys FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
--  13. VIEWS
-- ══════════════════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.vibes CASCADE;
CREATE OR REPLACE VIEW public.vibes WITH (security_invoker = true) AS SELECT * FROM public.event_vibes;

DROP VIEW IF EXISTS public.conversations CASCADE;
CREATE OR REPLACE VIEW public.conversations WITH (security_invoker = true) AS SELECT * FROM public.dm_rooms;


-- ══════════════════════════════════════════════════════════════════════════════
--  14. AI MEMORY & LOGS
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
--  16. TRIGGERS — COUNT SYNC FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- FIX: GREATEST (not LEAST) ensures count never drops below 0 on delete
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
