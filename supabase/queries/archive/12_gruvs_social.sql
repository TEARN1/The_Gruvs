-- ============================================================
--  THE GRUVS — 01: GRUVS SOCIAL (Core Social Graph)
--  profiles, follows, events, vibes, saves, reactions,
--  echoes, ratings, check-ins, gallery, notifications,
--  routes, pulse, messages
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;

-- ── PROFILES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username               TEXT UNIQUE,
  display_name           TEXT,
  avatar_url             TEXT,
  cover_url              TEXT,
  bio                    TEXT,
  location               TEXT,
  city                   TEXT,
  website                TEXT,
  gender                 TEXT,
  birth_year             INTEGER,
  interests              TEXT[],
  is_verified            BOOLEAN     DEFAULT false,
  is_online              BOOLEAN     DEFAULT false,
  show_online            BOOLEAN     DEFAULT true,
  last_seen              TIMESTAMPTZ,
  last_seen_at           TIMESTAMPTZ DEFAULT now(),
  vibe_score             INTEGER     DEFAULT 0,
  vibe_equity            NUMERIC     DEFAULT 0,
  social_integrity_score INTEGER     DEFAULT 100,
  followers_count        INTEGER     DEFAULT 0,
  following_count        INTEGER     DEFAULT 0,
  events_posted          INTEGER     DEFAULT 0,
  saved_count            INTEGER     DEFAULT 0,
  current_streak         INTEGER     DEFAULT 0,
  xp                     INTEGER     DEFAULT 0,
  badges                 TEXT[]      DEFAULT '{}',
  profile_gallery        TEXT[]      DEFAULT '{}',
  share_events           BOOLEAN     DEFAULT false,
  push_token             TEXT,
  identity_mode          TEXT        DEFAULT 'public' CHECK (identity_mode IN ('public','ghost','celebrity')),
  is_beacon_active       BOOLEAN     DEFAULT false,
  is_discoverable        BOOLEAN     DEFAULT true,
  wallet_balance         NUMERIC(10,2) DEFAULT 0.00,
  home_base_lat          FLOAT,
  home_base_lon          FLOAT,
  coords                 geography(Point, 4326),
  referral_code          TEXT UNIQUE,
  referral_count         INTEGER     DEFAULT 0,
  referred_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role                   TEXT        DEFAULT 'user',
  provider_type          TEXT,
  provider_rate          TEXT,
  provider_bio           TEXT,
  provider_verified      BOOLEAN     DEFAULT false,
  privacy_settings       JSONB       DEFAULT '{}',
  career_title           TEXT,
  career_description     TEXT,
  looks_description      TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username      ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_city          ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_vibe_score    ON public.profiles(vibe_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_push_token    ON public.profiles(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_coords        ON public.profiles USING gist(coords);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_interests     ON public.profiles USING gin(interests) WHERE interests IS NOT NULL;

DROP TRIGGER IF EXISTS touch_profiles_updated_at ON public.profiles;
CREATE TRIGGER touch_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_uname TEXT;
BEGIN
  base_uname := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'
  ));
  IF base_uname IS NULL OR base_uname = '' THEN
    base_uname := 'user' || left(new.id::text, 6);
  END IF;
  BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      new.id, base_uname,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.raw_user_meta_data->>'avatar_url'
    );
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.profiles (id, username, display_name, avatar_url)
      VALUES (new.id, 'user_' || left(new.id::text, 8),
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url')
      ON CONFLICT (id) DO NOTHING;
    WHEN others THEN NULL;
  END;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── FOLLOWS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

CREATE OR REPLACE FUNCTION public.sync_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = COALESCE(followers_count,0)+1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = COALESCE(following_count,0)+1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(0,COALESCE(followers_count,0)-1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0,COALESCE(following_count,0)-1) WHERE id = OLD.follower_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS follows_sync_counts ON public.follows;
CREATE TRIGGER follows_sync_counts AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();

-- ── BLOCKED / MUTED ──────────────────────────────────────────
DO $$ BEGIN
  -- Drop blocked_users if it's a view OR has wrong column name (blocker_id instead of user_id)
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'blocked_users' AND c.relkind = 'v') THEN
    DROP VIEW public.blocked_users CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'blocked_users' AND column_name = 'blocker_id') THEN
    DROP TABLE public.blocked_users CASCADE;
  END IF;
  -- Drop muted_users if it's a view OR has wrong column name (muter_id instead of user_id)
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'muted_users' AND c.relkind = 'v') THEN
    DROP VIEW public.muted_users CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'muted_users' AND column_name = 'muter_id') THEN
    DROP TABLE public.muted_users CASCADE;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS public.muted_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, muted_id)
);

-- ── EVENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 150),
  description     TEXT CHECK (length(description) <= 2000),
  event_date      DATE,
  event_time      TIME,
  end_time        TIME,
  end_date        DATE,
  venue_name      TEXT,
  venue_address   TEXT,
  address         TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'ZA',
  lat             DOUBLE PRECISION,
  lon             DOUBLE PRECISION,
  coords          geography(Point, 4326),
  price           TEXT DEFAULT 'FREE',
  price_min       NUMERIC,
  price_max       NUMERIC,
  capacity        INTEGER,
  max_attendees   INTEGER,
  ticket_url      TEXT,
  event_type      TEXT,
  category        TEXT,
  category_color  TEXT,
  categories      TEXT[],
  tags            TEXT[],
  age_restriction INTEGER DEFAULT 0,
  age_min         INTEGER DEFAULT 0,
  age_max         INTEGER DEFAULT 99,
  media           JSONB,
  media_urls      TEXT[],
  cover_url       TEXT,
  cover_image     TEXT,
  rsvp_tiers      JSONB,
  vibe_count      INTEGER DEFAULT 0,
  echo_count      INTEGER DEFAULT 0,
  reaction_count  INTEGER DEFAULT 0,
  save_count      INTEGER DEFAULT 0,
  going           INTEGER DEFAULT 0,
  is_featured     BOOLEAN DEFAULT false,
  is_cancelled    BOOLEAN DEFAULT false,
  is_published    BOOLEAN DEFAULT true,
  search_vector   TSVECTOR,
  slug            TEXT UNIQUE,
  date_time       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
-- Patch missing columns on pre-existing events table (must run before indexes)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_published   BOOLEAN DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_featured    BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_cancelled   BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug           TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS search_vector  TSVECTOR;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS date_time      TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS vibe_count     INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS echo_count     INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS save_count     INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS going          INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rsvp_tiers     JSONB;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS categories     TEXT[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS media_urls     TEXT[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_image    TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS coords         geography(Point, 4326);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS age_min        INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS age_max        INTEGER DEFAULT 99;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_min      NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_max      NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS max_attendees  INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS starts_at      TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ends_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_author     ON public.events(author_id);
CREATE INDEX IF NOT EXISTS idx_events_date       ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_city       ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_events_published  ON public.events(is_published, event_date);
CREATE INDEX IF NOT EXISTS idx_events_search     ON public.events USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_events_tags       ON public.events USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON public.events USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_coords     ON public.events USING gist(coords);

DROP TRIGGER IF EXISTS touch_events_updated_at ON public.events;
CREATE TRIGGER touch_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION public.events_update_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(unaccent(NEW.title),       '')), 'A') ||
    setweight(to_tsvector('english', coalesce(unaccent(NEW.venue_name),  '')), 'B') ||
    setweight(to_tsvector('english', coalesce(unaccent(NEW.city),        '')), 'B') ||
    setweight(to_tsvector('english', coalesce(unaccent(NEW.description), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'B');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS events_search_vector_update ON public.events;
CREATE TRIGGER events_search_vector_update BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_update_search_vector();

CREATE OR REPLACE FUNCTION public.events_set_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF;
  NEW.slug := left(regexp_replace(lower(unaccent(NEW.title)), '[^a-z0-9]+', '-', 'g'), 60)
              || '-' || left(gen_random_uuid()::text, 8);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS events_slug_gen ON public.events;
CREATE TRIGGER events_slug_gen BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_set_slug();

CREATE OR REPLACE FUNCTION public.sync_events_posted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET events_posted = COALESCE(events_posted,0)+1 WHERE id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET events_posted = GREATEST(0,COALESCE(events_posted,0)-1) WHERE id = OLD.author_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS events_posted_sync ON public.events;
CREATE TRIGGER events_posted_sync AFTER INSERT OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.sync_events_posted();

-- ── EVENT VIBES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vibes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_vibes_event ON public.event_vibes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_vibes_user  ON public.event_vibes(user_id);

CREATE OR REPLACE FUNCTION public.sync_vibe_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET vibe_count = COALESCE(vibe_count,0)+1 WHERE id = NEW.event_id;
    UPDATE public.profiles SET vibe_score = COALESCE(vibe_score,0)+2
      WHERE id = (SELECT author_id FROM public.events WHERE id = NEW.event_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET vibe_count = GREATEST(0,COALESCE(vibe_count,0)-1) WHERE id = OLD.event_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS sync_vibe_count_trigger ON public.event_vibes;
CREATE TRIGGER sync_vibe_count_trigger AFTER INSERT OR DELETE ON public.event_vibes
  FOR EACH ROW EXECUTE FUNCTION public.sync_vibe_count();

-- ── SAVED EVENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE OR REPLACE FUNCTION public.sync_save_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events   SET save_count  = COALESCE(save_count,0)+1  WHERE id = NEW.event_id;
    UPDATE public.profiles SET saved_count = COALESCE(saved_count,0)+1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events   SET save_count  = GREATEST(0,COALESCE(save_count,0)-1)  WHERE id = OLD.event_id;
    UPDATE public.profiles SET saved_count = GREATEST(0,COALESCE(saved_count,0)-1) WHERE id = OLD.user_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS saved_events_sync ON public.saved_events;
CREATE TRIGGER saved_events_sync AFTER INSERT OR DELETE ON public.saved_events
  FOR EACH ROW EXECUTE FUNCTION public.sync_save_counts();

-- ── EVENT REACTIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction     TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id, reaction)
);
CREATE INDEX IF NOT EXISTS idx_event_reactions_event ON public.event_reactions(event_id);

-- ── ECHOES (comments) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.echoes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.echoes(id) ON DELETE CASCADE,
  body      TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  likes     INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_echoes_event  ON public.echoes(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_echoes_parent ON public.echoes(parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.echo_likes (
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(echo_id, user_id)
);

CREATE OR REPLACE FUNCTION public.sync_echo_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET echo_count = COALESCE(echo_count,0)+1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET echo_count = GREATEST(0,COALESCE(echo_count,0)-1) WHERE id = OLD.event_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS echoes_sync ON public.echoes;
CREATE TRIGGER echoes_sync AFTER INSERT OR DELETE ON public.echoes
  FOR EACH ROW EXECUTE FUNCTION public.sync_echo_counts();

CREATE OR REPLACE FUNCTION public.sanitize_echo_body()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.body = regexp_replace(NEW.body, '<[^>]+>', '', 'g');
  NEW.body = regexp_replace(NEW.body, 'javascript\s*:', '', 'gi');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sanitize_echo_body_trigger ON public.echoes;
CREATE TRIGGER sanitize_echo_body_trigger BEFORE INSERT OR UPDATE ON public.echoes
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_echo_body();

-- ── EVENT RATINGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating   SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review   TEXT CHECK (length(review) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── CHECK-INS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rsvp_id       UUID, -- FK to event_rsvps added in 07_gruvs_social.sql
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT event_checkins_rsvp_unique UNIQUE(rsvp_id)
);
CREATE INDEX IF NOT EXISTS idx_checkins_event ON public.event_checkins(event_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_user  ON public.event_checkins(user_id);

-- ── LIVE CHECK-INS (presence layer) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.live_checkins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat            DOUBLE PRECISION,
  lon            DOUBLE PRECISION,
  identity_layer TEXT DEFAULT 'public',
  ghost_alias    TEXT,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_live_checkins_event   ON public.live_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_live_checkins_expires ON public.live_checkins(expires_at) WHERE expires_at IS NOT NULL;

-- ── EVENT GALLERY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_gallery (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url  TEXT NOT NULL,
  media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption    TEXT CHECK (length(caption) <= 200),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gallery_event ON public.event_gallery(event_id);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id     UUID REFERENCES public.events(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  data         JSONB DEFAULT '{}',
  read         BOOLEAN DEFAULT false,
  push_error   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON public.notifications(recipient_id) WHERE read = false;

-- ── MESSAGES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body             TEXT,
  media_url        TEXT,
  read_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  is_request       BOOLEAN DEFAULT false,
  request_accepted BOOLEAN,
  deleted_at       TIMESTAMPTZ,
  reactions        JSONB DEFAULT '{}',
  reply_to         UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON public.messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id, created_at DESC);

-- ── ROUTES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT,
  color      TEXT DEFAULT '#00f2ff',
  icon       TEXT,
  join_count INTEGER DEFAULT 0,
  is_public  BOOLEAN DEFAULT false,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS is_public  BOOLEAN DEFAULT false;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS color      TEXT DEFAULT '#00f2ff';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS icon       TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS join_count INTEGER DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.route_steps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES public.events(id) ON DELETE SET NULL,
  step_order INTEGER DEFAULT 0,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.route_joins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_id, user_id)
);

-- ── PULSE REQUESTS & VOTES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pulse_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content      TEXT CHECK (length(content) <= 200),
  body         TEXT,
  request_type TEXT DEFAULT 'media',
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed')),
  vote_count   INTEGER DEFAULT 1,
  is_live      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pulse_event_votes ON public.pulse_requests(event_id, vote_count DESC);

CREATE TABLE IF NOT EXISTS public.pulse_votes (
  request_id UUID NOT NULL REFERENCES public.pulse_requests(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(request_id, user_id)
);

CREATE OR REPLACE FUNCTION public.sync_pulse_vote_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pulse_requests SET vote_count = COALESCE(vote_count,0)+1 WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pulse_requests SET vote_count = GREATEST(0,COALESCE(vote_count,1)-1) WHERE id = OLD.request_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS pulse_vote_count_trigger ON public.pulse_votes;
CREATE TRIGGER pulse_vote_count_trigger AFTER INSERT OR DELETE ON public.pulse_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_pulse_vote_count();

-- ── HASHTAGS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag      TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tag, event_id)
);

-- ── REPORTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('event','user','reel','echo','message')),
  reason      TEXT,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_vibes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echo_likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ratings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checkins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_checkins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_gallery   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_steps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_joins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select"     ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert"     ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (follower_id = auth.uid());

DROP POLICY IF EXISTS "blocked_manage" ON public.blocked_users;
CREATE POLICY "blocked_manage" ON public.blocked_users FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "muted_manage"   ON public.muted_users;
CREATE POLICY "muted_manage"   ON public.muted_users  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "events_select"     ON public.events;
DROP POLICY IF EXISTS "events_insert"     ON public.events;
DROP POLICY IF EXISTS "events_update_own" ON public.events;
DROP POLICY IF EXISTS "events_delete_own" ON public.events;
CREATE POLICY "events_select"     ON public.events FOR SELECT USING (is_published = true OR author_id = auth.uid());
CREATE POLICY "events_insert"     ON public.events FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "events_update_own" ON public.events FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "events_delete_own" ON public.events FOR DELETE USING (author_id = auth.uid());

DROP POLICY IF EXISTS "no_self_vibe"       ON public.event_vibes;
DROP POLICY IF EXISTS "event_vibes_select" ON public.event_vibes;
DROP POLICY IF EXISTS "event_vibes_delete" ON public.event_vibes;
CREATE POLICY "event_vibes_select" ON public.event_vibes FOR SELECT USING (true);
CREATE POLICY "no_self_vibe"       ON public.event_vibes FOR INSERT WITH CHECK (
  user_id = auth.uid() AND user_id != (SELECT author_id FROM public.events WHERE id = event_id));
CREATE POLICY "event_vibes_delete" ON public.event_vibes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_events_manage" ON public.saved_events;
CREATE POLICY "saved_events_manage" ON public.saved_events FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_select" ON public.event_reactions;
DROP POLICY IF EXISTS "reactions_manage" ON public.event_reactions;
CREATE POLICY "reactions_select" ON public.event_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_manage" ON public.event_reactions FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "echoes_select" ON public.echoes;
DROP POLICY IF EXISTS "echoes_insert" ON public.echoes;
DROP POLICY IF EXISTS "echoes_update" ON public.echoes;
DROP POLICY IF EXISTS "echoes_delete" ON public.echoes;
CREATE POLICY "echoes_select" ON public.echoes FOR SELECT USING (true);
CREATE POLICY "echoes_insert" ON public.echoes FOR INSERT
  WITH CHECK (user_id = auth.uid() AND (SELECT COUNT(*) FROM public.echoes
    WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute') < 20);
CREATE POLICY "echoes_update" ON public.echoes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "echoes_delete" ON public.echoes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "echo_likes_manage" ON public.echo_likes;
CREATE POLICY "echo_likes_manage" ON public.echo_likes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ratings_select" ON public.event_ratings;
DROP POLICY IF EXISTS "ratings_manage" ON public.event_ratings;
CREATE POLICY "ratings_select" ON public.event_ratings FOR SELECT USING (true);
CREATE POLICY "ratings_manage" ON public.event_ratings FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "live_checkins_select" ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins_insert" ON public.live_checkins;
CREATE POLICY "live_checkins_select" ON public.live_checkins FOR SELECT USING (true);
CREATE POLICY "live_checkins_insert" ON public.live_checkins FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gallery_select" ON public.event_gallery;
DROP POLICY IF EXISTS "gallery_manage" ON public.event_gallery;
CREATE POLICY "gallery_select" ON public.event_gallery FOR SELECT USING (true);
CREATE POLICY "gallery_manage" ON public.event_gallery FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifs_select" ON public.notifications;
DROP POLICY IF EXISTS "notifs_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifs_update" ON public.notifications;
CREATE POLICY "notifs_select" ON public.notifications FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "notifs_insert" ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR actor_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "notifs_update" ON public.notifications FOR UPDATE USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "routes_select" ON public.routes;
DROP POLICY IF EXISTS "routes_manage" ON public.routes;
CREATE POLICY "routes_select" ON public.routes FOR SELECT USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "routes_manage" ON public.routes FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "route_steps_select" ON public.route_steps;
CREATE POLICY "route_steps_select" ON public.route_steps FOR SELECT USING (true);
DROP POLICY IF EXISTS "route_joins_manage" ON public.route_joins;
CREATE POLICY "route_joins_manage" ON public.route_joins FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pulse_select" ON public.pulse_requests;
DROP POLICY IF EXISTS "pulse_insert" ON public.pulse_requests;
CREATE POLICY "pulse_select" ON public.pulse_requests FOR SELECT USING (true);
CREATE POLICY "pulse_insert" ON public.pulse_requests FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "pulse_votes_manage" ON public.pulse_votes;
CREATE POLICY "pulse_votes_manage" ON public.pulse_votes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "hashtags_select" ON public.hashtags;
DROP POLICY IF EXISTS "hashtags_insert" ON public.hashtags;
CREATE POLICY "hashtags_select" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "hashtags_insert" ON public.hashtags FOR INSERT WITH CHECK (auth.role() IN ('authenticated','service_role'));

DROP POLICY IF EXISTS "reports_manage" ON public.reports;
CREATE POLICY "reports_manage" ON public.reports FOR ALL USING (reporter_id = auth.uid());
