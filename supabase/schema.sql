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
CREATE OR REPLACE VIEW vibes AS SELECT * FROM event_vibes;

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
CREATE OR REPLACE VIEW conversations AS SELECT * FROM dm_rooms;


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
