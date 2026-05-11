-- ============================================================
--  THE GRUVS — Complete Supabase Schema (Combined v3)
--  Paste the entire file into: Supabase → SQL Editor → Run
--
--  Safe to run on a fresh project OR on top of an existing one.
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
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

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
--  DIRECT MESSAGES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='direct_messages' AND column_name='user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='direct_messages' AND column_name='recipient_id') THEN
    ALTER TABLE direct_messages RENAME COLUMN user_id TO recipient_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS direct_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read         BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS sender_id    UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS body         TEXT;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS read         BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS dm_sender    ON direct_messages(sender_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS dm_recipient ON direct_messages(recipient_id, created_at DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DM participants can read"   ON direct_messages;
DROP POLICY IF EXISTS "Users send own messages"    ON direct_messages;
CREATE POLICY "DM participants can read"   ON direct_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users send own messages"    ON direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);


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
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price       NUMERIC;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS available   BOOLEAN DEFAULT true;

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
CREATE POLICY "Bookings readable by parties" ON service_bookings FOR SELECT USING (auth.uid() = client_id OR auth.uid() = provider_id);
CREATE POLICY "Clients create bookings"      ON service_bookings FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Parties update bookings"      ON service_bookings FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = provider_id);


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
  WHERE e.is_cancelled = false AND e.event_date >= current_date
  ORDER BY e.trending_score DESC, e.going DESC
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
    AND ST_DWithin(p.coords, u_coords, max_dist_km * 1000)
  ORDER BY distance_km ASC
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
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-media', 'event-media', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view media"        ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload media"      ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete own media"  ON storage.objects;
CREATE POLICY "Anyone can view media"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth users upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users delete own media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-media' AND auth.uid()::text = (storage.foldername(name))[1]);

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
  body             TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
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
DROP POLICY IF EXISTS "DM participants can read messages" ON messages;
DROP POLICY IF EXISTS "Users send own messages"           ON messages;
DROP POLICY IF EXISTS "Users update own messages"         ON messages;
DROP POLICY IF EXISTS "Users delete own messages"         ON messages;
CREATE POLICY "DM participants can read messages" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
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
DROP TABLE IF EXISTS conversations CASCADE;

CREATE OR REPLACE VIEW conversations AS
SELECT DISTINCT ON (convo_key)
  LEAST(sender_id::text, recipient_id::text) || '_' || GREATEST(sender_id::text, recipient_id::text) AS convo_key,
  sender_id, recipient_id,
  body         AS last_message,
  created_at   AS last_message_at,
  read_at, is_request, request_accepted,
  id           AS last_message_id
FROM messages
WHERE deleted_at IS NULL
ORDER BY convo_key, created_at DESC;

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
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;

-- RLS for group messages (anyone RSVP'd 'going' can read)
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

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

-- Insert a system profile for welcoming users
INSERT INTO profiles (id, username, display_name, bio, vibe_score, is_online)
VALUES ('00000000-0000-0000-0000-000000000000', 'gruv_hq', 'The Gruvs HQ 👑', 'Welcome to the vibe economy. We are here to help you find your crew.', 9999, true)
ON CONFLICT (id) DO NOTHING;

-- Trigger to welcome new users
CREATE OR REPLACE FUNCTION handle_new_user_welcome()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Send Welcome Notification
  INSERT INTO notifications (recipient_id, actor_id, type, title, body)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000000', 'system', 'Welcome to The Gruvs! 👑', 'You just joined the most exclusive vibe network. Start discovery now.');

  -- 2. Send Welcome DM
  INSERT INTO messages (sender_id, recipient_id, body, is_request, request_accepted)
  VALUES ('00000000-0000-0000-0000-000000000000', NEW.id, 'Yo! Welcome to The Gruvs. 🚀 I am your guide to the city. To see gruvs near you, make sure to enable location in your profile. Let''s get it!', false, true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_welcome ON profiles;
CREATE TRIGGER on_auth_user_welcome
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_welcome();
