-- ============================================================
--  THE GRUVS — Complete Database  (single file)
--  Run this once in Supabase → SQL Editor → Run
--  Every statement is idempotent — safe to re-run.
--  Generated: 2026-05-21
-- ============================================================


--============================================================
--  SECTION: BASE SCHEMA
--============================================================

-- ============================================================
--  THE GRUVS — Complete Supabase Schema  (v4 — canonical)
--  Run in: Supabase → SQL Editor → Run
--  Idempotent: safe on fresh project OR existing database.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Helper functions ──────────────────────────────────────────────────────────
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
  id                  UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username            TEXT        UNIQUE,
  display_name        TEXT,
  avatar_url          TEXT,
  cover_url           TEXT,
  bio                 TEXT,
  location            TEXT,
  website             TEXT,
  is_verified         BOOLEAN     DEFAULT false,
  is_online           BOOLEAN     DEFAULT false,
  last_seen           TIMESTAMPTZ DEFAULT now(),
  last_seen_at        TIMESTAMPTZ DEFAULT now(),
  vibe_score          INTEGER     DEFAULT 0,
  followers_count     INTEGER     DEFAULT 0,
  following_count     INTEGER     DEFAULT 0,
  saved_count         INTEGER     DEFAULT 0,
  events_posted       INTEGER     DEFAULT 0,
  interests           TEXT[],
  coords              geography(Point, 4326),
  lat                 FLOAT,
  lon                 FLOAT,
  push_token          TEXT,
  identity_mode       TEXT        DEFAULT 'public',
  career_title        TEXT,
  career_description  TEXT,
  looks_description   TEXT,
  profile_gallery     TEXT[],
  current_streak         INTEGER     DEFAULT 0,
  wallet_balance         NUMERIC     DEFAULT 0,
  social_integrity_score INTEGER     DEFAULT 0,
  last_active            DATE,
  gender                 TEXT,
  birth_year             INTEGER,
  is_discoverable        BOOLEAN     DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username           TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name       TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url         TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url          TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio                TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location           TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website            TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified        BOOLEAN     DEFAULT false;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online          BOOLEAN     DEFAULT false;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen          TIMESTAMPTZ DEFAULT now();
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at       TIMESTAMPTZ DEFAULT now();
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_score         INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count    INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count    INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS saved_count        INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS events_posted      INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests          TEXT[];
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coords             geography(Point, 4326);
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat                FLOAT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lon                FLOAT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token         TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_mode      TEXT DEFAULT 'public';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_title       TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_description TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looks_description  TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_gallery    TEXT[];
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak          INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance          NUMERIC DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_integrity_score  INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active             DATE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender                  TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year              INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_discoverable         BOOLEAN     DEFAULT true;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT now();
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city                    TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online             BOOLEAN     DEFAULT true;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_events            BOOLEAN     DEFAULT false;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code           TEXT        UNIQUE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count          INTEGER     DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE INDEX IF NOT EXISTS profiles_coords_gist   ON profiles USING gist(coords);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE INDEX IF NOT EXISTS profiles_username_trgm ON profiles USING gin(username gin_trgm_ops);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE INDEX IF NOT EXISTS profiles_interests_gin ON profiles USING gin(interests);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS profiles_online        ON profiles(is_online) WHERE is_online = true;';
  END IF;
END $$;

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

-- Keep last_seen and last_seen_at in sync
CREATE OR REPLACE FUNCTION sync_last_seen()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.last_seen IS DISTINCT FROM OLD.last_seen THEN
    NEW.last_seen_at := NEW.last_seen;
  ELSIF NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at THEN
    NEW.last_seen := NEW.last_seen_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_sync_last_seen ON profiles;
CREATE TRIGGER profiles_sync_last_seen BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_last_seen();

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
--  FOLLOWS  (app uses "follows", keep "followers" as alias)
-- ============================================================
-- Rename legacy table if it exists under old name
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='followers')
  AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='follows') THEN
    ALTER TABLE followers RENAME TO follows;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE follows ADD COLUMN IF NOT EXISTS following_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    CREATE INDEX IF NOT EXISTS follows_following_id ON follows(following_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    CREATE INDEX IF NOT EXISTS follows_follower_id  ON follows(follower_id);
  END IF;
END $$;

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON follows;
DROP POLICY IF EXISTS "Users manage own follows" ON follows;
CREATE POLICY "Follows readable"         ON follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON follows FOR ALL    USING (auth.uid() = follower_id);

-- Compat view so any old code using "followers" still works
DROP VIEW IF EXISTS followers CASCADE;
CREATE OR REPLACE VIEW followers AS SELECT * FROM follows;

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

DROP TRIGGER IF EXISTS follows_sync ON follows;
CREATE TRIGGER follows_sync AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();


-- ============================================================
--  BLOCKED USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blocked_users') THEN
    ALTER TABLE blocked_users ADD COLUMN IF NOT EXISTS blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE blocked_users ADD COLUMN IF NOT EXISTS blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blocked_users') THEN
    CREATE INDEX IF NOT EXISTS blocked_users_blocker ON blocked_users(blocker_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blocked_users') THEN
    CREATE INDEX IF NOT EXISTS blocked_users_blocked ON blocked_users(blocked_id);
  END IF;
END $$;

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own blocks" ON blocked_users;
CREATE POLICY "Users manage own blocks" ON blocked_users FOR ALL USING (auth.uid() = blocker_id);


-- ============================================================
--  MUTED USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS muted_users (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (muter_id, muted_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'muted_users') THEN
    ALTER TABLE muted_users ADD COLUMN IF NOT EXISTS muter_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE muted_users ADD COLUMN IF NOT EXISTS muted_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE muted_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own mutes" ON muted_users;
CREATE POLICY "Users manage own mutes" ON muted_users FOR ALL USING (auth.uid() = muter_id);


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
  lat             FLOAT,
  lon             FLOAT,
  date_time       TIMESTAMPTZ,
  is_featured     BOOLEAN     DEFAULT false,
  is_cancelled    BOOLEAN     DEFAULT false,
  is_sold_out     BOOLEAN     DEFAULT false,
  max_attendees   INTEGER,
  image_url       TEXT,
  cover_image     TEXT,
  age_restriction INTEGER     DEFAULT 0,
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
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
    ALTER TABLE events ADD COLUMN IF NOT EXISTS lat             FLOAT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS lon             FLOAT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS date_time       TIMESTAMPTZ;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured     BOOLEAN DEFAULT false;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS is_cancelled    BOOLEAN DEFAULT false;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS age_restriction INTEGER DEFAULT 0;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector   TSVECTOR;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS max_attendees   INTEGER;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS is_sold_out     BOOLEAN     DEFAULT false;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url       TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image     TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='trending_score'
  ) THEN
    ALTER TABLE events ADD COLUMN trending_score FLOAT
      GENERATED ALWAYS AS (vibe_count * 1.0 + going * 0.5 + echo_count * 0.3 + reaction_count * 0.2) STORED;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    CREATE INDEX IF NOT EXISTS events_coords_gist ON events USING gist(coords);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    CREATE INDEX IF NOT EXISTS events_search_gin  ON events USING gin(search_vector);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    CREATE INDEX IF NOT EXISTS events_tags_gin    ON events USING gin(tags);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    CREATE INDEX IF NOT EXISTS events_category    ON events(category);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    CREATE INDEX IF NOT EXISTS events_trending    ON events(trending_score DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_upcoming    ON events(event_date ASC)  WHERE is_cancelled = false;';
  END IF;
END $$;

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
--  EVENT REMINDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS event_reminders (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  remind_at  TIMESTAMPTZ NOT NULL,
  sent       BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reminders') THEN
    ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS event_id  UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;
    ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS sent      BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reminders') THEN
    CREATE INDEX IF NOT EXISTS event_reminders_user    ON event_reminders(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reminders') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS event_reminders_pending ON event_reminders(remind_at) WHERE sent = false;';
  END IF;
END $$;

ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own reminders" ON event_reminders;
CREATE POLICY "Users manage own reminders" ON event_reminders FOR ALL USING (auth.uid() = user_id);


-- ============================================================
--  EVENT VIBES  (likes)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vibes')
  AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='event_vibes') THEN
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_vibes') THEN
    ALTER TABLE event_vibes ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE event_vibes ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_vibes') THEN
    CREATE INDEX IF NOT EXISTS event_vibes_event_id ON event_vibes(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_vibes') THEN
    CREATE INDEX IF NOT EXISTS event_vibes_user_id  ON event_vibes(user_id);
  END IF;
END $$;

ALTER TABLE event_vibes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event vibes readable"         ON event_vibes;
DROP POLICY IF EXISTS "Users manage own event vibes" ON event_vibes;
CREATE POLICY "Event vibes readable"         ON event_vibes FOR SELECT USING (true);
CREATE POLICY "Users manage own event vibes" ON event_vibes FOR ALL    USING (auth.uid() = user_id);

DROP VIEW IF EXISTS vibes;
CREATE OR REPLACE VIEW vibes
  WITH (security_invoker = true)
AS SELECT * FROM event_vibes;

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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_rsvps') THEN
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS status   TEXT DEFAULT 'going';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_rsvps') THEN
    CREATE INDEX IF NOT EXISTS event_rsvps_event_id ON event_rsvps(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_rsvps') THEN
    CREATE INDEX IF NOT EXISTS event_rsvps_user_id  ON event_rsvps(user_id);
  END IF;
END $$;

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RSVPs readable"         ON event_rsvps;
DROP POLICY IF EXISTS "Users manage own RSVPs" ON event_rsvps;
CREATE POLICY "RSVPs readable"         ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users manage own RSVPs" ON event_rsvps FOR ALL    USING (auth.uid() = user_id);


-- ============================================================
--  CHECK-INS (physical attendance)
-- ============================================================
CREATE TABLE IF NOT EXISTS check_ins (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'check_ins') THEN
    ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'check_ins') THEN
    CREATE INDEX IF NOT EXISTS check_ins_event_id ON check_ins(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'check_ins') THEN
    CREATE INDEX IF NOT EXISTS check_ins_user_id  ON check_ins(user_id);
  END IF;
END $$;

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Check-ins readable"         ON check_ins;
DROP POLICY IF EXISTS "Users manage own check-ins" ON check_ins;
CREATE POLICY "Check-ins readable"         ON check_ins FOR SELECT USING (true);
CREATE POLICY "Users manage own check-ins" ON check_ins FOR ALL    USING (auth.uid() = user_id);

-- Alias for legacy "checkins" queries
DROP VIEW IF EXISTS checkins;
CREATE OR REPLACE VIEW checkins AS SELECT * FROM check_ins;

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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_checkins') THEN
    ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES events(id)   ON DELETE SET NULL;
    ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS lat           FLOAT;
    ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS lon           FLOAT;
    ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS venue_name    TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_checkins') THEN
    CREATE INDEX IF NOT EXISTS live_checkins_user_id  ON live_checkins(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_checkins') THEN
    CREATE INDEX IF NOT EXISTS live_checkins_event_id ON live_checkins(event_id);
  END IF;
END $$;

ALTER TABLE live_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live checkins readable"         ON live_checkins;
DROP POLICY IF EXISTS "Users manage own live checkins" ON live_checkins;
CREATE POLICY "Live checkins readable"         ON live_checkins FOR SELECT USING (true);
CREATE POLICY "Users manage own live checkins" ON live_checkins FOR ALL    USING (auth.uid() = user_id);


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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_events') THEN
    ALTER TABLE saved_events ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE saved_events ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_events') THEN
    CREATE INDEX IF NOT EXISTS saved_events_user_id  ON saved_events(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_events') THEN
    CREATE INDEX IF NOT EXISTS saved_events_event_id ON saved_events(event_id);
  END IF;
END $$;

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
    UPDATE events   SET save_count  = greatest(0, save_count - 1) WHERE id = old.event_id;
    UPDATE profiles SET saved_count = greatest(0, saved_count - 1) WHERE id = old.user_id;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reactions') THEN
    ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE event_reactions ADD COLUMN IF NOT EXISTS reaction_key TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reactions') THEN
    CREATE INDEX IF NOT EXISTS event_reactions_event_id ON event_reactions(event_id);
  END IF;
END $$;

ALTER TABLE event_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reactions readable"         ON event_reactions;
DROP POLICY IF EXISTS "Users manage own reactions" ON event_reactions;
CREATE POLICY "Reactions readable"         ON event_reactions FOR SELECT USING (true);
CREATE POLICY "Users manage own reactions" ON event_reactions FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_reaction_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events SET reaction_count = reaction_count + 1             WHERE id = new.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events SET reaction_count = greatest(0, reaction_count - 1) WHERE id = old.event_id;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'echoes') THEN
    ALTER TABLE echoes ADD COLUMN IF NOT EXISTS event_id  UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE echoes ADD COLUMN IF NOT EXISTS user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE echoes ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES echoes(id)   ON DELETE CASCADE;
    ALTER TABLE echoes ADD COLUMN IF NOT EXISTS body      TEXT;
    ALTER TABLE echoes ADD COLUMN IF NOT EXISTS likes     INTEGER DEFAULT 0;
    ALTER TABLE echoes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'echoes') THEN
    CREATE INDEX IF NOT EXISTS echoes_event_id  ON echoes(event_id, created_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'echoes') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS echoes_parent_id ON echoes(parent_id) WHERE parent_id IS NOT NULL;';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'echoes') THEN
    CREATE INDEX IF NOT EXISTS echoes_user_id   ON echoes(user_id);
  END IF;
END $$;

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
    UPDATE events SET echo_count = echo_count + 1
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

CREATE TABLE IF NOT EXISTS echo_likes (
  echo_id    UUID NOT NULL REFERENCES echoes(id)   ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (echo_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'echo_likes') THEN
    ALTER TABLE echo_likes ADD COLUMN IF NOT EXISTS echo_id UUID REFERENCES echoes(id)   ON DELETE CASCADE;
    ALTER TABLE echo_likes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE echo_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Echo likes readable"         ON echo_likes;
DROP POLICY IF EXISTS "Users manage own echo likes" ON echo_likes;
CREATE POLICY "Echo likes readable"         ON echo_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own echo likes" ON echo_likes FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_echo_likes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE echoes SET likes = likes + 1            WHERE id = new.echo_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE echoes SET likes = greatest(0, likes-1) WHERE id = old.echo_id;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_ratings') THEN
    ALTER TABLE event_ratings ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE event_ratings ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE event_ratings ADD COLUMN IF NOT EXISTS rating   SMALLINT;
    ALTER TABLE event_ratings ADD COLUMN IF NOT EXISTS review   TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_ratings') THEN
    CREATE INDEX IF NOT EXISTS event_ratings_event_id ON event_ratings(event_id);
  END IF;
END $$;

ALTER TABLE event_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ratings readable"         ON event_ratings;
DROP POLICY IF EXISTS "Users manage own ratings" ON event_ratings;
CREATE POLICY "Ratings readable"         ON event_ratings FOR SELECT USING (true);
CREATE POLICY "Users manage own ratings" ON event_ratings FOR ALL    USING (auth.uid() = user_id);


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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_gallery') THEN
    ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
    ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS url      TEXT;
    ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS caption  TEXT;
    ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS width    INTEGER;
    ALTER TABLE event_gallery ADD COLUMN IF NOT EXISTS height   INTEGER;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_gallery') THEN
    CREATE INDEX IF NOT EXISTS event_gallery_event_id ON event_gallery(event_id);
  END IF;
END $$;

ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gallery readable"     ON event_gallery;
DROP POLICY IF EXISTS "Users insert gallery" ON event_gallery;
DROP POLICY IF EXISTS "Users delete gallery" ON event_gallery;
CREATE POLICY "Gallery readable"     ON event_gallery FOR SELECT USING (true);
CREATE POLICY "Users insert gallery" ON event_gallery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete gallery" ON event_gallery FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
--  HASHTAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS hashtags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tag        TEXT        UNIQUE NOT NULL,
  use_count  INTEGER     DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hashtags') THEN
    ALTER TABLE hashtags ADD COLUMN IF NOT EXISTS tag       TEXT;
    ALTER TABLE hashtags ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hashtags') THEN
    CREATE INDEX IF NOT EXISTS hashtags_tag ON hashtags(tag);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hashtags') THEN
    CREATE INDEX IF NOT EXISTS hashtags_popular ON hashtags(use_count DESC);
  END IF;
END $$;

ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hashtags readable" ON hashtags;
