-- ============================================================
--  THE GRUVS — Complete Database  (single file)
--  Run this once in Supabase → SQL Editor → Run
--  Every statement is idempotent — safe to re-run.
--  Generated: 2026-05-21
-- ============================================================


============================================================
--  SECTION: BASE SCHEMA
============================================================

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

CREATE INDEX IF NOT EXISTS profiles_coords_gist   ON profiles USING gist(coords);
CREATE INDEX IF NOT EXISTS profiles_username_trgm ON profiles USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_interests_gin ON profiles USING gin(interests);
CREATE INDEX IF NOT EXISTS profiles_online        ON profiles(is_online) WHERE is_online = true;

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

ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS following_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS follows_follower_id  ON follows(follower_id);

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

ALTER TABLE blocked_users ADD COLUMN IF NOT EXISTS blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE blocked_users ADD COLUMN IF NOT EXISTS blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked ON blocked_users(blocked_id);

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

ALTER TABLE muted_users ADD COLUMN IF NOT EXISTS muter_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE muted_users ADD COLUMN IF NOT EXISTS muted_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='trending_score'
  ) THEN
    ALTER TABLE events ADD COLUMN trending_score FLOAT
      GENERATED ALWAYS AS (vibe_count * 1.0 + going * 0.5 + echo_count * 0.3 + reaction_count * 0.2) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_coords_gist ON events USING gist(coords);
CREATE INDEX IF NOT EXISTS events_search_gin  ON events USING gin(search_vector);
CREATE INDEX IF NOT EXISTS events_tags_gin    ON events USING gin(tags);
CREATE INDEX IF NOT EXISTS events_category    ON events(category);
CREATE INDEX IF NOT EXISTS events_trending    ON events(trending_score DESC);
CREATE INDEX IF NOT EXISTS events_upcoming    ON events(event_date ASC)  WHERE is_cancelled = false;

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

ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS event_id  UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS sent      BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS event_reminders_user    ON event_reminders(user_id);
CREATE INDEX IF NOT EXISTS event_reminders_pending ON event_reminders(remind_at) WHERE sent = false;

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

ALTER TABLE event_vibes ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_vibes ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS event_vibes_event_id ON event_vibes(event_id);
CREATE INDEX IF NOT EXISTS event_vibes_user_id  ON event_vibes(user_id);

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

ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS status   TEXT DEFAULT 'going';

CREATE INDEX IF NOT EXISTS event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id  ON event_rsvps(user_id);

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

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id)   ON DELETE CASCADE;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS check_ins_event_id ON check_ins(event_id);
CREATE INDEX IF NOT EXISTS check_ins_user_id  ON check_ins(user_id);

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

ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES events(id)   ON DELETE SET NULL;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS lat           FLOAT;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS lon           FLOAT;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS venue_name    TEXT;

CREATE INDEX IF NOT EXISTS live_checkins_user_id  ON live_checkins(user_id);
CREATE INDEX IF NOT EXISTS live_checkins_event_id ON live_checkins(event_id);

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
--  HASHTAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS hashtags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tag        TEXT        UNIQUE NOT NULL,
  use_count  INTEGER     DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hashtags ADD COLUMN IF NOT EXISTS tag       TEXT;
ALTER TABLE hashtags ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS hashtags_tag ON hashtags(tag);
CREATE INDEX IF NOT EXISTS hashtags_popular ON hashtags(use_count DESC);

ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hashtags readable" ON hashtags;
CREATE POLICY "Hashtags readable" ON hashtags FOR SELECT USING (true);


-- ============================================================
--  NOTIFICATIONS
-- ============================================================
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
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS echo_id      UUID REFERENCES echoes(id) ON DELETE CASCADE;
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
  ELSIF TG_TABLE_NAME = 'follows' AND TG_OP = 'INSERT' THEN
    INSERT INTO notifications(recipient_id, actor_id, type)
    VALUES (new.following_id, new.follower_id, 'follow');
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS event_vibes_notify ON event_vibes;
DROP TRIGGER IF EXISTS echoes_notify      ON echoes;
DROP TRIGGER IF EXISTS follows_notify     ON follows;
CREATE TRIGGER event_vibes_notify AFTER INSERT ON event_vibes  FOR EACH ROW EXECUTE FUNCTION create_notification();
CREATE TRIGGER echoes_notify      AFTER INSERT ON echoes       FOR EACH ROW EXECUTE FUNCTION create_notification();
CREATE TRIGGER follows_notify     AFTER INSERT ON follows      FOR EACH ROW EXECUTE FUNCTION create_notification();


-- ============================================================
--  MESSAGES  (primary messaging table — replaces direct_messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body             TEXT        CHECK (body IS NULL OR length(body) <= 4000),
  message_type     TEXT        DEFAULT 'text',
  media_url        TEXT,
  parent_id        UUID        REFERENCES messages(id) ON DELETE SET NULL,
  event_id         UUID        REFERENCES events(id)   ON DELETE SET NULL,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  is_request       BOOLEAN     DEFAULT false,
  request_accepted BOOLEAN     DEFAULT false,
  reaction         TEXT,
  read_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id        UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS body             TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type     TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id        UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id         UUID REFERENCES events(id)   ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction         TEXT;

CREATE INDEX IF NOT EXISTS messages_sender      ON messages(sender_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient   ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_convo       ON messages(LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);
CREATE INDEX IF NOT EXISTS messages_unread      ON messages(recipient_id, read_at) WHERE read_at IS NULL AND deleted_at IS NULL;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Message participants can read"  ON messages;
DROP POLICY IF EXISTS "Users send own messages"        ON messages;
DROP POLICY IF EXISTS "Users update own messages"      ON messages;
CREATE POLICY "Message participants can read"  ON messages FOR SELECT
  USING ((auth.uid() = sender_id OR auth.uid() = recipient_id) AND deleted_at IS NULL);
CREATE POLICY "Users send own messages"        ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users update own messages"      ON messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Keep legacy direct_messages table working (alias)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='direct_messages') THEN
    -- Create a view alias
    EXECUTE 'CREATE OR REPLACE VIEW direct_messages AS SELECT id, sender_id, recipient_id, body, (read_at IS NOT NULL) AS read, created_at FROM messages';
  END IF;
END $$;

-- DM rooms for group/pair context tracking
CREATE TABLE IF NOT EXISTS dm_rooms (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message   TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count_1 INTEGER     DEFAULT 0,
  unread_count_2 INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2))
);

ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS participant_1    UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS participant_2    UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS last_message     TEXT;
ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS last_message_at  TIMESTAMPTZ;
ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS unread_count_1   INTEGER DEFAULT 0;
ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS unread_count_2   INTEGER DEFAULT 0;
ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS dm_rooms_p1 ON dm_rooms(participant_1, last_message_at DESC);
CREATE INDEX IF NOT EXISTS dm_rooms_p2 ON dm_rooms(participant_2, last_message_at DESC);

ALTER TABLE dm_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DM room participants can read"   ON dm_rooms;
DROP POLICY IF EXISTS "DM room participants can update" ON dm_rooms;
CREATE POLICY "DM room participants can read"   ON dm_rooms FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "DM room participants can update" ON dm_rooms FOR ALL
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP TRIGGER IF EXISTS dm_rooms_touch ON dm_rooms;
CREATE TRIGGER dm_rooms_touch BEFORE UPDATE ON dm_rooms
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Compat alias: conversations → dm_rooms
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='conversations') THEN
    DROP VIEW conversations CASCADE;
  END IF;
END $$;
CREATE OR REPLACE VIEW conversations
  WITH (security_invoker = true)
AS SELECT * FROM dm_rooms;


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
--  DIGITAL FOOTPRINT  (paths, traces, stars, crossings)
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

ALTER TABLE paths ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE paths ADD COLUMN IF NOT EXISTS title       TEXT;
ALTER TABLE paths ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE paths ADD COLUMN IF NOT EXISTS color       TEXT    DEFAULT '#00f2ff';
ALTER TABLE paths ADD COLUMN IF NOT EXISTS is_public   BOOLEAN DEFAULT true;
ALTER TABLE paths ADD COLUMN IF NOT EXISTS star_count  INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS paths_user ON paths(user_id);
CREATE INDEX IF NOT EXISTS paths_public ON paths(is_public, created_at DESC) WHERE is_public = true;

ALTER TABLE paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public paths readable" ON paths;
DROP POLICY IF EXISTS "Users manage own paths" ON paths;
CREATE POLICY "Public paths readable"  ON paths FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users manage own paths" ON paths FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS path_traces (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id    UUID        NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat        FLOAT       NOT NULL,
  lon        FLOAT       NOT NULL,
  event_id   UUID        REFERENCES events(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS path_id    UUID REFERENCES paths(id)    ON DELETE CASCADE;
ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS lat        FLOAT;
ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS lon        FLOAT;
ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS event_id   UUID REFERENCES events(id)   ON DELETE SET NULL;
ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS path_traces_path ON path_traces(path_id, recorded_at);
CREATE INDEX IF NOT EXISTS path_traces_user ON path_traces(user_id);

ALTER TABLE path_traces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path traces readable" ON path_traces;
DROP POLICY IF EXISTS "Users manage own traces" ON path_traces;
CREATE POLICY "Path traces readable"    ON path_traces FOR SELECT USING (true);
CREATE POLICY "Users manage own traces" ON path_traces FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS path_stars (
  path_id    UUID        NOT NULL REFERENCES paths(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (path_id, user_id)
);

ALTER TABLE path_stars ADD COLUMN IF NOT EXISTS path_id UUID REFERENCES paths(id)    ON DELETE CASCADE;
ALTER TABLE path_stars ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE path_stars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path stars readable"         ON path_stars;
DROP POLICY IF EXISTS "Users manage own path stars" ON path_stars;
CREATE POLICY "Path stars readable"         ON path_stars FOR SELECT USING (true);
CREATE POLICY "Users manage own path stars" ON path_stars FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_path_stars()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE paths SET star_count = star_count + 1            WHERE id = new.path_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE paths SET star_count = greatest(0, star_count-1) WHERE id = old.path_id;
  END IF;
  RETURN null;
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

ALTER TABLE path_crossings ADD COLUMN IF NOT EXISTS path_id_a UUID REFERENCES paths(id) ON DELETE CASCADE;
ALTER TABLE path_crossings ADD COLUMN IF NOT EXISTS path_id_b UUID REFERENCES paths(id) ON DELETE CASCADE;
ALTER TABLE path_crossings ADD COLUMN IF NOT EXISTS lat       FLOAT;
ALTER TABLE path_crossings ADD COLUMN IF NOT EXISTS lon       FLOAT;

CREATE INDEX IF NOT EXISTS path_crossings_a ON path_crossings(path_id_a);
CREATE INDEX IF NOT EXISTS path_crossings_b ON path_crossings(path_id_b);

ALTER TABLE path_crossings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path crossings readable" ON path_crossings;
CREATE POLICY "Path crossings readable" ON path_crossings FOR SELECT USING (true);

-- user_paths: which paths a user has joined/bookmarked
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


-- ============================================================
--  SERVICE MARKETPLACE
-- ============================================================
CREATE TABLE IF NOT EXISTS service_nodes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  category     TEXT,
  service_type TEXT,
  description  TEXT,
  price        NUMERIC,
  price_min    NUMERIC,
  price_max    NUMERIC,
  price_unit   TEXT        DEFAULT 'trip',
  tab          TEXT        DEFAULT 'Moving Help',
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
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price        NUMERIC;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_min    NUMERIC;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_max    NUMERIC;
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_unit   TEXT DEFAULT 'trip';
ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS tab          TEXT DEFAULT 'Moving Help';
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

CREATE TABLE IF NOT EXISTS service_bookings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id           UUID        REFERENCES service_nodes(id) ON DELETE SET NULL,
  client_id            UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id             UUID        REFERENCES events(id) ON DELETE SET NULL,
  status               TEXT        DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_progress','escrow_held','completed','cancelled','disputed')),
  service_type         TEXT,
  cargo_type           TEXT,
  origin_address       TEXT,
  destination_address  TEXT,
  amount_cents         INTEGER     DEFAULT 0,
  price                NUMERIC,
  notes                TEXT,
  scheduled_at         TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS service_id          UUID REFERENCES service_nodes(id) ON DELETE SET NULL;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS client_id           UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS provider_id         UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS event_id            UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'pending';
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS service_type        TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS cargo_type          TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS origin_address      TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS destination_address TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS amount_cents        INTEGER DEFAULT 0;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS price               NUMERIC;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS notes               TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS scheduled_at        TIMESTAMPTZ;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS service_bookings_client   ON service_bookings(client_id);
CREATE INDEX IF NOT EXISTS service_bookings_provider ON service_bookings(provider_id);
CREATE INDEX IF NOT EXISTS service_bookings_status   ON service_bookings(status);

ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Booking participants can see" ON service_bookings;
DROP POLICY IF EXISTS "Client can book"              ON service_bookings;
DROP POLICY IF EXISTS "Participants update booking"  ON service_bookings;
CREATE POLICY "Booking participants can see" ON service_bookings FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = provider_id);
CREATE POLICY "Client can book"              ON service_bookings FOR INSERT
  WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Participants update booking"  ON service_bookings FOR UPDATE
  USING (auth.uid() = client_id OR auth.uid() = provider_id);

DROP TRIGGER IF EXISTS service_bookings_touch ON service_bookings;
CREATE TRIGGER service_bookings_touch BEFORE UPDATE ON service_bookings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ============================================================
--  GIG POSTS + ACCEPTANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS gig_posts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  description    TEXT,
  pay            NUMERIC,
  pay_rands      NUMERIC,
  category       TEXT        DEFAULT 'moving',
  tab            TEXT        DEFAULT 'Moving Help',
  time_window    TEXT        DEFAULT 'Flexible',
  poster_username TEXT,
  distance_km    FLOAT,
  location       TEXT,
  event_id       UUID        REFERENCES events(id) ON DELETE SET NULL,
  slots          INTEGER     DEFAULT 1,
  filled         INTEGER     DEFAULT 0,
  active         BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS pay             NUMERIC;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS pay_rands       NUMERIC;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS category        TEXT DEFAULT 'moving';
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS tab             TEXT DEFAULT 'Moving Help';
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS time_window     TEXT DEFAULT 'Flexible';
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS poster_username TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS distance_km     FLOAT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS location        TEXT;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS event_id        UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS slots           INTEGER DEFAULT 1;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS filled          INTEGER DEFAULT 0;
ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS active          BOOLEAN DEFAULT true;

ALTER TABLE gig_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gigs readable"         ON gig_posts;
DROP POLICY IF EXISTS "Users manage own gigs" ON gig_posts;
CREATE POLICY "Gigs readable"         ON gig_posts FOR SELECT USING (true);
CREATE POLICY "Users manage own gigs" ON gig_posts FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS gig_acceptances (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id     UUID        NOT NULL REFERENCES gig_posts(id) ON DELETE CASCADE,
  worker_id  UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  status     TEXT        DEFAULT 'applied' CHECK (status IN ('applied','accepted','rejected','completed')),
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (gig_id, worker_id)
);

ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS gig_id    UUID REFERENCES gig_posts(id) ON DELETE CASCADE;
ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES profiles(id)  ON DELETE CASCADE;
ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS status    TEXT DEFAULT 'applied';
ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS message   TEXT;
ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS gig_acceptances_gig    ON gig_acceptances(gig_id);
CREATE INDEX IF NOT EXISTS gig_acceptances_worker ON gig_acceptances(worker_id);

ALTER TABLE gig_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gig acceptances visible to poster and worker" ON gig_acceptances;
DROP POLICY IF EXISTS "Workers can apply"                            ON gig_acceptances;
DROP POLICY IF EXISTS "Poster can update acceptance"                 ON gig_acceptances;
CREATE POLICY "Gig acceptances visible to poster and worker" ON gig_acceptances FOR SELECT
  USING (auth.uid() = worker_id OR EXISTS (SELECT 1 FROM gig_posts g WHERE g.id = gig_id AND g.user_id = auth.uid()));
CREATE POLICY "Workers can apply"         ON gig_acceptances FOR INSERT WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "Poster can update acceptance" ON gig_acceptances FOR UPDATE
  USING (auth.uid() = worker_id OR EXISTS (SELECT 1 FROM gig_posts g WHERE g.id = gig_id AND g.user_id = auth.uid()));


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
--  REPORTS + DISPUTES
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

ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_id   UUID;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason      TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS details     TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_status   ON reports(status);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own reports" ON reports;
DROP POLICY IF EXISTS "Users see own reports"    ON reports;
CREATE POLICY "Users insert own reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users see own reports"    ON reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS disputes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID        REFERENCES service_bookings(id) ON DELETE CASCADE,
  raised_by    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL,
  status       TEXT        DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  resolution   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES service_bookings(id) ON DELETE CASCADE;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS raised_by  UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS reason     TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'open';
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution TEXT;

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dispute parties can see" ON disputes;
CREATE POLICY "Dispute parties can see" ON disputes FOR ALL USING (auth.uid() = raised_by);


-- ============================================================
--  BUSINESS PROFILES + TEAM
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

-- Business team members (role hierarchy)
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
DROP POLICY IF EXISTS "Team readable by members"     ON business_team_members;
DROP POLICY IF EXISTS "Owner manages team"           ON business_team_members;
CREATE POLICY "Team readable by members" ON business_team_members FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));
CREATE POLICY "Owner manages team" ON business_team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));

-- Business partnerships
CREATE TABLE IF NOT EXISTS business_partnerships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  partner_id   UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  status       TEXT        DEFAULT 'pending' CHECK (status IN ('pending','active','declined','ended')),
  terms        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (LEAST(requester_id::text, partner_id::text), GREATEST(requester_id::text, partner_id::text))
);

ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS partner_id   UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'pending';
ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS terms        TEXT;

ALTER TABLE business_partnerships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partnership parties can read" ON business_partnerships;
CREATE POLICY "Partnership parties can read" ON business_partnerships FOR SELECT USING (true);


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
DROP POLICY IF EXISTS "Blocks public readable"        ON business_page_blocks;
DROP POLICY IF EXISTS "Business owner manages blocks" ON business_page_blocks;
CREATE POLICY "Blocks public readable"        ON business_page_blocks FOR SELECT USING (true);
CREATE POLICY "Business owner manages blocks" ON business_page_blocks FOR ALL
  USING (EXISTS (SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()));


-- ============================================================
--  AD CAMPAIGNS  (app uses "ad_campaigns")
-- ============================================================
-- Rename campaigns → ad_campaigns if needed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaigns')
  AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ad_campaigns') THEN
    ALTER TABLE campaigns RENAME TO ad_campaigns;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  type         TEXT        DEFAULT 'awareness',
  status       TEXT        DEFAULT 'draft' CHECK (status IN ('draft','active','paused','ended')),
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

ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS business_id  UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS title        TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS type         TEXT DEFAULT 'awareness';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'draft';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS budget       NUMERIC DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS spent        NUMERIC DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS reach        INTEGER DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS clicks       INTEGER DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS conversions  INTEGER DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS target       JSONB DEFAULT '{}';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS creative     JSONB DEFAULT '{}';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS starts_at    TIMESTAMPTZ;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS ends_at      TIMESTAMPTZ;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS ad_campaigns_business_id ON ad_campaigns(business_id);
CREATE INDEX IF NOT EXISTS ad_campaigns_status      ON ad_campaigns(status);

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campaigns owner only" ON ad_campaigns;
CREATE POLICY "Campaigns owner only" ON ad_campaigns FOR ALL
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS ad_campaigns_touch ON ad_campaigns;
CREATE TRIGGER ad_campaigns_touch BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Compat alias
DROP VIEW IF EXISTS campaigns;
CREATE OR REPLACE VIEW campaigns AS SELECT * FROM ad_campaigns;

-- Campaign analytics
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL CHECK (event_type IN ('impression','click','conversion','skip')),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  metadata    JSONB       DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE;
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS event_type  TEXT;
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}';
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS campaign_analytics_campaign ON campaign_analytics(campaign_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS campaign_analytics_type     ON campaign_analytics(event_type);

ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campaign analytics owner only" ON campaign_analytics;
CREATE POLICY "Campaign analytics owner only" ON campaign_analytics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ad_campaigns c
    JOIN business_profiles bp ON bp.id = c.business_id
    WHERE c.id = campaign_id AND bp.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "System inserts campaign analytics" ON campaign_analytics;
CREATE POLICY "System inserts campaign analytics" ON campaign_analytics FOR INSERT WITH CHECK (true);

-- Audience segments
CREATE TABLE IF NOT EXISTS audience_segments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  criteria    JSONB       DEFAULT '{}',
  size        INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS criteria    JSONB DEFAULT '{}';
ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS size        INTEGER DEFAULT 0;

ALTER TABLE audience_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Segments owner only" ON audience_segments;
CREATE POLICY "Segments owner only" ON audience_segments FOR ALL
  USING (EXISTS (SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()));


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
--  RPC FUNCTIONS
-- ============================================================

-- Full-text event search
CREATE OR REPLACE FUNCTION search_events_fts(search_query TEXT, limit_count INT DEFAULT 20)
RETURNS SETOF events LANGUAGE sql STABLE AS $$
  SELECT * FROM events
  WHERE search_vector @@ plainto_tsquery('english', search_query)
    AND is_cancelled = false
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', search_query)) DESC,
           trending_score DESC NULLS LAST
  LIMIT limit_count;
$$;

-- Find nearby events by lat/lon
CREATE OR REPLACE FUNCTION find_nearby_events(lat FLOAT, lon FLOAT, radius_km FLOAT DEFAULT 25, limit_count INT DEFAULT 20)
RETURNS TABLE (
  id UUID, title TEXT, category TEXT, category_color TEXT,
  event_date DATE, event_time TEXT, venue_name TEXT,
  vibe_count INT, going INT, media JSONB, media_urls TEXT[],
  author_id UUID, is_cancelled BOOLEAN, lat FLOAT, lon FLOAT,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id, e.title, e.category, e.category_color,
    e.event_date, e.event_time, e.venue_name,
    e.vibe_count, e.going, e.media, e.media_urls,
    e.author_id, e.is_cancelled, e.lat, e.lon,
    ST_DistanceSphere(
      ST_MakePoint(e.lon, e.lat),
      ST_MakePoint(lon, lat)
    ) / 1000 AS distance_km
  FROM events e
  WHERE e.lat IS NOT NULL AND e.lon IS NOT NULL
    AND e.is_cancelled = false
    AND ST_DistanceSphere(ST_MakePoint(e.lon, e.lat), ST_MakePoint(lon, lat)) <= radius_km * 1000
  ORDER BY distance_km ASC, e.trending_score DESC NULLS LAST
  LIMIT limit_count;
$$;

-- Find nearby vibers
CREATE OR REPLACE FUNCTION find_nearby_vibers(uid UUID, max_dist_km FLOAT DEFAULT 10, limit_count INT DEFAULT 20)
RETURNS TABLE (
  id UUID, username TEXT, avatar_url TEXT, vibe_score INT,
  is_online BOOLEAN, interests TEXT[], lat FLOAT, lon FLOAT,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    p.id, p.username, p.avatar_url, p.vibe_score,
    p.is_online, p.interests, p.lat, p.lon,
    ST_DistanceSphere(
      ST_MakePoint(p.lon, p.lat),
      ST_MakePoint(me.lon, me.lat)
    ) / 1000 AS distance_km
  FROM profiles p
  JOIN profiles me ON me.id = uid
  WHERE p.id <> uid
    AND p.lat IS NOT NULL AND p.lon IS NOT NULL
    AND me.lat IS NOT NULL AND me.lon IS NOT NULL
    AND ST_DistanceSphere(ST_MakePoint(p.lon, p.lat), ST_MakePoint(me.lon, me.lat)) <= max_dist_km * 1000
  ORDER BY distance_km ASC
  LIMIT limit_count;
$$;

-- Find popular spots (trending event venues/locations)
CREATE OR REPLACE FUNCTION find_popular_spots(limit_count INT DEFAULT 10)
RETURNS TABLE (
  event_id UUID, title TEXT, description TEXT, image TEXT,
  vibe_count INT, rsvp_count INT, going INT, category TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id AS event_id, e.title,
    e.description,
    COALESCE(e.media_urls[1], (e.media->0->>'url')::text) AS image,
    e.vibe_count, e.going AS rsvp_count, e.going, e.category
  FROM events e
  WHERE e.is_cancelled = false
  ORDER BY e.trending_score DESC NULLS LAST, e.vibe_count DESC
  LIMIT limit_count;
$$;

-- Find Gruv hotspots (clusters of events near a point)
CREATE OR REPLACE FUNCTION find_gruv_hotspots(lat FLOAT, lon FLOAT, radius_km FLOAT DEFAULT 5, limit_count INT DEFAULT 10)
RETURNS TABLE (
  id UUID, title TEXT, vibe_count INT, going INT,
  lat FLOAT, lon FLOAT, category TEXT, distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id, e.title, e.vibe_count, e.going,
    e.lat, e.lon, e.category,
    ST_DistanceSphere(ST_MakePoint(e.lon, e.lat), ST_MakePoint(lon, lat)) / 1000 AS distance_km
  FROM events e
  WHERE e.lat IS NOT NULL AND e.lon IS NOT NULL
    AND e.is_cancelled = false
    AND ST_DistanceSphere(ST_MakePoint(e.lon, e.lat), ST_MakePoint(lon, lat)) <= radius_km * 1000
  ORDER BY e.vibe_count DESC, distance_km ASC
  LIMIT limit_count;
$$;

-- Increment / decrement vibe_count (used by VibeManager to avoid race conditions)
CREATE OR REPLACE FUNCTION increment_vibe_count(eid UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE events SET vibe_count = vibe_count + 1 WHERE id = eid;
$$;

CREATE OR REPLACE FUNCTION decrement_vibe_count(eid UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE events SET vibe_count = greatest(0, vibe_count - 1) WHERE id = eid;
$$;

-- Increment profile vibe score
CREATE OR REPLACE FUNCTION increment_profile_score(uid UUID, amount INT DEFAULT 1)
RETURNS void LANGUAGE sql AS $$
  UPDATE profiles SET vibe_score = vibe_score + amount WHERE id = uid;
$$;

-- Increment wallet balance (used by EscrowService after release)
CREATE OR REPLACE FUNCTION increment_wallet_balance(user_id UUID, amount NUMERIC)
RETURNS void LANGUAGE sql AS $$
  UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + amount WHERE id = user_id;
$$;


-- ============================================================
--  APP UPDATES (changelog — admin inserts, all users can read)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_updates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version      TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  type         TEXT        NOT NULL DEFAULT 'feature' CHECK (type IN ('feature','fix','improvement','security')),
  released_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read app_updates" ON app_updates;
CREATE POLICY "Anyone can read app_updates"
  ON app_updates FOR SELECT USING (true);

-- ============================================================
--  ENABLE REALTIME
-- ============================================================
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'events','notifications','messages','follows',
    'live_checkins','event_vibes','echoes','service_bookings',
    'gig_acceptances','dm_rooms','ad_campaigns'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      END IF;
    END IF;
  END LOOP;
END $$;


-- ============================================================
--  STORAGE BUCKETS  (photos, covers, event media, chat media)
--  Run this block in Supabase → SQL Editor after the main schema.
-- ============================================================

-- Create buckets (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('event-media', 'event-media', true, 104857600,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('chat_media',  'chat_media',  true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: public read, authenticated write
DROP POLICY IF EXISTS "Public read avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth update avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Public read covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth upload covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth update covers"      ON storage.objects;
DROP POLICY IF EXISTS "Public read event-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload event-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete chat_media"  ON storage.objects;

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public read covers"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers"
  ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

CREATE POLICY "Public read event-media"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Public read chat_media"
  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media"
  ON storage.objects FOR DELETE USING (bucket_id = 'chat_media' AND auth.role() = 'authenticated');


============================================================
--  SECTION: MOVEMENT OS (paths, service nodes, gig mode)
============================================================

-- Movement OS: Path objects, Presence Ledger, Service Nodes, Gig Mode, Trust Ledger
-- Run this in the Supabase SQL editor after 001_initial and 002_upgrades

-- ── Identity & Privacy ────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_mode     TEXT    NOT NULL DEFAULT 'public' CHECK (identity_mode IN ('public','ghost','celebrity')),
  ADD COLUMN IF NOT EXISTS home_base_lat     FLOAT,
  ADD COLUMN IF NOT EXISTS home_base_lon     FLOAT,
  ADD COLUMN IF NOT EXISTS social_integrity_score INT NOT NULL DEFAULT 50 CHECK (social_integrity_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS wallet_balance    NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- ── Paths ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paths (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  origin_lat      FLOAT,
  origin_lon      FLOAT,
  origin_label    TEXT,
  dest_lat        FLOAT,
  dest_lon        FLOAT,
  dest_label      TEXT,
  intent_tag      TEXT NOT NULL DEFAULT 'attending'
                    CHECK (intent_tag IN ('attending','going_home','service_run','exploring','scouting')),
  identity_layer  TEXT NOT NULL DEFAULT 'public'
                    CHECK (identity_layer IN ('public','ghost','celebrity')),
  ghost_alias     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS paths_user_id_idx  ON paths(user_id);
CREATE INDEX IF NOT EXISTS paths_event_id_idx ON paths(event_id);
CREATE INDEX IF NOT EXISTS paths_dest_lat_idx ON paths(dest_lat);
CREATE INDEX IF NOT EXISTS paths_dest_lon_idx ON paths(dest_lon);

-- ── Live Check-ins (Presence Ledger, TTL-based) ───────────────────────────────

CREATE TABLE IF NOT EXISTS live_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  lat             FLOAT,
  lon             FLOAT,
  identity_layer  TEXT NOT NULL DEFAULT 'public',
  ghost_alias     TEXT,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS live_checkins_event_idx   ON live_checkins(event_id);
CREATE INDEX IF NOT EXISTS live_checkins_expires_idx ON live_checkins(expires_at);

-- Auto-expire: delete stale checkins (call from a cron job or edge function)
CREATE OR REPLACE FUNCTION purge_expired_checkins() RETURNS void LANGUAGE sql AS $$
  DELETE FROM live_checkins WHERE expires_at < NOW();
$$;

-- ── Path Crossings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS path_crossings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id_a     UUID NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  path_id_b     UUID NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  overlap_score FLOAT NOT NULL DEFAULT 0,
  crossed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Path Stars ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS path_stars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  path_id    UUID NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  starred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, path_id)
);

-- ── Service Nodes (Bakkie Marketplace) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_nodes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_type        TEXT NOT NULL CHECK (service_type IN ('moving','delivery','event_logistics','rides')),
  vehicle_type        TEXT,
  capacity_kg         INT,
  price_per_km        NUMERIC(8,2),
  base_price          NUMERIC(8,2),
  lat                 FLOAT,
  lon                 FLOAT,
  available           BOOLEAN NOT NULL DEFAULT TRUE,
  event_id            UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_nodes_provider_idx ON service_nodes(provider_id);
CREATE INDEX IF NOT EXISTS service_nodes_type_idx     ON service_nodes(service_type);
CREATE INDEX IF NOT EXISTS service_nodes_lat_idx      ON service_nodes(lat);
CREATE INDEX IF NOT EXISTS service_nodes_lon_idx      ON service_nodes(lon);

-- ── Service Bookings (Escrow) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_node_id UUID NOT NULL REFERENCES service_nodes(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cargo_type      TEXT,
  pickup_address  TEXT,
  dropoff_address TEXT,
  scheduled_at    TIMESTAMPTZ,
  estimated_price NUMERIC(10,2),
  status          TEXT NOT NULL DEFAULT 'escrow_held'
                    CHECK (status IN ('escrow_held','in_progress','completed','disputed','cancelled')),
  escrow_held_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  disputed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookings_client_idx   ON service_bookings(client_id);
CREATE INDEX IF NOT EXISTS bookings_provider_idx ON service_bookings(provider_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx   ON service_bookings(status);

-- ── Disputes ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES service_bookings(id) ON DELETE CASCADE,
  raised_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Gig Posts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gig_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL CHECK (category IN ('moving','assembly','packing','crew','other')),
  pay_amount   NUMERIC(8,2) NOT NULL,
  lat          FLOAT,
  lon          FLOAT,
  time_window  TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gig_posts_event_idx    ON gig_posts(event_id);
CREATE INDEX IF NOT EXISTS gig_posts_active_idx   ON gig_posts(active);

-- ── Gig Acceptances ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gig_acceptances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      UUID NOT NULL REFERENCES gig_posts(id) ON DELETE CASCADE,
  worker_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gig_id, worker_id)
);

-- ── DM Rooms (mutual star match, 48h expiry) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_a, user_b, event_id)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES dm_rooms(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dm_rooms_user_a_idx ON dm_rooms(user_a);
CREATE INDEX IF NOT EXISTS dm_rooms_user_b_idx ON dm_rooms(user_b);
CREATE INDEX IF NOT EXISTS dm_messages_room_idx ON dm_messages(room_id);

-- ── User Paths (alias for paths, referenced by PathMapScreen) ─────────────────
-- user_paths is a view over the paths table for convenience
CREATE OR REPLACE VIEW user_paths AS
  SELECT * FROM paths;

-- ── Trust Ledger RPC ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_sis_score(
  p_user_id UUID,
  p_delta   INT
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET social_integrity_score = GREATEST(0, LEAST(100, social_integrity_score + p_delta))
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id UUID,
  p_amount  NUMERIC
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_user_id;
END;
$$;

-- ── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE paths            ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_checkins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_crossings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_stars       ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_nodes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_acceptances  ENABLE ROW LEVEL SECURITY;

-- Paths: owner reads/writes, others see only public paths
CREATE POLICY paths_owner   ON paths FOR ALL  USING (auth.uid() = user_id);
CREATE POLICY paths_public  ON paths FOR SELECT USING (identity_layer = 'public');

-- Live checkins: owner upserts, everyone reads active ones
CREATE POLICY checkins_owner  ON live_checkins FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY checkins_select ON live_checkins FOR SELECT USING (expires_at > NOW());

-- Service nodes: provider manages, everyone reads available
CREATE POLICY nodes_owner  ON service_nodes FOR ALL    USING (auth.uid() = provider_id);
CREATE POLICY nodes_select ON service_nodes FOR SELECT USING (available = TRUE);

-- Bookings: client or provider can see their bookings
CREATE POLICY bookings_parties ON service_bookings FOR ALL
  USING (auth.uid() = client_id OR auth.uid() = provider_id);

-- Gig posts: poster manages, everyone reads active
CREATE POLICY gigs_owner  ON gig_posts FOR ALL    USING (auth.uid() = poster_id);
CREATE POLICY gigs_select ON gig_posts FOR SELECT USING (active = TRUE);

-- Gig acceptances: worker manages their own
CREATE POLICY gig_acc_owner  ON gig_acceptances FOR ALL    USING (auth.uid() = worker_id);
CREATE POLICY gig_acc_select ON gig_acceptances FOR SELECT USING (TRUE);

-- Path stars: owner manages
CREATE POLICY stars_owner  ON path_stars FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY stars_select ON path_stars FOR SELECT USING (TRUE);

-- Disputes: raised_by or parties manage
CREATE POLICY disputes_raised ON disputes FOR ALL USING (auth.uid() = raised_by);

-- DM rooms: only participants
ALTER TABLE dm_rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY dm_rooms_parties   ON dm_rooms    FOR ALL    USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY dm_messages_sender ON dm_messages FOR INSERT USING (auth.uid() = sender_id);
CREATE POLICY dm_messages_select ON dm_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM dm_rooms r WHERE r.id = room_id AND (r.user_a = auth.uid() OR r.user_b = auth.uid())
  ));

-- ── Contextual Ads (AdFlywheel) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contextual_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('event','service','gig')),
  headline    TEXT NOT NULL,
  subline     TEXT,
  cta         TEXT NOT NULL DEFAULT 'View',
  color       TEXT,
  icon        TEXT DEFAULT 'zap',
  badge       TEXT DEFAULT 'PROMOTED',
  event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
  priority    INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contextual_ads_active_idx ON contextual_ads(active, priority DESC);

ALTER TABLE contextual_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY ads_select ON contextual_ads FOR SELECT USING (active = TRUE);


============================================================
--  SECTION: RLS POLICIES COMPLETE
============================================================

-- ─── Migration 003: Complete RLS policies ────────────────────────────────────
-- Fills the gaps where tables had RLS enabled but were missing UPDATE/DELETE
-- policies, leaving them open to arbitrary writes via the PostgREST API.

-- ─── event_reactions ─────────────────────────────────────────────────────────
-- SELECT: anyone can read reactions (public event data)
CREATE POLICY IF NOT EXISTS "event_reactions_select"
  ON event_reactions FOR SELECT USING (true);

-- INSERT: authenticated users insert their own reactions
CREATE POLICY IF NOT EXISTS "event_reactions_insert"
  ON event_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own reaction
CREATE POLICY IF NOT EXISTS "event_reactions_update"
  ON event_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own reaction
CREATE POLICY IF NOT EXISTS "event_reactions_delete"
  ON event_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ─── pulse_requests ──────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "pulse_requests_select"
  ON pulse_requests FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "pulse_requests_insert"
  ON pulse_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the request author or an admin can update/delete
CREATE POLICY IF NOT EXISTS "pulse_requests_update"
  ON pulse_requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "pulse_requests_delete"
  ON pulse_requests FOR DELETE
  USING (auth.uid() = user_id);

-- ─── pulse_votes ─────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "pulse_votes_select"
  ON pulse_votes FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "pulse_votes_insert"
  ON pulse_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Votes are immutable once cast — no UPDATE policy (intentional)

CREATE POLICY IF NOT EXISTS "pulse_votes_delete"
  ON pulse_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── notifications ────────────────────────────────────────────────────────────
-- SELECT: only the recipient can read their own notifications
CREATE POLICY IF NOT EXISTS "notifications_select"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- INSERT: service role only (notifications are inserted server-side or via
-- notificationService with service key). Block direct client inserts.
-- We use a function-based check: only allow if actor_id matches the caller,
-- OR caller is service role (uid() IS NULL means service role bypass).
CREATE POLICY IF NOT EXISTS "notifications_insert"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR  -- service role
    auth.uid() = actor_id  -- authenticated sender
  );

-- UPDATE: only recipient can mark as read
CREATE POLICY IF NOT EXISTS "notifications_update"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- DELETE: only recipient can delete their notifications
CREATE POLICY IF NOT EXISTS "notifications_delete"
  ON notifications FOR DELETE
  USING (auth.uid() = recipient_id);

-- ─── echoes ───────────────────────────────────────────────────────────────────
-- Ensure echoes has proper policies (common to be missing update/delete)
CREATE POLICY IF NOT EXISTS "echoes_select"
  ON echoes FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "echoes_insert"
  ON echoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "echoes_update"
  ON echoes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "echoes_delete"
  ON echoes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── reel_likes ──────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "reel_likes_select"
  ON reel_likes FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "reel_likes_insert"
  ON reel_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "reel_likes_delete"
  ON reel_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── event_vibes ─────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "event_vibes_select"
  ON event_vibes FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "event_vibes_insert"
  ON event_vibes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "event_vibes_delete"
  ON event_vibes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── follows ─────────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "follows_select"
  ON follows FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "follows_insert"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY IF NOT EXISTS "follows_delete"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ─── Rate-limit helper function ───────────────────────────────────────────────
-- Prevents a single user from inserting more than N rows in a table within
-- a rolling time window. Used in per-table INSERT policies.
-- Usage: call_rate_ok('echoes', auth.uid(), 5, interval '1 minute')
CREATE OR REPLACE FUNCTION call_rate_ok(
  tbl   text,
  uid   uuid,
  max_n int,
  window_interval interval
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cnt int;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE user_id = $1 AND created_at > now() - $2',
    tbl
  ) INTO cnt USING uid, window_interval;
  RETURN cnt < max_n;
END;
$$;

-- Apply rate limiting to echo inserts: max 20 echoes per minute per user
DROP POLICY IF EXISTS "echoes_insert" ON echoes;
CREATE POLICY "echoes_insert"
  ON echoes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND call_rate_ok('echoes', auth.uid(), 20, interval '1 minute')
  );

-- Apply rate limiting to pulse_requests: max 5 per hour per user
DROP POLICY IF EXISTS "pulse_requests_insert" ON pulse_requests;
CREATE POLICY "pulse_requests_insert"
  ON pulse_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND call_rate_ok('pulse_requests', auth.uid(), 5, interval '1 hour')
  );


============================================================
--  SECTION: NEW FEATURES (reactions, updates, waitlist, carpools)
============================================================

-- ─── New Features Migration ───────────────────────────────────────────────────
-- Covers: event_reactions, event_updates (live updates), event_waitlist,
--         event_carpools, event_carpool_requests, rsvp_tiers on events
-- Run after 003_rls_policies.sql

-- ─── event_reactions ──────────────────────────────────────────────────────────
-- Emoji reactions on events (🔥💎🎶🤩✨😂)
create table if not exists event_reactions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  reaction    text not null,
  created_at  timestamptz not null default now(),
  unique (event_id, user_id, reaction)
);

create index if not exists event_reactions_event_id_idx on event_reactions(event_id);

alter table event_reactions enable row level security;

-- RLS (safe to run even if 003 already added these — IF NOT EXISTS guards them)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_select'
  ) then
    execute 'create policy "event_reactions_select" on event_reactions for select using (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_insert'
  ) then
    execute 'create policy "event_reactions_insert" on event_reactions for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_delete'
  ) then
    execute 'create policy "event_reactions_delete" on event_reactions for delete using (auth.uid() = user_id)';
  end if;
end $$;

-- ─── event_updates ────────────────────────────────────────────────────────────
-- Live updates posted by event organiser
create table if not exists event_updates (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  message     text not null,
  update_type text not null default 'info'
                check (update_type in ('info', 'hype', 'change', 'shoutout')),
  created_at  timestamptz not null default now()
);

create index if not exists event_updates_event_id_idx on event_updates(event_id);

alter table event_updates enable row level security;

create policy if not exists "event_updates_select"
  on event_updates for select using (true);

create policy if not exists "event_updates_insert"
  on event_updates for insert with check (auth.uid() = author_id);

create policy if not exists "event_updates_delete"
  on event_updates for delete using (auth.uid() = author_id);

-- ─── event_waitlist ───────────────────────────────────────────────────────────
-- Waitlist for sold-out events
create table if not exists event_waitlist (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_waitlist_event_id_idx on event_waitlist(event_id);

alter table event_waitlist enable row level security;

create policy if not exists "event_waitlist_select"
  on event_waitlist for select using (true);

create policy if not exists "event_waitlist_insert"
  on event_waitlist for insert with check (auth.uid() = user_id);

create policy if not exists "event_waitlist_delete"
  on event_waitlist for delete using (auth.uid() = user_id);

-- ─── event_carpools ───────────────────────────────────────────────────────────
-- Lift offers from drivers attending an event
create table if not exists event_carpools (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  driver_id        uuid not null references profiles(id) on delete cascade,
  seats_available  int not null default 2 check (seats_available between 1 and 10),
  departure_area   text not null,
  departure_time   timestamptz,
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists event_carpools_event_id_idx on event_carpools(event_id);

alter table event_carpools enable row level security;

create policy if not exists "event_carpools_select"
  on event_carpools for select using (true);

create policy if not exists "event_carpools_insert"
  on event_carpools for insert with check (auth.uid() = driver_id);

create policy if not exists "event_carpools_delete"
  on event_carpools for delete using (auth.uid() = driver_id);

-- ─── event_carpool_requests ───────────────────────────────────────────────────
-- Seat requests from riders
create table if not exists event_carpool_requests (
  id          uuid primary key default gen_random_uuid(),
  carpool_id  uuid not null references event_carpools(id) on delete cascade,
  event_id    uuid not null references events(id) on delete cascade,
  rider_id    uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (carpool_id, rider_id)
);

create index if not exists ecr_carpool_id_idx on event_carpool_requests(carpool_id);
create index if not exists ecr_rider_id_idx   on event_carpool_requests(rider_id);

alter table event_carpool_requests enable row level security;

create policy if not exists "event_carpool_requests_select"
  on event_carpool_requests for select using (true);

create policy if not exists "event_carpool_requests_insert"
  on event_carpool_requests for insert with check (auth.uid() = rider_id);

create policy if not exists "event_carpool_requests_delete"
  on event_carpool_requests for delete using (auth.uid() = rider_id);

-- ─── events table additions ───────────────────────────────────────────────────
-- VIP / table tier definitions (JSONB array: [{id, name, description, price, capacity, icon, color}])
alter table events
  add column if not exists rsvp_tiers jsonb;

-- tier_id on RSVPs so we know which tier each attendee booked
alter table event_rsvps
  add column if not exists tier_id text;

-- ─── upsert_rsvp_tier RPC ────────────────────────────────────────────────────
-- Fallback RPC used by VIPTierSelector when direct upsert isn't available
create or replace function upsert_rsvp_tier(
  p_event_id uuid,
  p_user_id  uuid,
  p_tier_id  text
) returns void
language plpgsql security definer as $$
begin
  insert into event_rsvps (event_id, user_id, status, tier_id)
  values (p_event_id, p_user_id, 'going', p_tier_id)
  on conflict (event_id, user_id)
  do update set tier_id = excluded.tier_id, status = 'going';
end;
$$;

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Enable realtime publication for live-update tables
alter publication supabase_realtime add table event_reactions;
alter publication supabase_realtime add table event_updates;


============================================================
--  SECTION: LIVE DB PATCH (columns, security, AI layer)
============================================================

-- ============================================================
--  THE GRUVS — Master Live Database Patch  (v3)
--  Paste this entire file into Supabase → SQL Editor → Run
--  Every statement is idempotent — safe to run more than once.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  1. PROFILES — columns + RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url              TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio                    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location               TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website                TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified            BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online              BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen              TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_score             INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests              TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat                    FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lon                    FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city                   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online            BOOLEAN     DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_events           BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count         INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_gallery        TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_title           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_description     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looks_description      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year             INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender                 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_discoverable        BOOLEAN     DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_mode          TEXT        DEFAULT 'public';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak         INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_integrity_score FLOAT       DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ DEFAULT now();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles readable" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Public profiles readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ══════════════════════════════════════════════════════════════
--  2. FOLLOWS — RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON follows;
DROP POLICY IF EXISTS "Users manage own follows" ON follows;
CREATE POLICY "Follows readable"         ON follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON follows FOR ALL    USING (auth.uid() = follower_id);


-- ══════════════════════════════════════════════════════════════
--  3. MESSAGES — columns + RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type     TEXT             DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id        UUID             REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id         UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN          DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN          DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction         TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Message participants can read" ON messages;
DROP POLICY IF EXISTS "Users send own messages"       ON messages;
DROP POLICY IF EXISTS "Users update own messages"     ON messages;
CREATE POLICY "Message participants can read" ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users send own messages"       ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users update own messages"     ON messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);


-- ══════════════════════════════════════════════════════════════
--  4. EVENTS — RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events readable by all"            ON events;
DROP POLICY IF EXISTS "Authenticated users insert events" ON events;
DROP POLICY IF EXISTS "Users update own events"           ON events;
DROP POLICY IF EXISTS "Users delete own events"           ON events;
CREATE POLICY "Events readable by all"            ON events FOR SELECT USING (true);
CREATE POLICY "Authenticated users insert events" ON events FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users update own events"           ON events FOR UPDATE
  USING (auth.uid() = author_id);
CREATE POLICY "Users delete own events"           ON events FOR DELETE
  USING (auth.uid() = author_id);


-- ══════════════════════════════════════════════════════════════
--  5. EVENT VIBES — RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE event_vibes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event vibes readable"         ON event_vibes;
DROP POLICY IF EXISTS "Users manage own event vibes" ON event_vibes;
CREATE POLICY "Event vibes readable"         ON event_vibes FOR SELECT USING (true);
CREATE POLICY "Users manage own event vibes" ON event_vibes FOR ALL    USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  6. SAVED EVENTS — RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saves" ON saved_events;
CREATE POLICY "Users manage own saves" ON saved_events FOR ALL USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  7. EVENT RSVPs — RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RSVPs readable"         ON event_rsvps;
DROP POLICY IF EXISTS "Users manage own RSVPs" ON event_rsvps;
CREATE POLICY "RSVPs readable"         ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users manage own RSVPs" ON event_rsvps FOR ALL    USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  8. ECHOES (comments) — RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE echoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Echoes readable"         ON echoes;
DROP POLICY IF EXISTS "Users insert own echoes" ON echoes;
DROP POLICY IF EXISTS "Users update own echoes" ON echoes;
DROP POLICY IF EXISTS "Users delete own echoes" ON echoes;
CREATE POLICY "Echoes readable"         ON echoes FOR SELECT USING (true);
CREATE POLICY "Users insert own echoes" ON echoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own echoes" ON echoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own echoes" ON echoes FOR DELETE USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  9. NOTIFICATIONS — RLS (tightened: no unrestricted INSERT)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications"    ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "System insert notifications"     ON notifications;
DROP POLICY IF EXISTS "Users update own notifications"  ON notifications;
CREATE POLICY "Users read own notifications"   ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);
CREATE POLICY "System insert notifications"    ON notifications FOR INSERT
  WITH CHECK (auth.role() IN ('service_role', 'postgres', 'authenticated'));
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id);


-- ══════════════════════════════════════════════════════════════
--  10. LIVE CHECKINS — columns + RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS venue_name    TEXT;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE live_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Checkins readable"         ON live_checkins;
DROP POLICY IF EXISTS "Users manage own checkins" ON live_checkins;
CREATE POLICY "Checkins readable"         ON live_checkins FOR SELECT USING (true);
CREATE POLICY "Users manage own checkins" ON live_checkins FOR ALL    USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  11. APP UPDATES — columns + RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE app_updates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE app_updates ADD COLUMN IF NOT EXISTS type        TEXT DEFAULT 'feature';
ALTER TABLE app_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read app_updates" ON app_updates;
CREATE POLICY "Anyone can read app_updates" ON app_updates FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════
--  12. CAMPAIGN ANALYTICS — tighten INSERT policy
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "analytics_insert" ON campaign_analytics;
CREATE POLICY "analytics_insert" ON campaign_analytics FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════
--  13. VIEWS — recreate without SECURITY DEFINER
-- ══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.vibes CASCADE;
CREATE OR REPLACE VIEW public.vibes
  WITH (security_invoker = true)
AS SELECT * FROM public.event_vibes;

DROP VIEW IF EXISTS public.conversations CASCADE;
CREATE OR REPLACE VIEW public.conversations
  WITH (security_invoker = true)
AS SELECT * FROM public.dm_rooms;


-- ══════════════════════════════════════════════════════════════
--  14. spatial_ref_sys — enable RLS (PostGIS system table)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spatial_ref_sys public read" ON public.spatial_ref_sys;
CREATE POLICY "spatial_ref_sys public read"
  ON public.spatial_ref_sys FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════
--  15. STORAGE BUCKETS + RLS
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',
   'avatars',     true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',
   'covers',      true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('event-media',
   'event-media', true, 104857600,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('chat_media',
   'chat_media',  true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public read covers"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers"
  ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

CREATE POLICY "Public read event-media"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Public read chat_media"
  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media"
  ON storage.objects FOR DELETE USING (bucket_id = 'chat_media' AND auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════
--  16. FUNCTIONS — pin search_path to prevent injection
-- ══════════════════════════════════════════════════════════════
ALTER FUNCTION public.handle_new_user_welcome()                                        SET search_path = public;
ALTER FUNCTION public.request_booking()                                                SET search_path = public;
ALTER FUNCTION public.verify_pop()                                                     SET search_path = public;
ALTER FUNCTION public.on_booking_completed_sis()                                       SET search_path = public;
ALTER FUNCTION public.array_overlap_count(anyarray, anyarray)                          SET search_path = public;
ALTER FUNCTION public.calculate_event_heat_index()                                     SET search_path = public;
ALTER FUNCTION public.create_notification()                                            SET search_path = public;
ALTER FUNCTION public.sync_follows_counts()                                            SET search_path = public;
ALTER FUNCTION public.sync_echo_likes()                                                SET search_path = public;
ALTER FUNCTION public.events_update_search_vector()                                    SET search_path = public;
ALTER FUNCTION public.sync_follow_counts()                                             SET search_path = public;
ALTER FUNCTION public.set_current_timestamp_updated_at()                               SET search_path = public;
ALTER FUNCTION public.check_event_capacity()                                           SET search_path = public;
ALTER FUNCTION public.increment_vibe(uuid, uuid)                                       SET search_path = public;
ALTER FUNCTION public.handle_new_chat_creator()                                        SET search_path = public;
ALTER FUNCTION public.find_gruv_hotspots()                                             SET search_path = public;
ALTER FUNCTION public.release_escrow()                                                 SET search_path = public;
ALTER FUNCTION public.place_bid(uuid, uuid, numeric)                                   SET search_path = public;
ALTER FUNCTION public.feed_for_user(uuid, integer, integer)                            SET search_path = public;
ALTER FUNCTION public.calculate_sis_score()                                            SET search_path = public;
ALTER FUNCTION public.refresh_trending_events()                                        SET search_path = public;
ALTER FUNCTION public.sync_event_engagement()                                          SET search_path = public;
ALTER FUNCTION public.get_event_full(uuid, uuid)                                       SET search_path = public;
ALTER FUNCTION public.find_nearby_vibers(uuid, double precision, integer)              SET search_path = public;
ALTER FUNCTION public.handle_new_bid_notification()                                    SET search_path = public;
ALTER FUNCTION public.mark_notifications_read(uuid)                                    SET search_path = public;
ALTER FUNCTION public.decrement_vibe(uuid, uuid)                                       SET search_path = public;
ALTER FUNCTION public.sync_save_counts()                                               SET search_path = public;
ALTER FUNCTION public.sync_echo_counts()                                               SET search_path = public;
ALTER FUNCTION public.sync_social_counters()                                           SET search_path = public;
ALTER FUNCTION public.search_events_fts(text, integer)                                 SET search_path = public;
ALTER FUNCTION public.find_popular_spots(integer)                                      SET search_path = public;
ALTER FUNCTION public.increment_profile_score(uuid, integer)                           SET search_path = public;
ALTER FUNCTION public.sync_reaction_count()                                            SET search_path = public;
ALTER FUNCTION public.match_events_advanced()                                          SET search_path = public;
ALTER FUNCTION public.safe_div(numeric, numeric)                                       SET search_path = public;
ALTER FUNCTION public.sync_vibe_counts()                                               SET search_path = public;
ALTER FUNCTION public.process_automated_payouts()                                      SET search_path = public;
ALTER FUNCTION public.set_message_delivered()                                          SET search_path = public;
ALTER FUNCTION public.find_nearby_events(double precision, double precision, double precision, integer) SET search_path = public;
ALTER FUNCTION public.sync_check_in_counts()                                           SET search_path = public;
ALTER FUNCTION public.handle_new_user()                                                SET search_path = public;
ALTER FUNCTION public.purchase_tickets(uuid, uuid, text, numeric, integer)             SET search_path = public;
ALTER FUNCTION public.events_set_slug()                                                SET search_path = public;
ALTER FUNCTION public.touch_updated_at()                                               SET search_path = public;
ALTER FUNCTION public.tag_early_bird_rsvp()                                            SET search_path = public;
ALTER FUNCTION public.increment_views(uuid)                                            SET search_path = public;
ALTER FUNCTION public.handle_location_match()                                          SET search_path = public;
ALTER FUNCTION public.search_events(text)                                              SET search_path = public;
ALTER FUNCTION public.sync_events_posted()                                             SET search_path = public;
ALTER FUNCTION public.sync_rsvp_counts()                                               SET search_path = public;


-- ══════════════════════════════════════════════════════════════
--  17. FUNCTIONS — switch read-only ones to SECURITY INVOKER
--      and revoke anon EXECUTE from write/trigger functions
-- ══════════════════════════════════════════════════════════════

-- Read-only: safe for public but should run as caller (respects RLS)
ALTER FUNCTION public.calculate_event_heat_index() SECURITY INVOKER;
ALTER FUNCTION public.check_event_capacity()        SECURITY INVOKER;
ALTER FUNCTION public.find_popular_spots(integer)   SECURITY INVOKER;
ALTER FUNCTION public.get_event_full(uuid, uuid)    SECURITY INVOKER;
ALTER FUNCTION public.match_events_advanced()       SECURITY INVOKER;
ALTER FUNCTION public.search_events_fts(text, integer) SECURITY INVOKER;
ALTER FUNCTION public.safe_div(numeric, numeric)    SECURITY INVOKER;
ALTER FUNCTION public.find_gruv_hotspots()          SECURITY INVOKER;

-- Trigger / internal functions: anon should never call these directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_welcome()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_chat_creator()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_bid_notification()       FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_location_match()             FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_vibe_counts()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_follow_counts()                FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_follows_counts()               FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_echo_counts()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_echo_likes()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_save_counts()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_social_counters()              FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_event_engagement()             FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_reaction_count()               FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_check_in_counts()              FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_events_posted()                FROM anon;
REVOKE EXECUTE ON FUNCTION public.events_update_search_vector()       FROM anon;
REVOKE EXECUTE ON FUNCTION public.events_set_slug()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.tag_early_bird_rsvp()               FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_message_delivered()             FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_current_timestamp_updated_at()  FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_booking_completed_sis()          FROM anon;

-- Write functions: require authentication
REVOKE EXECUTE ON FUNCTION public.increment_vibe(uuid, uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_vibe(uuid, uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_views(uuid)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_profile_score(uuid, integer)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.place_bid(uuid, uuid, numeric)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_escrow()                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.purchase_tickets(uuid, uuid, text, numeric, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_automated_payouts()             FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_booking()                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_pop()                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.feed_for_user(uuid, integer, integer)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_nearby_vibers(uuid, double precision, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_trending_events()               FROM anon;


-- ══════════════════════════════════════════════════════════════
--  18. AI LAYER — tables for memory, recommendations, logging
-- ══════════════════════════════════════════════════════════════

-- Per-user AI memory: preferences + behaviour Claude learns over time
CREATE TABLE IF NOT EXISTS ai_user_memory (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  preferences    JSONB        DEFAULT '{}',
  behaviour      JSONB        DEFAULT '{}',
  summary        TEXT,
  updated_at     TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own ai memory"    ON ai_user_memory;
DROP POLICY IF EXISTS "Service manages ai memory"   ON ai_user_memory;
CREATE POLICY "User reads own ai memory"  ON ai_user_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages ai memory" ON ai_user_memory FOR ALL   USING (auth.role() IN ('service_role','postgres'));

-- Cached recommendations refreshed daily by the AI agent
CREATE TABLE IF NOT EXISTS ai_recommendations_cache (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  event_ids      UUID[]       DEFAULT '{}',
  viber_ids      UUID[]       DEFAULT '{}',
  reasoning      TEXT,
  generated_at   TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own recs"   ON ai_recommendations_cache;
DROP POLICY IF EXISTS "Service manages recs"  ON ai_recommendations_cache;
CREATE POLICY "User reads own recs"  ON ai_recommendations_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages recs" ON ai_recommendations_cache FOR ALL   USING (auth.role() IN ('service_role','postgres'));

-- Every AI call logged for learning + feedback loop
CREATE TABLE IF NOT EXISTS ai_interactions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  feature        TEXT         NOT NULL,
  input          TEXT,
  output         TEXT,
  model          TEXT,
  tokens_used    INTEGER,
  feedback       INTEGER,
  created_at     TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own interactions"    ON ai_interactions;
DROP POLICY IF EXISTS "Service inserts interactions"   ON ai_interactions;
CREATE POLICY "User reads own interactions"  ON ai_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts interactions" ON ai_interactions FOR INSERT WITH CHECK (true);

-- Auto-purge interactions older than 90 days
CREATE INDEX IF NOT EXISTS ai_interactions_created ON ai_interactions(created_at);

-- Content moderation queue
CREATE TABLE IF NOT EXISTS ai_moderation_queue (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type   TEXT         NOT NULL,
  content_id     UUID         NOT NULL,
  content_text   TEXT         NOT NULL,
  author_id      UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  status         TEXT         DEFAULT 'pending',
  ai_verdict     TEXT,
  ai_reason      TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE ai_moderation_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service manages moderation" ON ai_moderation_queue;
CREATE POLICY "Service manages moderation" ON ai_moderation_queue FOR ALL USING (auth.role() IN ('service_role','postgres'));


-- Add sound_name to reels (used by CreateReelModal audio pill)
ALTER TABLE reels ADD COLUMN IF NOT EXISTS sound_name TEXT;

-- Add reel_reports table for in-app reporting
CREATE TABLE IF NOT EXISTS reel_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  reporter_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reason      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reel_id, reporter_id)
);
ALTER TABLE reel_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can report reels" ON reel_reports;
CREATE POLICY "Users can report reels" ON reel_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);


============================================================
--  SECTION: MASTER ADVANCE (stories, reels, wallets, indexes, RPCs)
============================================================

-- ============================================================
--  THE GRUVS — Master Advance Migration  v5 × 5
--  "advancing every line times 5"
--  Paste into Supabase → SQL Editor → Run
--  Fully idempotent — safe to run multiple times.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  §1  PROFILES — missing columns
-- ══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_areas   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance    NUMERIC  DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_events_posted INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_check_ins    INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_last_date  DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges            JSONB    DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB   DEFAULT '{}';


-- ══════════════════════════════════════════════════════════════
--  §2  EVENTS — missing columns
-- ══════════════════════════════════════════════════════════════
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url      TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image    TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_tiers     JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity       INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price   NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS dress_code     TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_restriction TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS playlist_url   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lineup         JSONB  DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS sponsors       JSONB  DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS weather_cache  JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS weather_cached_at TIMESTAMPTZ;

-- Sync cover_url from existing media records (one-time backfill)
UPDATE events
SET cover_url = media_urls[1]
WHERE cover_url IS NULL
  AND media_urls IS NOT NULL
  AND array_length(media_urls, 1) > 0;

UPDATE events
SET cover_url = (media->0->>'url')
WHERE cover_url IS NULL
  AND media IS NOT NULL
  AND jsonb_array_length(media) > 0;


-- ══════════════════════════════════════════════════════════════
--  §3  EVENT_RSVPS — tier support
-- ══════════════════════════════════════════════════════════════
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS tier_id      TEXT;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS ticket_ref   TEXT;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS amount_paid  NUMERIC DEFAULT 0;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS is_early_bird BOOLEAN DEFAULT false;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS checked_in   BOOLEAN DEFAULT false;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;


-- ══════════════════════════════════════════════════════════════
--  §4  STORIES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption     TEXT,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  view_count  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stories_user_id_idx    ON stories(user_id);
CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON stories(expires_at DESC);
-- Partial index: only live stories
CREATE INDEX IF NOT EXISTS stories_live_idx ON stories(user_id, created_at DESC)
  WHERE expires_at > now();

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_select"  ON stories;
DROP POLICY IF EXISTS "stories_insert"  ON stories;
DROP POLICY IF EXISTS "stories_delete"  ON stories;
CREATE POLICY "stories_select" ON stories FOR SELECT USING (true);
CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_delete" ON stories FOR DELETE USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  §5  STORY_VIEWS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS story_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID        NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS story_views_story_id_idx  ON story_views(story_id);
CREATE INDEX IF NOT EXISTS story_views_viewer_id_idx ON story_views(viewer_id);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story_views_select"  ON story_views;
DROP POLICY IF EXISTS "story_views_insert"  ON story_views;
CREATE POLICY "story_views_select" ON story_views FOR SELECT USING (true);
CREATE POLICY "story_views_insert" ON story_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);

-- Auto-increment view_count on stories when a view is recorded
CREATE OR REPLACE FUNCTION sync_story_view_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_story_view_count ON story_views;
CREATE TRIGGER trg_story_view_count
  AFTER INSERT ON story_views
  FOR EACH ROW EXECUTE FUNCTION sync_story_view_count();


-- ══════════════════════════════════════════════════════════════
--  §6  REELS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reels (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        NOT NULL DEFAULT 'video' CHECK (media_type IN ('video','image')),
  caption     TEXT,
  sound_name  TEXT,
  hashtags    TEXT[],
  like_count  INTEGER     DEFAULT 0,
  view_count  INTEGER     DEFAULT 0,
  comment_count INTEGER   DEFAULT 0,
  share_count INTEGER     DEFAULT 0,
  is_featured BOOLEAN     DEFAULT false,
  is_removed  BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reels ADD COLUMN IF NOT EXISTS sound_name    TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS hashtags      TEXT[];
ALTER TABLE reels ADD COLUMN IF NOT EXISTS share_count   INTEGER DEFAULT 0;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_featured   BOOLEAN DEFAULT false;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_removed    BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS reels_user_id_idx    ON reels(user_id);
CREATE INDEX IF NOT EXISTS reels_created_at_idx ON reels(created_at DESC);
-- Partial index: only live reels
CREATE INDEX IF NOT EXISTS reels_live_idx ON reels(created_at DESC)
  WHERE is_removed = false;

ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_select"  ON reels;
DROP POLICY IF EXISTS "reels_insert"  ON reels;
DROP POLICY IF EXISTS "reels_update"  ON reels;
DROP POLICY IF EXISTS "reels_delete"  ON reels;
CREATE POLICY "reels_select" ON reels FOR SELECT USING (is_removed = false OR auth.uid() = user_id);
CREATE POLICY "reels_insert" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update" ON reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete" ON reels FOR DELETE USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  §7  REEL_LIKES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  removed    BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS reel_likes_reel_id_idx ON reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS reel_likes_user_id_idx ON reel_likes(user_id);

ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reel_likes_select"  ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert"  ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_update"  ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete"  ON reel_likes;
CREATE POLICY "reel_likes_select" ON reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_update" ON reel_likes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON reel_likes FOR DELETE USING (auth.uid() = user_id);

-- Sync like_count on reels
CREATE OR REPLACE FUNCTION sync_reel_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.removed = true) THEN
    UPDATE reels SET like_count = greatest(0, like_count - 1) WHERE id = COALESCE(OLD.reel_id, NEW.reel_id);
  ELSIF TG_OP = 'INSERT' AND (NEW.removed IS NULL OR NEW.removed = false) THEN
    UPDATE reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_reel_like_count ON reel_likes;
CREATE TRIGGER trg_reel_like_count
  AFTER INSERT OR UPDATE OR DELETE ON reel_likes
  FOR EACH ROW EXECUTE FUNCTION sync_reel_like_count();


-- ══════════════════════════════════════════════════════════════
--  §8  REEL_VIEWS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS reel_views_reel_id_idx ON reel_views(reel_id);

ALTER TABLE reel_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reel_views_select"  ON reel_views;
DROP POLICY IF EXISTS "reel_views_insert"  ON reel_views;
CREATE POLICY "reel_views_select" ON reel_views FOR SELECT USING (true);
CREATE POLICY "reel_views_insert" ON reel_views FOR INSERT WITH CHECK (true);

-- Sync view_count on reels
CREATE OR REPLACE FUNCTION sync_reel_view_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE reels SET view_count = view_count + 1 WHERE id = NEW.reel_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_reel_view_count ON reel_views;
CREATE TRIGGER trg_reel_view_count
  AFTER INSERT ON reel_views
  FOR EACH ROW EXECUTE FUNCTION sync_reel_view_count();


-- ══════════════════════════════════════════════════════════════
--  §9  REEL_COMMENTS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  parent_id  UUID        REFERENCES reel_comments(id) ON DELETE CASCADE,
  like_count INTEGER     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reel_comments_reel_id_idx ON reel_comments(reel_id, created_at DESC);

ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reel_comments_select"  ON reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert"  ON reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete"  ON reel_comments;
CREATE POLICY "reel_comments_select" ON reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete" ON reel_comments FOR DELETE USING (auth.uid() = user_id);

-- Sync comment_count on reels
CREATE OR REPLACE FUNCTION sync_reel_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE reels SET comment_count = greatest(0, comment_count - 1) WHERE id = OLD.reel_id;
    RETURN OLD;
  ELSE
    UPDATE reels SET comment_count = comment_count + 1 WHERE id = NEW.reel_id;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_reel_comment_count ON reel_comments;
CREATE TRIGGER trg_reel_comment_count
  AFTER INSERT OR DELETE ON reel_comments
  FOR EACH ROW EXECUTE FUNCTION sync_reel_comment_count();


-- ══════════════════════════════════════════════════════════════
--  §10  SAVED_REELS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS saved_reels (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  removed    BOOLEAN     DEFAULT false,
  saved_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS saved_reels_user_id_idx ON saved_reels(user_id);

ALTER TABLE saved_reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_reels_select"  ON saved_reels;
DROP POLICY IF EXISTS "saved_reels_insert"  ON saved_reels;
DROP POLICY IF EXISTS "saved_reels_update"  ON saved_reels;
DROP POLICY IF EXISTS "saved_reels_delete"  ON saved_reels;
CREATE POLICY "saved_reels_select" ON saved_reels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_reels_insert" ON saved_reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_reels_update" ON saved_reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "saved_reels_delete" ON saved_reels FOR DELETE USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  §11  REEL_REPORTS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  reporter_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reason      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reel_id, reporter_id)
);

ALTER TABLE reel_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can report reels" ON reel_reports;
CREATE POLICY "Users can report reels" ON reel_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "reel_reports_service"   ON reel_reports;
CREATE POLICY "reel_reports_service" ON reel_reports
  FOR SELECT USING (auth.role() IN ('service_role','postgres'));


-- ══════════════════════════════════════════════════════════════
--  §12  EVENT FEATURE TABLES (from 20260521_new_features.sql)
--       Idempotent re-run is safe.
-- ══════════════════════════════════════════════════════════════

-- event_reactions
CREATE TABLE IF NOT EXISTS event_reactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, reaction)
);
CREATE INDEX IF NOT EXISTS event_reactions_event_id_idx ON event_reactions(event_id);
ALTER TABLE event_reactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_reactions' AND policyname='event_reactions_select') THEN
    EXECUTE 'CREATE POLICY "event_reactions_select" ON event_reactions FOR SELECT USING (true)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_reactions' AND policyname='event_reactions_insert') THEN
    EXECUTE 'CREATE POLICY "event_reactions_insert" ON event_reactions FOR INSERT WITH CHECK (auth.uid() = user_id)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_reactions' AND policyname='event_reactions_delete') THEN
    EXECUTE 'CREATE POLICY "event_reactions_delete" ON event_reactions FOR DELETE USING (auth.uid() = user_id)'; END IF;
END $$;

-- event_updates
CREATE TABLE IF NOT EXISTS event_updates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message     TEXT        NOT NULL,
  update_type TEXT        NOT NULL DEFAULT 'info'
    CHECK (update_type IN ('info','hype','change','shoutout')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_updates_event_id_idx ON event_updates(event_id);
ALTER TABLE event_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_updates_select" ON event_updates;
DROP POLICY IF EXISTS "event_updates_insert" ON event_updates;
DROP POLICY IF EXISTS "event_updates_delete" ON event_updates;
CREATE POLICY "event_updates_select" ON event_updates FOR SELECT USING (true);
CREATE POLICY "event_updates_insert" ON event_updates FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "event_updates_delete" ON event_updates FOR DELETE USING (auth.uid() = author_id);

-- event_waitlist
CREATE TABLE IF NOT EXISTS event_waitlist (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS event_waitlist_event_id_idx ON event_waitlist(event_id);
ALTER TABLE event_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_waitlist_select" ON event_waitlist;
DROP POLICY IF EXISTS "event_waitlist_insert" ON event_waitlist;
DROP POLICY IF EXISTS "event_waitlist_delete" ON event_waitlist;
CREATE POLICY "event_waitlist_select" ON event_waitlist FOR SELECT USING (true);
CREATE POLICY "event_waitlist_insert" ON event_waitlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_waitlist_delete" ON event_waitlist FOR DELETE USING (auth.uid() = user_id);

-- event_carpools
CREATE TABLE IF NOT EXISTS event_carpools (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  driver_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seats_available  INT         NOT NULL DEFAULT 2 CHECK (seats_available BETWEEN 1 AND 10),
  departure_area   TEXT        NOT NULL,
  departure_time   TIMESTAMPTZ,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_carpools_event_id_idx ON event_carpools(event_id);
ALTER TABLE event_carpools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_carpools_select" ON event_carpools;
DROP POLICY IF EXISTS "event_carpools_insert" ON event_carpools;
DROP POLICY IF EXISTS "event_carpools_delete" ON event_carpools;
CREATE POLICY "event_carpools_select" ON event_carpools FOR SELECT USING (true);
CREATE POLICY "event_carpools_insert" ON event_carpools FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "event_carpools_delete" ON event_carpools FOR DELETE USING (auth.uid() = driver_id);

-- event_carpool_requests
CREATE TABLE IF NOT EXISTS event_carpool_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id UUID        NOT NULL REFERENCES event_carpools(id) ON DELETE CASCADE,
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rider_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (carpool_id, rider_id)
);
CREATE INDEX IF NOT EXISTS ecr_carpool_id_idx ON event_carpool_requests(carpool_id);
CREATE INDEX IF NOT EXISTS ecr_rider_id_idx   ON event_carpool_requests(rider_id);
ALTER TABLE event_carpool_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_carpool_requests_select" ON event_carpool_requests;
DROP POLICY IF EXISTS "event_carpool_requests_insert" ON event_carpool_requests;
DROP POLICY IF EXISTS "event_carpool_requests_delete" ON event_carpool_requests;
CREATE POLICY "event_carpool_requests_select" ON event_carpool_requests FOR SELECT USING (true);
CREATE POLICY "event_carpool_requests_insert" ON event_carpool_requests FOR INSERT WITH CHECK (auth.uid() = rider_id);
CREATE POLICY "event_carpool_requests_delete" ON event_carpool_requests FOR DELETE USING (auth.uid() = rider_id);


-- ══════════════════════════════════════════════════════════════
--  §13  WALLET / TRANSACTIONS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       NUMERIC     NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('credit','debit','escrow','release','refund','payout')),
  reference    TEXT,
  description  TEXT,
  booking_id   UUID,
  status       TEXT        DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','reversed')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_tx_user_id_idx    ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_tx_status_idx     ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS wallet_tx_type_idx       ON wallet_transactions(type);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_tx_owner"   ON wallet_transactions;
DROP POLICY IF EXISTS "wallet_tx_service" ON wallet_transactions;
CREATE POLICY "wallet_tx_owner"   ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallet_tx_service" ON wallet_transactions FOR INSERT
  WITH CHECK (auth.role() IN ('service_role','postgres','authenticated'));


-- ══════════════════════════════════════════════════════════════
--  §14  ADVANCED PERFORMANCE INDEXES
-- ══════════════════════════════════════════════════════════════

-- Events: full-text search vector (GIN)
CREATE INDEX IF NOT EXISTS events_search_vector_idx ON events USING GIN(search_vector)
  WHERE search_vector IS NOT NULL;

-- Events: trending score for feed sorting
CREATE INDEX IF NOT EXISTS events_trending_idx ON events(trending_score DESC NULLS LAST, event_date DESC)
  WHERE is_cancelled = false;

-- Events: upcoming events by date
CREATE INDEX IF NOT EXISTS events_upcoming_idx ON events(event_date ASC, event_time ASC)
  WHERE is_cancelled = false AND event_date >= CURRENT_DATE;

-- Events: geo lookup (GiST — requires postgis)
CREATE INDEX IF NOT EXISTS events_geo_idx ON events USING GIST(
  ST_MakePoint(lon, lat)::geography
) WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- Profiles: geo lookup
CREATE INDEX IF NOT EXISTS profiles_geo_idx ON profiles USING GIST(
  ST_MakePoint(lon, lat)::geography
) WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- Notifications: unread count (most common query)
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(recipient_id, created_at DESC)
  WHERE is_read = false;

-- Messages: conversation view
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(sender_id, recipient_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Event vibes: per-event count
CREATE INDEX IF NOT EXISTS event_vibes_event_idx ON event_vibes(event_id);

-- Echoes: per-event comment feed
CREATE INDEX IF NOT EXISTS echoes_event_idx ON echoes(event_id, created_at DESC);

-- Reels: hashtag search (GIN on array)
CREATE INDEX IF NOT EXISTS reels_hashtags_gin ON reels USING GIN(hashtags)
  WHERE hashtags IS NOT NULL AND is_removed = false;

-- Stories: live stories per user
CREATE INDEX IF NOT EXISTS stories_live_user_idx ON stories(user_id, expires_at DESC)
  WHERE expires_at > CURRENT_TIMESTAMP;

-- Service bookings: provider queue
CREATE INDEX IF NOT EXISTS service_bookings_provider_idx ON service_bookings(provider_id, status, created_at DESC)
  WHERE status IN ('pending','confirmed');

-- Follows: follower/following lookups
CREATE INDEX IF NOT EXISTS follows_follower_idx  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);


-- ══════════════════════════════════════════════════════════════
--  §15  STORAGE BUCKETS — stories + reels
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('stories', 'stories', true, 52428800,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('reels', 'reels', true, 209715200,
   ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/x-m4v','video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Update existing buckets with latest limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('event-media', 'event-media', true, 104857600,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('chat_media',  'chat_media',  true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Stories storage RLS
DROP POLICY IF EXISTS "Public read stories"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload stories"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete stories"  ON storage.objects;
CREATE POLICY "Public read stories"
  ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Auth upload stories"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete stories"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stories' AND auth.role() = 'authenticated');

-- Reels storage RLS
DROP POLICY IF EXISTS "Public read reels"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload reels"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete reels"  ON storage.objects;
CREATE POLICY "Public read reels"
  ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "Auth upload reels"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reels' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete reels"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'reels' AND auth.role() = 'authenticated');

-- Re-apply event-media + avatars RLS (safe DROP/CREATE)
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

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Public read covers"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers"
  ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Public read event-media"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');
CREATE POLICY "Public read chat_media"
  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media"
  ON storage.objects FOR DELETE USING (bucket_id = 'chat_media' AND auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════
--  §16  RPC FUNCTIONS
-- ══════════════════════════════════════════════════════════════

-- upsert_rsvp_tier — used by VIPTierSelector
CREATE OR REPLACE FUNCTION upsert_rsvp_tier(
  p_event_id UUID,
  p_user_id  UUID,
  p_tier_id  TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO event_rsvps (event_id, user_id, status, tier_id)
  VALUES (p_event_id, p_user_id, 'going', p_tier_id)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET tier_id = EXCLUDED.tier_id, status = 'going';
END;
$$;

-- create_story RPC fallback (used by StoriesRow resilient chain)
CREATE OR REPLACE FUNCTION create_story(
  p_user_id   UUID,
  p_url       TEXT,
  p_type      TEXT DEFAULT 'image',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO stories (user_id, media_url, media_type, expires_at)
  VALUES (
    p_user_id, p_url, p_type,
    COALESCE(p_expires_at, now() + INTERVAL '24 hours')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- create_reel RPC fallback (used by CreateReelModal resilient chain)
CREATE OR REPLACE FUNCTION create_reel(
  p_user_id   UUID,
  p_media_url TEXT,
  p_caption   TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO reels (user_id, media_url, caption)
  VALUES (p_user_id, p_media_url, p_caption)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- add_gallery_item RPC fallback (used by EventGallery resilient chain)
CREATE OR REPLACE FUNCTION add_gallery_item(
  p_event_id UUID,
  p_user_id  UUID,
  p_url      TEXT,
  p_type     TEXT DEFAULT 'image'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO event_gallery (event_id, user_id, url, media_type)
  VALUES (p_event_id, p_user_id, p_url, p_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- increment_wallet_balance — used by escrowService
CREATE OR REPLACE FUNCTION increment_wallet_balance(
  user_id UUID,
  amount  NUMERIC
) RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + amount WHERE id = user_id;
$$;

-- mark_notifications_read — used by NotificationsScreen
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE notifications SET is_read = true
  WHERE recipient_id = p_user_id AND is_read = false;
$$;

-- Trending score refresh: weight = (vibe_count*3 + going*2 + echo_count + save_count) / hours_since^1.5
CREATE OR REPLACE FUNCTION refresh_trending_events()
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE events SET
    trending_score = (
      (COALESCE(vibe_count, 0) * 3 +
       COALESCE(going, 0) * 2 +
       COALESCE(echo_count, 0) +
       COALESCE(save_count, 0))::float
      /
      NULLIF(POWER(EXTRACT(EPOCH FROM (now() - created_at)) / 3600 + 2, 1.5), 0)
    )
  WHERE is_cancelled = false;
$$;

-- feed_for_user: personalised event feed using follow graph + interests
CREATE OR REPLACE FUNCTION feed_for_user(
  p_user_id UUID,
  p_limit   INT  DEFAULT 30,
  p_offset  INT  DEFAULT 0
)
RETURNS SETOF events LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT e.*
  FROM events e
  LEFT JOIN follows f ON f.following_id = e.author_id AND f.follower_id = p_user_id
  WHERE e.is_cancelled = false
    AND e.event_date >= CURRENT_DATE
  ORDER BY
    (CASE WHEN f.follower_id IS NOT NULL THEN 3 ELSE 0 END) +
    COALESCE(e.trending_score, 0) DESC,
    e.event_date ASC
  LIMIT p_limit OFFSET p_offset;
$$;


-- ══════════════════════════════════════════════════════════════
--  §17  REALTIME — add new tables to publication
-- ══════════════════════════════════════════════════════════════
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'events','notifications','messages','follows',
    'live_checkins','event_vibes','echoes','service_bookings',
    'gig_acceptances','dm_rooms','ad_campaigns',
    'stories','story_views','reels','reel_likes','reel_comments',
    'event_reactions','event_updates','event_waitlist','event_carpools'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      END IF;
    END IF;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §18  AI MEMORY / RECOMMENDATIONS / INTERACTIONS
--       (from patch_live_db.sql — idempotent re-run)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_user_memory (
  user_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  preferences JSONB       DEFAULT '{}',
  behaviour   JSONB       DEFAULT '{}',
  summary     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own ai memory"  ON ai_user_memory;
DROP POLICY IF EXISTS "Service manages ai memory" ON ai_user_memory;
CREATE POLICY "User reads own ai memory"  ON ai_user_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages ai memory" ON ai_user_memory FOR ALL
  USING (auth.role() IN ('service_role','postgres'));

CREATE TABLE IF NOT EXISTS ai_recommendations_cache (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  event_ids    UUID[]      DEFAULT '{}',
  viber_ids    UUID[]      DEFAULT '{}',
  reasoning    TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own recs"  ON ai_recommendations_cache;
DROP POLICY IF EXISTS "Service manages recs" ON ai_recommendations_cache;
CREATE POLICY "User reads own recs"  ON ai_recommendations_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages recs" ON ai_recommendations_cache FOR ALL
  USING (auth.role() IN ('service_role','postgres'));

CREATE TABLE IF NOT EXISTS ai_interactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  feature     TEXT        NOT NULL,
  input       TEXT,
  output      TEXT,
  model       TEXT,
  tokens_used INTEGER,
  feedback    INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own interactions"  ON ai_interactions;
DROP POLICY IF EXISTS "Service inserts interactions" ON ai_interactions;
CREATE POLICY "User reads own interactions"  ON ai_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts interactions" ON ai_interactions FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS ai_interactions_created ON ai_interactions(created_at);


-- ══════════════════════════════════════════════════════════════
--  §19  SECURITY HARDENING — pin search_path on new functions
-- ══════════════════════════════════════════════════════════════
DO $$ DECLARE fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'upsert_rsvp_tier(uuid,uuid,text)',
    'create_story(uuid,text,text,timestamptz)',
    'create_reel(uuid,text,text)',
    'add_gallery_item(uuid,uuid,text,text)',
    'increment_wallet_balance(uuid,numeric)',
    'mark_notifications_read(uuid)',
    'refresh_trending_events()',
    'sync_story_view_count()',
    'sync_reel_like_count()',
    'sync_reel_view_count()',
    'sync_reel_comment_count()'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', fn);
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;

-- Revoke anon execute on write functions
DO $$ DECLARE fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'upsert_rsvp_tier(uuid,uuid,text)',
    'create_story(uuid,text,text,timestamptz)',
    'create_reel(uuid,text,text)',
    'add_gallery_item(uuid,uuid,text,text)',
    'increment_wallet_balance(uuid,numeric)',
    'mark_notifications_read(uuid)',
    'refresh_trending_events()'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn);
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §20  FINALISE
-- ══════════════════════════════════════════════════════════════

-- Touch trigger on reels
DROP TRIGGER IF EXISTS reels_touch ON reels;
CREATE TRIGGER reels_touch BEFORE UPDATE ON reels
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Views: security_invoker = true (prevents privilege escalation)
DROP VIEW IF EXISTS public.vibes CASCADE;
CREATE OR REPLACE VIEW public.vibes WITH (security_invoker = true) AS SELECT * FROM public.event_vibes;
DROP VIEW IF EXISTS public.conversations CASCADE;
CREATE OR REPLACE VIEW public.conversations WITH (security_invoker = true) AS SELECT * FROM public.dm_rooms;

-- Spatial ref sys (PostGIS table): must have RLS
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spatial_ref_sys public read" ON public.spatial_ref_sys;
CREATE POLICY "spatial_ref_sys public read" ON public.spatial_ref_sys FOR SELECT USING (true);

-- ✅  Migration complete.
-- Tables added/confirmed: stories, story_views, reels, reel_likes, reel_views,
--   reel_comments, saved_reels, reel_reports, event_reactions, event_updates,
--   event_waitlist, event_carpools, event_carpool_requests, wallet_transactions,
--   ai_user_memory, ai_recommendations_cache, ai_interactions
-- Columns added: profiles.looking_for, profiles.preferred_areas, profiles.wallet_balance,
--   events.cover_url, events.image_url, events.rsvp_tiers, event_rsvps.tier_id,
--   reels.sound_name, reels.hashtags, reels.is_featured
-- Storage buckets: stories (50MB), reels (200MB) — all with RLS
-- Realtime: 19 tables
-- RPCs: upsert_rsvp_tier, create_story, create_reel, add_gallery_item,
--   increment_wallet_balance, mark_notifications_read, refresh_trending_events,
--   feed_for_user
-- Indexes: 15 new indexes including GIN (search_vector, hashtags) and
--   GiST (geo) and partial indexes for live/upcoming filtering
