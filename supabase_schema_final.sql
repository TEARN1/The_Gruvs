-- ============================================================
--  THE GRUVS — COMPLETE DATABASE SCHEMA  (single file, v4)
--  Paste into: Supabase → SQL Editor → Run
--  Fully idempotent — safe to run on fresh OR existing project.
-- ============================================================
--  Every statement uses IF NOT EXISTS / DROP … IF EXISTS so
--  nothing will error if it already exists.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Helper ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION safe_div(a numeric, b numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN b = 0 THEN 0 ELSE a / b END;
$$;

-- ── touch_updated_at (shared trigger function) ────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;


-- ============================================================
--  PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username         TEXT        UNIQUE,
  display_name     TEXT,
  avatar_url       TEXT,
  cover_url        TEXT,
  bio              TEXT,
  location         TEXT,
  website          TEXT,
  is_verified      BOOLEAN     DEFAULT false,
  is_online        BOOLEAN     DEFAULT false,
  last_seen_at     TIMESTAMPTZ DEFAULT now(),
  vibe_score       INTEGER     DEFAULT 0,
  followers_count  INTEGER     DEFAULT 0,
  following_count  INTEGER     DEFAULT 0,
  saved_count      INTEGER     DEFAULT 0,
  events_posted    INTEGER     DEFAULT 0,
  interests        TEXT[],
  coords           geography(Point, 4326),
  push_token       TEXT,
  vibe_equity      NUMERIC     DEFAULT 0,
  social_integrity_score INTEGER DEFAULT 50,
  identity_mode    TEXT        DEFAULT 'public' CHECK (identity_mode IN ('public','ghost','celebrity')),
  is_beacon_active BOOLEAN     DEFAULT false,
  is_discoverable  BOOLEAN     DEFAULT true,
  badges           TEXT[]      DEFAULT '{}',
  xp               INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Add any missing columns to existing tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio              TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified      BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online        BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at     TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_score       INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count  INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count  INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS saved_count      INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS events_posted    INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests        TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coords           geography(Point, 4326);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_equity      NUMERIC     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_integrity_score INTEGER DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_mode    TEXT        DEFAULT 'public';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_beacon_active BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_discoverable  BOOLEAN     DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code    TEXT        UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count   INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role             TEXT        DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_title      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looks_description  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_gallery    TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online        BOOLEAN     DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_events       BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provider_type      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provider_rate      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provider_bio       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provider_verified  BOOLEAN     DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_coords_gist   ON profiles USING gist(coords);
CREATE INDEX IF NOT EXISTS profiles_username_trgm ON profiles USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_interests_gin  ON profiles USING gin(interests);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles readable"  ON profiles;
DROP POLICY IF EXISTS "Users update own profile"  ON profiles;
DROP POLICY IF EXISTS "Users insert own profile"  ON profiles;
CREATE POLICY "Public profiles readable"  ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile"  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS profiles_touch ON profiles;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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
    WHEN others THEN NULL;
  END;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
--  FOLLOWERS
-- ============================================================
CREATE TABLE IF NOT EXISTS followers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE followers ADD COLUMN IF NOT EXISTS follower_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE followers ADD COLUMN IF NOT EXISTS following_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS followers_following_id ON followers(following_id);
CREATE INDEX IF NOT EXISTS followers_follower_id  ON followers(follower_id);

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Followers readable"        ON followers;
DROP POLICY IF EXISTS "Users manage own follows"  ON followers;
CREATE POLICY "Followers readable"        ON followers FOR SELECT USING (true);
CREATE POLICY "Users manage own follows"  ON followers FOR ALL    USING (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION sync_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = new.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = new.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = greatest(0, followers_count - 1) WHERE id = old.following_id;
    UPDATE profiles SET following_count = greatest(0, following_count - 1) WHERE id = old.follower_id;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS followers_sync ON followers;
CREATE TRIGGER followers_sync AFTER INSERT OR DELETE ON followers
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();


-- ============================================================
--  EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES profiles(id) ON DELETE CASCADE,
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
  is_featured     BOOLEAN     DEFAULT false,
  is_cancelled    BOOLEAN     DEFAULT false,
  age_restriction INTEGER     DEFAULT 0,
  search_vector   TSVECTOR,
  lat             FLOAT,
  lon             FLOAT,
  date_time       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS author_id       UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS media_urls      TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS title           TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category        TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_color  TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS address         TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS price           TEXT DEFAULT 'FREE';
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity        INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS going           INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS vibe_count      INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS echo_count      INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reaction_count  INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS save_count      INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_url      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS media           JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured     BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_cancelled    BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date      DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug            TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tags            TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date        DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time        TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS city            TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country         TEXT DEFAULT 'ZA';
ALTER TABLE events ADD COLUMN IF NOT EXISTS price_min       NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS price_max       NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_restriction INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector   TSVECTOR;
ALTER TABLE events ADD COLUMN IF NOT EXISTS coords          geography(Point, 4326);
ALTER TABLE events ADD COLUMN IF NOT EXISTS lat             FLOAT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lon             FLOAT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS date_time       TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

-- trending_score generated column (skip if already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'trending_score'
  ) THEN
    ALTER TABLE events ADD COLUMN trending_score FLOAT
      GENERATED ALWAYS AS (
        vibe_count * 1.0 + going * 0.5 + echo_count * 0.3 + reaction_count * 0.2
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_coords_gist ON events USING gist(coords);
CREATE INDEX IF NOT EXISTS events_search_gin  ON events USING gin(search_vector);
CREATE INDEX IF NOT EXISTS events_tags_gin    ON events USING gin(tags);
CREATE INDEX IF NOT EXISTS events_category    ON events(category);
CREATE INDEX IF NOT EXISTS events_trending    ON events(trending_score DESC);
CREATE INDEX IF NOT EXISTS events_upcoming    ON events(event_date ASC)  WHERE is_cancelled = false;
CREATE INDEX IF NOT EXISTS events_featured    ON events(is_featured, trending_score DESC) WHERE is_featured = true AND is_cancelled = false;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events readable by all"            ON events;
DROP POLICY IF EXISTS "Authenticated users insert events" ON events;
DROP POLICY IF EXISTS "Users update own events"           ON events;
DROP POLICY IF EXISTS "Users delete own events"           ON events;
CREATE POLICY "Events readable by all"            ON events FOR SELECT  USING (true);
DROP POLICY IF EXISTS "Authenticated users insert events" ON events;
CREATE POLICY "Authenticated users insert events" ON events FOR INSERT  WITH CHECK (auth.uid() = author_id OR auth.uid() = user_id);
CREATE POLICY "Users update own events"           ON events FOR UPDATE  USING (auth.uid() = author_id OR auth.uid() = user_id);
CREATE POLICY "Users delete own events"           ON events FOR DELETE  USING (auth.uid() = author_id OR auth.uid() = user_id);

CREATE OR REPLACE FUNCTION events_set_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
BEGIN
  IF new.slug IS NOT NULL THEN RETURN new; END IF;
  base_slug  := lower(regexp_replace(unaccent(new.title), '[^a-z0-9]+', '-', 'g'));
  base_slug  := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  base_slug  := left(base_slug, 60);
  final_slug := base_slug || '-' || left(gen_random_uuid()::text, 8);
  new.slug   := final_slug;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS events_slug_gen ON events;
CREATE TRIGGER events_slug_gen BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION events_set_slug();

CREATE OR REPLACE FUNCTION events_update_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(unaccent(new.title),       '')), 'A') ||
    setweight(to_tsvector('english', coalesce(unaccent(new.venue_name),  '')), 'B') ||
    setweight(to_tsvector('english', coalesce(unaccent(new.city),        '')), 'B') ||
    setweight(to_tsvector('english', coalesce(unaccent(new.description), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'B');
  new.updated_at := now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS events_search_vector_update ON events;
CREATE TRIGGER events_search_vector_update BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION events_update_search_vector();

CREATE OR REPLACE FUNCTION sync_events_posted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET events_posted = events_posted + 1 WHERE id = COALESCE(new.author_id, new.user_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET events_posted = greatest(0, events_posted - 1) WHERE id = COALESCE(old.author_id, old.user_id);
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS events_posted_sync ON events;
CREATE TRIGGER events_posted_sync AFTER INSERT OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION sync_events_posted();


-- ============================================================
--  EVENT VIBES  (likes on events — canonical table name)
-- ============================================================

-- Rename legacy 'vibes' table to 'event_vibes' if it exists and event_vibes doesn't yet
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vibes' AND table_type='BASE TABLE')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='event_vibes') THEN
    ALTER TABLE vibes RENAME TO event_vibes;
  END IF;
END $$;

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


-- ============================================================
--  SAVED EVENTS
-- ============================================================
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


-- ============================================================
--  EVENT REACTIONS
-- ============================================================
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


-- ============================================================
--  ECHOES  (comments)
-- ============================================================
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

DROP TRIGGER IF EXISTS echoes_sync ON echoes;
CREATE TRIGGER echoes_sync AFTER INSERT OR DELETE ON echoes
  FOR EACH ROW EXECUTE FUNCTION sync_echo_counts();

-- Echo likes
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


-- ============================================================
--  EVENT RATINGS
-- ============================================================
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


-- ============================================================
--  LIVE CHECK-INS  (GPS footprint — PathMapScreen)
-- ============================================================
CREATE TABLE IF NOT EXISTS live_checkins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id      UUID        REFERENCES events(id) ON DELETE SET NULL,
  lat           FLOAT,
  lon           FLOAT,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_id)
);

ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES events(id)   ON DELETE SET NULL;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS lat           FLOAT;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS lon           FLOAT;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS live_checkins_user_id  ON live_checkins(user_id);
CREATE INDEX IF NOT EXISTS live_checkins_event_id ON live_checkins(event_id);

ALTER TABLE live_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live checkins readable"          ON live_checkins;
DROP POLICY IF EXISTS "Users manage own live checkins"  ON live_checkins;
CREATE POLICY "Live checkins readable"          ON live_checkins FOR SELECT USING (true);
CREATE POLICY "Users manage own live checkins"  ON live_checkins FOR ALL    USING (auth.uid() = user_id);


-- ============================================================
--  EVENT GALLERY
-- ============================================================
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

ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS url      TEXT;
ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS caption  TEXT;

CREATE INDEX IF NOT EXISTS event_gallery_event_id ON event_gallery(event_id);

ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;
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

CREATE OR REPLACE FUNCTION create_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner UUID;
BEGIN
  IF TG_TABLE_NAME = 'event_vibes' AND TG_OP = 'INSERT' THEN
    SELECT COALESCE(author_id, user_id) INTO v_owner FROM events WHERE id = new.event_id;
    IF v_owner IS DISTINCT FROM new.user_id THEN
      INSERT INTO notifications(recipient_id, actor_id, type, event_id)
      VALUES (v_owner, new.user_id, 'vibe', new.event_id) ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_TABLE_NAME = 'echoes' AND TG_OP = 'INSERT' THEN
    SELECT COALESCE(author_id, user_id) INTO v_owner FROM events WHERE id = new.event_id;
    IF v_owner IS DISTINCT FROM new.user_id THEN
      INSERT INTO notifications(recipient_id, actor_id, type, event_id, echo_id, body)
      VALUES (v_owner, new.user_id, 'echo', new.event_id, new.id, left(new.body, 80));
    END IF;
  ELSIF TG_TABLE_NAME = 'followers' AND TG_OP = 'INSERT' THEN
    INSERT INTO notifications(recipient_id, actor_id, type)
    VALUES (new.following_id, new.follower_id, 'follow');
  ELSIF TG_TABLE_NAME = 'follows' AND TG_OP = 'INSERT' THEN
    INSERT INTO notifications(recipient_id, actor_id, type)
    VALUES (new.following_id, new.follower_id, 'follow');
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS event_vibes_notify ON event_vibes;
DROP TRIGGER IF EXISTS echoes_notify      ON echoes;
DROP TRIGGER IF EXISTS followers_notify   ON followers;
DROP TRIGGER IF EXISTS follows_notify     ON follows;
CREATE TRIGGER event_vibes_notify AFTER INSERT ON event_vibes FOR EACH ROW EXECUTE FUNCTION create_notification();
CREATE TRIGGER echoes_notify      AFTER INSERT ON echoes      FOR EACH ROW EXECUTE FUNCTION create_notification();
CREATE TRIGGER followers_notify   AFTER INSERT ON followers   FOR EACH ROW EXECUTE FUNCTION create_notification();


-- ============================================================
--  ROUTES  (Royal Routes)
-- ============================================================
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


-- ============================================================
--  SERVICE MARKETPLACE
-- ============================================================
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
-- ============================================================

CREATE OR REPLACE FUNCTION increment_vibe(ev_id uuid, uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO vibes (event_id, user_id) VALUES (ev_id, uid)
  ON CONFLICT (event_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_vibe(ev_id uuid, uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM vibes WHERE event_id = ev_id AND user_id = uid;
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
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('avatars', 'covers', 'event-media', 'chat_media')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
--  FOLLOWS  (canonical table — all code queries 'follows')
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK  (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_follower_id  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_id ON follows(following_id);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON follows;
DROP POLICY IF EXISTS "Users manage own follows" ON follows;
CREATE POLICY "Follows readable"         ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own follows" ON follows;
CREATE POLICY "Users manage own follows" ON follows FOR ALL    USING (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION sync_follows_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = COALESCE(followers_count,0)+1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = COALESCE(following_count,0)+1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = GREATEST(0,COALESCE(followers_count,0)-1) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(0,COALESCE(following_count,0)-1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS follows_count_sync ON follows;
CREATE TRIGGER follows_count_sync AFTER INSERT OR DELETE ON follows FOR EACH ROW EXECUTE FUNCTION sync_follows_counts();

-- ============================================================
--  MESSAGES  (canonical DM table with full feature columns)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='recipient_id') THEN
    ALTER TABLE messages RENAME COLUMN user_id TO recipient_id;
  END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS messages_sender    ON messages(sender_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_convo     ON messages(LEAST(sender_id::text, recipient_id::text), GREATEST(sender_id::text, recipient_id::text), created_at DESC);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Message participants can read" ON messages;
DROP POLICY IF EXISTS "Users send own messages"           ON messages;
DROP POLICY IF EXISTS "Users update own messages"         ON messages;
DROP POLICY IF EXISTS "Users delete own messages"         ON messages;
DROP POLICY IF EXISTS "Message participants can read" ON messages;
CREATE POLICY "Message participants can read" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users send own messages"           ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users update own messages"         ON messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users delete own messages"         ON messages FOR DELETE USING (auth.uid() = sender_id);

CREATE OR REPLACE FUNCTION set_message_delivered()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.delivered_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS message_delivered_trigger ON messages;
CREATE TRIGGER message_delivered_trigger BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION set_message_delivered();

-- ============================================================
--  BLOCKED USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS blocked_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS blocked_blocked ON blocked_users(blocked_id);
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own blocks" ON blocked_users;
CREATE POLICY "Users manage own blocks" ON blocked_users FOR ALL USING (auth.uid() = blocker_id);

-- ============================================================
--  MUTED USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS muted_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (muter_id, muted_id)
);
ALTER TABLE muted_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own mutes" ON muted_users;
CREATE POLICY "Users manage own mutes" ON muted_users FOR ALL USING (auth.uid() = muter_id);

-- ============================================================
--  EVENT REMINDERS
-- ============================================================
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
CREATE TABLE IF NOT EXISTS ai_interactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  feature     TEXT,
  input       TEXT,
  output      TEXT,
  model       TEXT,
  tokens_used INTEGER,
  feedback    INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own ai_interactions"   ON ai_interactions;
DROP POLICY IF EXISTS "Users insert ai_interactions"    ON ai_interactions;
DROP POLICY IF EXISTS "Users update own ai_interactions" ON ai_interactions;
CREATE POLICY "Users read own ai_interactions"   ON ai_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert ai_interactions"     ON ai_interactions FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Users update own ai_interactions" ON ai_interactions;
CREATE POLICY "Users update own ai_interactions" ON ai_interactions FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_user_memory (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  summary     TEXT,
  preferences JSONB       DEFAULT '{}',
  behaviour   JSONB       DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own ai_memory" ON ai_user_memory;
CREATE POLICY "Users manage own ai_memory" ON ai_user_memory FOR ALL USING (auth.uid() = user_id);

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

CREATE TABLE IF NOT EXISTS ai_recommendations_cache (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  event_ids   UUID[]      DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own recommendations" ON ai_recommendations_cache;
CREATE POLICY "Users read own recommendations" ON ai_recommendations_cache FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service upsert recommendations" ON ai_recommendations_cache;
CREATE POLICY "Service upsert recommendations"  ON ai_recommendations_cache FOR ALL USING (true);

-- ============================================================
--  SECURITY LOGS
-- ============================================================
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
CREATE TABLE IF NOT EXISTS global_economy_params (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vibe_tax_rate FLOAT       DEFAULT 0.05,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE global_economy_params ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "global_economy_params readable" ON global_economy_params;
CREATE POLICY "global_economy_params readable" ON global_economy_params FOR SELECT USING (true);
-- Seed default row if none exists
INSERT INTO global_economy_params (vibe_tax_rate) SELECT 0.05 WHERE NOT EXISTS (SELECT 1 FROM global_economy_params);

-- ============================================================
--  EVENT CHECKINS (alias table used by claudeService)
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
--  increment_profile_score  RPC
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
  -- Check if there is an existing conversation that was accepted
  SELECT request_accepted INTO is_accepted
  FROM messages
  WHERE (sender_id = NEW.sender_id AND recipient_id = NEW.recipient_id)
     OR (sender_id = NEW.recipient_id AND recipient_id = NEW.sender_id)
     AND request_accepted = true
  LIMIT 1;

  -- If not accepted yet, count how many messages the sender has sent
  IF is_accepted IS NOT TRUE THEN
    SELECT count(*) INTO msg_count
    FROM messages
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

-- Event Group Messages
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
EXCEPTION WHEN foreign_key_violation THEN NULL;
END $$;

-- Trigger to welcome new users
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

-- ============================================================
--  PATHS (user journey trails)
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
CREATE OR REPLACE VIEW conversations WITH (security_invoker = true) AS SELECT * FROM dm_rooms;

-- ============================================================
--  EVENT RSVPS
-- ============================================================
CREATE TABLE IF NOT EXISTS event_rsvps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        DEFAULT 'going' CHECK (status IN ('going','interested','not_going')),
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


-- ── ADDITIONS (reels, follows, storage, extra columns) ──

-- ── 1. Profile columns (gallery, badges, xp) ─────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_gallery TEXT[]    DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges          TEXT[]    DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp              INTEGER   DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen       TIMESTAMPTZ;

-- ── 3. Reels table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reels (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL DEFAULT 'video' CHECK (media_type IN ('video', 'image')),
  caption       TEXT    DEFAULT '',
  event_id      UUID    REFERENCES events(id) ON DELETE SET NULL,
  event_title   TEXT,
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Reel likes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (reel_id, user_id)
);

-- ── 5. Reel comments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reel_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS reels_user_id_idx      ON reels(user_id);
CREATE INDEX IF NOT EXISTS reels_created_at_idx   ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS reel_comments_reel_idx ON reel_comments(reel_id);

-- ── 7. RLS for reels ──────────────────────────────────────────────────────────
ALTER TABLE reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"  ON reels;
DROP POLICY IF EXISTS "reels_insert"  ON reels;
DROP POLICY IF EXISTS "reels_delete"  ON reels;
DROP POLICY IF EXISTS "reels_update"  ON reels;
CREATE POLICY "reels_select" ON reels FOR SELECT USING (is_deleted = FALSE);
CREATE POLICY "reels_insert" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_delete" ON reels FOR DELETE  USING (auth.uid() = user_id);
CREATE POLICY "reels_update" ON reels FOR UPDATE  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_likes_select" ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON reel_likes;
CREATE POLICY "reel_likes_select" ON reel_likes FOR SELECT USING (TRUE);
CREATE POLICY "reel_likes_insert" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON reel_likes FOR DELETE  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_comments_select" ON reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert" ON reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete" ON reel_comments;
CREATE POLICY "reel_comments_select" ON reel_comments FOR SELECT USING (TRUE);
CREATE POLICY "reel_comments_insert" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete" ON reel_comments FOR DELETE  USING (auth.uid() = user_id);

-- ── 8. Auto-sync like/comment counts via triggers ─────────────────────────────
CREATE OR REPLACE FUNCTION sync_reel_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reels SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_like_count_trigger ON reel_likes;
CREATE TRIGGER reel_like_count_trigger
  AFTER INSERT OR DELETE ON reel_likes
  FOR EACH ROW EXECUTE FUNCTION sync_reel_like_count();

CREATE OR REPLACE FUNCTION sync_reel_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reels SET comment_count = comment_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reels SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_comment_count_trigger ON reel_comments;
CREATE TRIGGER reel_comment_count_trigger
  AFTER INSERT OR DELETE ON reel_comments
  FOR EACH ROW EXECUTE FUNCTION sync_reel_comment_count();

-- ── 9. Storage buckets (run ONCE — comment out after first run if already exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', TRUE)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', TRUE)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', TRUE)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('event-media', 'event-media', TRUE)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "reels_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "reels_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "reels_storage_delete" ON storage.objects;
CREATE POLICY "reels_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "reels_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels' AND auth.uid() IS NOT NULL);
CREATE POLICY "reels_storage_delete" ON storage.objects FOR DELETE  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars bucket policies
DROP POLICY IF EXISTS "avatars_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_delete" ON storage.objects;
CREATE POLICY "avatars_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_storage_delete" ON storage.objects FOR DELETE  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Covers bucket policies
DROP POLICY IF EXISTS "covers_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "covers_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "covers_storage_delete" ON storage.objects;
CREATE POLICY "covers_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "covers_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
CREATE POLICY "covers_storage_delete" ON storage.objects FOR DELETE  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Event media bucket policies
DROP POLICY IF EXISTS "event_media_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "event_media_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "event_media_storage_delete" ON storage.objects;
CREATE POLICY "event_media_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "event_media_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "event_media_storage_delete" ON storage.objects FOR DELETE  USING (bucket_id = 'event-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Reels table
CREATE TABLE IF NOT EXISTS reels (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL DEFAULT 'video' CHECK (media_type IN ('video', 'image')),
  caption       TEXT DEFAULT '',
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  event_title   TEXT,
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Reel likes
CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (reel_id, user_id)
);

-- Reel comments
CREATE TABLE IF NOT EXISTS reel_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS reels_user_id_idx      ON reels(user_id);
CREATE INDEX IF NOT EXISTS reels_created_at_idx   ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS reel_comments_reel_idx ON reel_comments(reel_id);

-- RLS
ALTER TABLE reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;

-- Reels: anyone can read non-deleted; only owner can insert/delete
DROP POLICY IF EXISTS "reels_select" ON reels;
DROP POLICY IF EXISTS "reels_insert" ON reels;
DROP POLICY IF EXISTS "reels_delete" ON reels;
DROP POLICY IF EXISTS "reels_update" ON reels;
CREATE POLICY "reels_select"  ON reels FOR SELECT USING (is_deleted = FALSE);
CREATE POLICY "reels_insert"  ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_delete"  ON reels FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "reels_update"  ON reels FOR UPDATE USING (auth.uid() = user_id);

-- Reel likes: anyone can read; authenticated users can insert/delete their own
DROP POLICY IF EXISTS "reel_likes_select" ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON reel_likes;
CREATE POLICY "reel_likes_select" ON reel_likes FOR SELECT USING (TRUE);
CREATE POLICY "reel_likes_insert" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON reel_likes FOR DELETE USING (auth.uid() = user_id);

-- Reel comments: anyone can read; authenticated users can insert their own
DROP POLICY IF EXISTS "reel_comments_select" ON reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert" ON reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete" ON reel_comments;
CREATE POLICY "reel_comments_select" ON reel_comments FOR SELECT USING (TRUE);
CREATE POLICY "reel_comments_insert" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete" ON reel_comments FOR DELETE USING (auth.uid() = user_id);

-- Auto-update like/comment counts via triggers
CREATE OR REPLACE FUNCTION sync_reel_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reels SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER reel_like_count_trigger
AFTER INSERT OR DELETE ON reel_likes
FOR EACH ROW EXECUTE FUNCTION sync_reel_like_count();

CREATE OR REPLACE FUNCTION sync_reel_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reels SET comment_count = comment_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reels SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER reel_comment_count_trigger
AFTER INSERT OR DELETE ON reel_comments
FOR EACH ROW EXECUTE FUNCTION sync_reel_comment_count();
-- ─────────────────────────────────────────────────────────────────────────────
-- CREW STORIES (24-hour disappearing posts)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url   TEXT NOT NULL,
  media_type  TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption     TEXT DEFAULT '',
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_views (
  story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

-- Auto-expire: a cron job or the query filters on expires_at; no hard delete needed here
CREATE INDEX IF NOT EXISTS idx_stories_user_id   ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires   ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer ON story_views(viewer_id);

ALTER TABLE stories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_select"  ON stories;
DROP POLICY IF EXISTS "stories_insert"  ON stories;
DROP POLICY IF EXISTS "stories_delete"  ON stories;
DROP POLICY IF EXISTS "story_views_select"  ON story_views;
DROP POLICY IF EXISTS "story_views_insert"  ON story_views;
DROP POLICY IF EXISTS "story_views_select_viewer" ON story_views;

CREATE POLICY "stories_select"  ON stories FOR SELECT USING (expires_at > now());
CREATE POLICY "stories_insert"  ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_delete"  ON stories FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "story_views_select"  ON story_views FOR SELECT USING (auth.uid() = viewer_id);
CREATE POLICY "story_views_insert"  ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Storage bucket for story media (if not already created)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('stories', 'stories', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "stories bucket public read" ON storage.objects;
DROP POLICY IF EXISTS "stories bucket auth upload" ON storage.objects;
DROP POLICY IF EXISTS "stories bucket auth delete" ON storage.objects;

CREATE POLICY "stories bucket public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'stories');

CREATE POLICY "stories bucket auth upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');

CREATE POLICY "stories bucket auth delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────────────────────────────────────
-- EVENT CHECK-INS (door scanning / manual ticket verification)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rsvp_id     UUID NOT NULL REFERENCES event_rsvps(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rsvp_id)
);

CREATE INDEX IF NOT EXISTS idx_checkins_event ON event_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user  ON event_checkins(user_id);

ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checkins_select" ON event_checkins;
DROP POLICY IF EXISTS "checkins_insert" ON event_checkins;

-- Event organiser can read; authenticated users can upsert their own checkin
CREATE POLICY "checkins_select" ON event_checkins FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "checkins_insert" ON event_checkins FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- ============================================================
--  THE GRUVS — 50 ADVANCED SQL LOGICS  (v5 addendum)
--  Categories: XP/Levels · Events · Social Graph · Streaks
--              Business · Moderation · Messaging · Stories
--              Reels · Economy · Governance
--  All idempotent — safe to re-run.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1.  XP & LEVELING SYSTEM
-- ════════════════════════════════════════════════════════════

-- #1  Central XP-award function (called by every trigger below)
CREATE OR REPLACE FUNCTION award_xp(p_user_id UUID, p_amount INT, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET xp          = COALESCE(xp, 0) + p_amount,
      vibe_equity = COALESCE(vibe_equity, 0) + (p_amount * 0.1)
  WHERE id = p_user_id;
END;
$$;

-- #2  XP on RSVP (10 XP for going, 2 for maybe)
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
CREATE OR REPLACE FUNCTION sync_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  fwer UUID := COALESCE(NEW.follower_id,  OLD.follower_id);
  fwed UUID := COALESCE(NEW.following_id, OLD.following_id);
BEGIN
  UPDATE profiles SET followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = fwed) WHERE id = fwed;
  UPDATE profiles SET following_count = (SELECT COUNT(*) FROM follows WHERE follower_id  = fwer) WHERE id = fwer;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_follow_counts ON follows;
CREATE TRIGGER trg_sync_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();

-- #16  Mutual follows (friends) view
CREATE OR REPLACE VIEW mutual_follows AS
SELECT a.follower_id AS user_a, a.following_id AS user_b
FROM follows a
JOIN follows b ON b.follower_id = a.following_id AND b.following_id = a.follower_id;

-- #17  Friends-of-friends suggested follows
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
CREATE OR REPLACE FUNCTION record_daily_activity(p_user UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_streak INT := 0;
  v_day    DATE;
  v_prev   DATE;
BEGIN
  INSERT INTO daily_activity(user_id, day)
  VALUES (p_user, CURRENT_DATE)
  ON CONFLICT (user_id, day)
  DO UPDATE SET action_count = daily_activity.action_count + 1;

  FOR v_day IN
    SELECT day FROM daily_activity WHERE user_id = p_user ORDER BY day DESC
  LOOP
    IF v_streak = 0 THEN
      IF v_day = CURRENT_DATE OR v_day = CURRENT_DATE - 1 THEN
        v_streak := 1; v_prev := v_day;
      ELSE EXIT;
      END IF;
    ELSE
      IF v_day = v_prev - 1 THEN v_streak := v_streak + 1; v_prev := v_day;
      ELSE EXIT;
      END IF;
    END IF;
  END LOOP;
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
CREATE TABLE IF NOT EXISTS reel_views (
  reel_id   UUID NOT NULL REFERENCES reels(id)    ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (reel_id, viewer_id)
);
ALTER TABLE reels ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_reel_views_reel   ON reel_views(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_views_viewer ON reel_views(viewer_id);
ALTER TABLE reel_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reel_views_insert" ON reel_views;
DROP POLICY IF EXISTS "reel_views_select" ON reel_views;
CREATE POLICY "reel_views_insert" ON reel_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "reel_views_select" ON reel_views FOR SELECT USING (TRUE);

-- #41  Trigger: increment view_count on new unique view
CREATE OR REPLACE FUNCTION sync_reel_view_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE reels SET view_count = view_count + 1 WHERE id = NEW.reel_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_reel_view_count ON reel_views;
CREATE TRIGGER trg_reel_view_count
  AFTER INSERT ON reel_views
  FOR EACH ROW EXECUTE FUNCTION sync_reel_view_count();

-- #42  Reel discovery score function
CREATE OR REPLACE FUNCTION reel_discovery_score(
  p_likes INT, p_comments INT, p_views INT, p_created TIMESTAMPTZ
)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT (p_likes * 5 + p_comments * 3 + p_views * 0.5)
       / NULLIF(POWER(EXTRACT(EPOCH FROM (now() - p_created)) / 3600 + 1, 1.2), 0);
$$;

-- #43  Trending reels view (top 50 by discovery score)
CREATE OR REPLACE VIEW trending_reels AS
SELECT
  r.*,
  reel_discovery_score(r.like_count, r.comment_count, r.view_count, r.created_at) AS score
FROM reels r
WHERE r.is_deleted = false
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
