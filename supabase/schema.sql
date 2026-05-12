-- ============================================================
--  THE GRUVS — Complete Supabase Schema
--  Safe to run on a fresh project OR on top of an existing one.
--  Every statement uses IF NOT EXISTS / DROP … IF EXISTS.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Shared helpers ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION safe_div(a numeric, b numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN b = 0 THEN 0 ELSE a / b END;
$$;

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

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified     BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online       BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at    TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_score      INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS saved_count     INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS events_posted   INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests       TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coords          geography(Point, 4326);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS profiles_coords_gist   ON profiles USING gist(coords);
CREATE INDEX IF NOT EXISTS profiles_username_trgm ON profiles USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_interests_gin ON profiles USING gin(interests);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles readable" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Public profiles readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

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
DROP POLICY IF EXISTS "Followers readable"       ON followers;
DROP POLICY IF EXISTS "Users manage own follows" ON followers;
CREATE POLICY "Followers readable"       ON followers FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON followers FOR ALL    USING (auth.uid() = follower_id);

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
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug            TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category        TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_color  TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tags            TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date      DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date        DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time        TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS address         TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS city            TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country         TEXT DEFAULT 'ZA';
ALTER TABLE events ADD COLUMN IF NOT EXISTS price           TEXT DEFAULT 'FREE';
ALTER TABLE events ADD COLUMN IF NOT EXISTS price_min       NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS price_max       NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity        INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS going           INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS vibe_count      INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS echo_count      INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reaction_count  INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS save_count      INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_url      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS media           JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS media_urls      TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS coords          geography(Point, 4326);
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured     BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_cancelled    BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_restriction INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector   TSVECTOR;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lat             FLOAT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lon             FLOAT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS date_time       TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

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
CREATE INDEX IF NOT EXISTS events_featured    ON events(is_featured, trending_score DESC)
  WHERE is_featured = true AND is_cancelled = false;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events readable by all"            ON events;
DROP POLICY IF EXISTS "Authenticated users insert events" ON events;
DROP POLICY IF EXISTS "Users update own events"           ON events;
DROP POLICY IF EXISTS "Users delete own events"           ON events;
CREATE POLICY "Events readable by all"            ON events FOR SELECT USING (true);
CREATE POLICY "Authenticated users insert events" ON events FOR INSERT
  WITH CHECK (auth.uid() = author_id OR auth.uid() = user_id);
CREATE POLICY "Users update own events"           ON events FOR UPDATE
  USING (auth.uid() = author_id OR auth.uid() = user_id);
CREATE POLICY "Users delete own events"           ON events FOR DELETE
  USING (auth.uid() = author_id OR auth.uid() = user_id);

CREATE OR REPLACE FUNCTION events_set_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base_slug TEXT;
BEGIN
  IF new.slug IS NOT NULL THEN RETURN new; END IF;
  base_slug := left(regexp_replace(lower(unaccent(new.title)), '[^a-z0-9]+', '-', 'g'), 60);
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  new.slug  := base_slug || '-' || left(gen_random_uuid()::text, 8);
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
    UPDATE profiles SET events_posted = events_posted + 1
      WHERE id = COALESCE(new.author_id, new.user_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET events_posted = greatest(0, events_posted - 1)
      WHERE id = COALESCE(old.author_id, old.user_id);
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS events_posted_sync ON events;
CREATE TRIGGER events_posted_sync AFTER INSERT OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION sync_events_posted();


-- ============================================================
--  EVENT VIBES  (likes)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vibes' AND table_type = 'BASE TABLE'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'event_vibes'
  ) THEN
    ALTER TABLE vibes RENAME TO event_vibes;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS event_vibes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_vibes ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_vibes ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS event_vibes_event_id ON event_vibes(event_id);
CREATE INDEX IF NOT EXISTS event_vibes_user_id  ON event_vibes(user_id);

ALTER TABLE event_vibes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event vibes readable"         ON event_vibes;
DROP POLICY IF EXISTS "Users manage own event vibes" ON event_vibes;
CREATE POLICY "Event vibes readable"         ON event_vibes FOR SELECT USING (true);
CREATE POLICY "Users manage own event vibes" ON event_vibes FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_vibe_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events   SET vibe_count = vibe_count + 1
      WHERE id = new.event_id
      RETURNING COALESCE(author_id, user_id) INTO v_owner;
    UPDATE profiles SET vibe_score = vibe_score + 2 WHERE id = v_owner;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events   SET vibe_count = greatest(0, vibe_count - 1)
      WHERE id = old.event_id
      RETURNING COALESCE(author_id, user_id) INTO v_owner;
    UPDATE profiles SET vibe_score = greatest(0, vibe_score - 2) WHERE id = v_owner;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS event_vibes_sync ON event_vibes;
CREATE TRIGGER event_vibes_sync AFTER INSERT OR DELETE ON event_vibes
  FOR EACH ROW EXECUTE FUNCTION sync_vibe_counts();

-- Backward-compat view
DROP VIEW IF EXISTS vibes;
CREATE OR REPLACE VIEW vibes AS SELECT * FROM event_vibes;


-- ============================================================
--  EVENT RSVPS  (going — used by ScoutScreen crew filter)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_rsvps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        DEFAULT 'going' CHECK (status IN ('going','interested','not_going')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS status   TEXT DEFAULT 'going';

CREATE INDEX IF NOT EXISTS event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id  ON event_rsvps(user_id);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RSVPs readable"          ON event_rsvps;
DROP POLICY IF EXISTS "Users manage own RSVPs"  ON event_rsvps;
CREATE POLICY "RSVPs readable"          ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users manage own RSVPs"  ON event_rsvps FOR ALL    USING (auth.uid() = user_id);


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
    UPDATE events   SET save_count  = save_count  + 1            WHERE id = new.event_id;
    UPDATE profiles SET saved_count = saved_count + 1            WHERE id = new.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events   SET save_count  = greatest(0, save_count -1) WHERE id = old.event_id;
    UPDATE profiles SET saved_count = greatest(0, saved_count-1) WHERE id = old.user_id;
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
  reaction_key TEXT        NOT NULL
    CHECK (reaction_key IN ('fire','heart','skull','100','mic','crown')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS reaction_key TEXT;

CREATE INDEX IF NOT EXISTS event_reactions_event_id ON event_reactions(event_id);

ALTER TABLE event_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reactions readable"         ON event_reactions;
DROP POLICY IF EXISTS "Users manage own reactions" ON event_reactions;
CREATE POLICY "Reactions readable"         ON event_reactions FOR SELECT USING (true);
CREATE POLICY "Users manage own reactions" ON event_reactions FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_reaction_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events SET reaction_count = reaction_count + 1            WHERE id = new.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events SET reaction_count = greatest(0, reaction_count-1) WHERE id = old.event_id;
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
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS echoes_event_id  ON echoes(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS echoes_parent_id ON echoes(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS echoes_user_id   ON echoes(user_id);

ALTER TABLE echoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Echoes readable"         ON echoes;
DROP POLICY IF EXISTS "Users insert own echoes" ON echoes;
DROP POLICY IF EXISTS "Users update own echoes" ON echoes;
DROP POLICY IF EXISTS "Users delete own echoes" ON echoes;
CREATE POLICY "Echoes readable"         ON echoes FOR SELECT USING (true);
CREATE POLICY "Users insert own echoes" ON echoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own echoes" ON echoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own echoes" ON echoes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_echo_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events   SET echo_count = echo_count + 1
      WHERE id = new.event_id
      RETURNING COALESCE(author_id, user_id) INTO v_owner;
    UPDATE profiles SET vibe_score = vibe_score + 1 WHERE id = v_owner;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events SET echo_count = greatest(0, echo_count - 1) WHERE id = old.event_id;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS echoes_sync ON echoes;
CREATE TRIGGER echoes_sync AFTER INSERT OR DELETE ON echoes
  FOR EACH ROW EXECUTE FUNCTION sync_echo_counts();

-- Echo likes
CREATE TABLE IF NOT EXISTS echo_likes (
  echo_id    UUID NOT NULL REFERENCES echoes(id)   ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (echo_id, user_id)
);

ALTER TABLE echo_likes ADD COLUMN IF NOT EXISTS echo_id UUID REFERENCES echoes(id)   ON DELETE CASCADE;
ALTER TABLE echo_likes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE echo_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Echo likes readable"         ON echo_likes;
DROP POLICY IF EXISTS "Users manage own echo likes" ON echo_likes;
CREATE POLICY "Echo likes readable"         ON echo_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own echo likes" ON echo_likes FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_echo_likes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE echoes SET likes = likes + 1            WHERE id = new.echo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE echoes SET likes = greatest(0, likes-1) WHERE id = old.echo_id;
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
DROP POLICY IF EXISTS "Ratings readable"         ON event_ratings;
DROP POLICY IF EXISTS "Users manage own ratings" ON event_ratings;
CREATE POLICY "Ratings readable"         ON event_ratings FOR SELECT USING (true);
CREATE POLICY "Users manage own ratings" ON event_ratings FOR ALL    USING (auth.uid() = user_id);


-- ============================================================
--  CHECK-INS  (physical RSVP / going count)
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
DROP POLICY IF EXISTS "Check-ins readable"        ON check_ins;
DROP POLICY IF EXISTS "Users manage own check-ins" ON check_ins;
CREATE POLICY "Check-ins readable"        ON check_ins FOR SELECT USING (true);
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
--  LIVE CHECK-INS  (GPS footprint)
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
DROP POLICY IF EXISTS "Live checkins readable"         ON live_checkins;
DROP POLICY IF EXISTS "Users manage own live checkins" ON live_checkins;
CREATE POLICY "Live checkins readable"         ON live_checkins FOR SELECT USING (true);
CREATE POLICY "Users manage own live checkins" ON live_checkins FOR ALL    USING (auth.uid() = user_id);


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
ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS width    INTEGER;
ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS height   INTEGER;

CREATE INDEX IF NOT EXISTS event_gallery_event_id ON event_gallery(event_id);

ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gallery readable"     ON event_gallery;
DROP POLICY IF EXISTS "Users insert gallery" ON event_gallery;
DROP POLICY IF EXISTS "Users delete gallery" ON event_gallery;
CREATE POLICY "Gallery readable"     ON event_gallery FOR SELECT USING (true);
CREATE POLICY "Users insert gallery" ON event_gallery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete gallery" ON event_gallery FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
--  NOTIFICATIONS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='notifications' AND column_name='user_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='notifications' AND column_name='recipient_id') THEN
    ALTER TABLE notifications RENAME COLUMN user_id TO recipient_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='notifications' AND column_name='is_read')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='notifications' AND column_name='read') THEN
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
  event_id     UUID        REFERENCES events(id)  ON DELETE CASCADE,
  echo_id      UUID        REFERENCES echoes(id)  ON DELETE CASCADE,
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
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
DROP POLICY IF EXISTS "System insert notifications"  ON notifications;
DROP POLICY IF EXISTS "Users mark own as read"       ON notifications;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "System insert notifications"  ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users mark own as read"       ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

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
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS event_vibes_notify ON event_vibes;
DROP TRIGGER IF EXISTS echoes_notify      ON echoes;
DROP TRIGGER IF EXISTS followers_notify   ON followers;
CREATE TRIGGER event_vibes_notify AFTER INSERT ON event_vibes
  FOR EACH ROW EXECUTE FUNCTION create_notification();
CREATE TRIGGER echoes_notify AFTER INSERT ON echoes
  FOR EACH ROW EXECUTE FUNCTION create_notification();
CREATE TRIGGER followers_notify AFTER INSERT ON followers
  FOR EACH ROW EXECUTE FUNCTION create_notification();


-- ============================================================
--  DIRECT MESSAGES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='direct_messages' AND column_name='user_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='direct_messages' AND column_name='recipient_id') THEN
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
DROP POLICY IF EXISTS "DM participants can read" ON direct_messages;
DROP POLICY IF EXISTS "Users send own messages"  ON direct_messages;
CREATE POLICY "DM participants can read" ON direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users send own messages"  ON direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);


-- ============================================================
--  CONVERSATIONS  (thread grouping for DMs)
-- ============================================================
-- Drop a legacy view if it exists before creating the real table
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    EXECUTE 'DROP VIEW conversations CASCADE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS conversations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message   TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count_1 INTEGER     DEFAULT 0,
  unread_count_2 INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (participant_1, participant_2),
  CHECK (participant_1 < participant_2)
);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_1   UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_2   UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message    TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count_1  INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count_2  INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS conversations_p1 ON conversations(participant_1, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_p2 ON conversations(participant_2, last_message_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Conversation participants can read"   ON conversations;
DROP POLICY IF EXISTS "Conversation participants can update" ON conversations;
CREATE POLICY "Conversation participants can read"   ON conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Conversation participants can update" ON conversations FOR ALL
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP TRIGGER IF EXISTS conversations_touch ON conversations;
CREATE TRIGGER conversations_touch BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


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
ALTER TABLE routes ADD COLUMN IF NOT EXISTS icon        TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS join_count  INTEGER DEFAULT 0;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS vibe_score  INTEGER DEFAULT 0;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS routes_active  ON routes(active, join_count DESC);
CREATE INDEX IF NOT EXISTS routes_user_id ON routes(user_id);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Routes readable"         ON routes;
DROP POLICY IF EXISTS "Users manage own routes" ON routes;
CREATE POLICY "Routes readable"         ON routes FOR SELECT USING (true);
CREATE POLICY "Users manage own routes" ON routes FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS route_joins (
  route_id   UUID        NOT NULL REFERENCES routes(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (route_id, user_id)
);

ALTER TABLE route_joins ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id)   ON DELETE CASCADE;
ALTER TABLE route_joins ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE route_joins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Route joins readable"         ON route_joins;
DROP POLICY IF EXISTS "Users manage own route joins" ON route_joins;
CREATE POLICY "Route joins readable"         ON route_joins FOR SELECT USING (true);
CREATE POLICY "Users manage own route joins" ON route_joins FOR ALL    USING (auth.uid() = user_id);


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

ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS name         TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS category     TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price        NUMERIC;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_unit   TEXT DEFAULT 'trip';
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS location     TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS coords       geography(Point, 4326);
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS rating       FLOAT DEFAULT 0;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS available    BOOLEAN DEFAULT true;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS media        JSONB;

ALTER TABLE service_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Services readable"         ON service_nodes;
DROP POLICY IF EXISTS "Users manage own services" ON service_nodes;
CREATE POLICY "Services readable"         ON service_nodes FOR SELECT USING (true);
CREATE POLICY "Users manage own services" ON service_nodes FOR ALL    USING (auth.uid() = user_id);


-- ============================================================
--  GIG POSTS
-- ============================================================
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

ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS title        TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS pay          NUMERIC;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS location     TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS slots        INTEGER DEFAULT 1;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS filled       INTEGER DEFAULT 0;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS active       BOOLEAN DEFAULT true;

ALTER TABLE gig_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gigs readable"         ON gig_posts;
DROP POLICY IF EXISTS "Users manage own gigs" ON gig_posts;
CREATE POLICY "Gigs readable"         ON gig_posts FOR SELECT USING (true);
CREATE POLICY "Users manage own gigs" ON gig_posts FOR ALL    USING (auth.uid() = user_id);


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
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status      TEXT    DEFAULT 'pending';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward      NUMERIC DEFAULT 0;

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Referrals readable by owner" ON referrals;
CREATE POLICY "Referrals readable by owner" ON referrals FOR ALL
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);


-- ============================================================
--  BUSINESS PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS business_profiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  business_name  TEXT        NOT NULL,
  business_type  TEXT,
  tagline        TEXT,
  description    TEXT,
  logo_url       TEXT,
  cover_url      TEXT,
  primary_color  TEXT        DEFAULT '#00f2ff',
  accent_color   TEXT        DEFAULT '#8b5cf6',
  verified       BOOLEAN     DEFAULT false,
  tier           TEXT        DEFAULT 'starter',
  store_enabled  BOOLEAN     DEFAULT false,
  store_slug     TEXT        UNIQUE,
  store_config   JSONB       DEFAULT '{}',
  website        TEXT,
  phone          TEXT,
  email          TEXT,
  location       TEXT,
  total_revenue  NUMERIC     DEFAULT 0,
  follower_count INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_name  TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_type  TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS tagline        TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS description    TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS logo_url       TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS cover_url      TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS primary_color  TEXT DEFAULT '#00f2ff';
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS accent_color   TEXT DEFAULT '#8b5cf6';
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS verified       BOOLEAN DEFAULT false;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS tier           TEXT DEFAULT 'starter';
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_enabled  BOOLEAN DEFAULT false;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_slug     TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_config   JSONB DEFAULT '{}';
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS website        TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS location       TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS total_revenue  NUMERIC DEFAULT 0;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_profiles_owner"       ON business_profiles;
DROP POLICY IF EXISTS "business_profiles_public_read" ON business_profiles;
CREATE POLICY "business_profiles_owner"       ON business_profiles FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "business_profiles_public_read" ON business_profiles FOR SELECT USING (true);

DROP TRIGGER IF EXISTS business_profiles_touch ON business_profiles;
CREATE TRIGGER business_profiles_touch BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


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

CREATE INDEX IF NOT EXISTS business_page_blocks_business_id ON business_page_blocks(business_id, position);

ALTER TABLE business_page_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Blocks public readable"    ON business_page_blocks;
DROP POLICY IF EXISTS "Business owner manages blocks" ON business_page_blocks;
CREATE POLICY "Blocks public readable"        ON business_page_blocks FOR SELECT USING (true);
CREATE POLICY "Business owner manages blocks" ON business_page_blocks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM business_profiles bp
    WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));


-- ============================================================
--  CAMPAIGNS  (Business ad campaigns)
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  type         TEXT        DEFAULT 'awareness',
  status       TEXT        DEFAULT 'draft',
  budget       NUMERIC     DEFAULT 0,
  spent        NUMERIC     DEFAULT 0,
  reach        INTEGER     DEFAULT 0,
  clicks       INTEGER     DEFAULT 0,
  conversions  INTEGER     DEFAULT 0,
  target       JSONB       DEFAULT '{}',
  creative     JSONB       DEFAULT '{}',
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS business_id  UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS title        TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS type         TEXT DEFAULT 'awareness';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'draft';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS budget       NUMERIC DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS spent        NUMERIC DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS reach        INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS clicks       INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS conversions  INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target       JSONB DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS creative     JSONB DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS starts_at    TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ends_at      TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS campaigns_business_id ON campaigns(business_id);
CREATE INDEX IF NOT EXISTS campaigns_status      ON campaigns(status);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campaigns owner only" ON campaigns;
CREATE POLICY "Campaigns owner only" ON campaigns FOR ALL
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM business_profiles bp
    WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS campaigns_touch ON campaigns;
CREATE TRIGGER campaigns_touch BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ============================================================
--  CONTEXTUAL ADS  (AdFlywheel)
-- ============================================================
CREATE TABLE IF NOT EXISTS contextual_ads (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL CHECK (type IN ('event','service','gig')),
  headline   TEXT        NOT NULL,
  subline    TEXT,
  cta        TEXT        DEFAULT 'View',
  badge      TEXT        DEFAULT 'PROMOTED',
  icon       TEXT        DEFAULT 'zap',
  color      TEXT        DEFAULT '#00f2ff',
  event_id   UUID        REFERENCES events(id) ON DELETE SET NULL,
  priority   INTEGER     DEFAULT 0,
  active     BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS type     TEXT DEFAULT 'event';
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS subline  TEXT;
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS cta      TEXT DEFAULT 'View';
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS badge    TEXT DEFAULT 'PROMOTED';
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS icon     TEXT DEFAULT 'zap';
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS color    TEXT DEFAULT '#00f2ff';
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS active   BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS contextual_ads_active ON contextual_ads(active, priority DESC);

ALTER TABLE contextual_ads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ads readable" ON contextual_ads;
CREATE POLICY "Ads readable" ON contextual_ads FOR SELECT USING (active = true);


-- ============================================================
--  ENABLE REALTIME  (tables that need live subscriptions)
-- ============================================================
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['events','notifications','direct_messages','conversations','live_checkins','event_vibes','echoes'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
