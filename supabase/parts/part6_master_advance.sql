--============================================================

-- ============================================================
--  THE GRUVS — Master Advance Migration  v5 × 5
--  "advancing every line times 5"
--  Paste into Supabase → SQL Editor → Run
--  Fully idempotent — safe to run multiple times.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  §1  PROFILES — missing columns
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for       TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_areas   TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance    NUMERIC  DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_events_posted INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_check_ins    INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_last_date  DATE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges            JSONB    DEFAULT '[]';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB   DEFAULT '{}';
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §2  EVENTS — missing columns
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
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
  END IF;
END $$;

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
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_rsvps') THEN
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS tier_id      TEXT;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS ticket_ref   TEXT;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS amount_paid  NUMERIC DEFAULT 0;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS is_early_bird BOOLEAN DEFAULT false;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS checked_in   BOOLEAN DEFAULT false;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
  END IF;
END $$;


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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    CREATE INDEX IF NOT EXISTS stories_user_id_idx    ON stories(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON stories(expires_at DESC);
  END IF;
END $$;
-- Partial index: only live stories
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS stories_live_idx ON stories(user_id, created_at DESC) WHERE expires_at > now()';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "stories_select"  ON stories;
    DROP POLICY IF EXISTS "stories_insert"  ON stories;
    DROP POLICY IF EXISTS "stories_delete"  ON stories;
    CREATE POLICY "stories_select" ON stories FOR SELECT USING (true);
    CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "stories_delete" ON stories FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_views') THEN
    CREATE INDEX IF NOT EXISTS story_views_story_id_idx  ON story_views(story_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_views') THEN
    CREATE INDEX IF NOT EXISTS story_views_viewer_id_idx ON story_views(viewer_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_views') THEN
    ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "story_views_select"  ON story_views;
    DROP POLICY IF EXISTS "story_views_insert"  ON story_views;
    CREATE POLICY "story_views_select" ON story_views FOR SELECT USING (true);
    CREATE POLICY "story_views_insert" ON story_views FOR INSERT
      WITH CHECK (auth.uid() = viewer_id);
  END IF;
END $$;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS sound_name    TEXT;
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS hashtags      TEXT[];
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS share_count   INTEGER DEFAULT 0;
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_featured   BOOLEAN DEFAULT false;
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_removed    BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    CREATE INDEX IF NOT EXISTS reels_user_id_idx    ON reels(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    CREATE INDEX IF NOT EXISTS reels_created_at_idx ON reels(created_at DESC);
  END IF;
END $$;
-- Partial index: only live reels
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS reels_live_idx ON reels(created_at DESC) WHERE is_removed = false';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reels_select"  ON reels;
    DROP POLICY IF EXISTS "reels_insert"  ON reels;
    DROP POLICY IF EXISTS "reels_update"  ON reels;
    DROP POLICY IF EXISTS "reels_delete"  ON reels;
    CREATE POLICY "reels_select" ON reels FOR SELECT USING (is_removed = false OR auth.uid() = user_id);
    CREATE POLICY "reels_insert" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "reels_update" ON reels FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "reels_delete" ON reels FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_likes') THEN
    CREATE INDEX IF NOT EXISTS reel_likes_reel_id_idx ON reel_likes(reel_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_likes') THEN
    CREATE INDEX IF NOT EXISTS reel_likes_user_id_idx ON reel_likes(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_likes') THEN
    ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reel_likes_select"  ON reel_likes;
    DROP POLICY IF EXISTS "reel_likes_insert"  ON reel_likes;
    DROP POLICY IF EXISTS "reel_likes_update"  ON reel_likes;
    DROP POLICY IF EXISTS "reel_likes_delete"  ON reel_likes;
    CREATE POLICY "reel_likes_select" ON reel_likes FOR SELECT USING (true);
    CREATE POLICY "reel_likes_insert" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "reel_likes_update" ON reel_likes FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "reel_likes_delete" ON reel_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_views') THEN
    CREATE INDEX IF NOT EXISTS reel_views_reel_id_idx ON reel_views(reel_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_views') THEN
    ALTER TABLE reel_views ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reel_views_select"  ON reel_views;
    DROP POLICY IF EXISTS "reel_views_insert"  ON reel_views;
    CREATE POLICY "reel_views_select" ON reel_views FOR SELECT USING (true);
    CREATE POLICY "reel_views_insert" ON reel_views FOR INSERT WITH CHECK (true);
  END IF;
END $$;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_comments') THEN
    CREATE INDEX IF NOT EXISTS reel_comments_reel_id_idx ON reel_comments(reel_id, created_at DESC);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_comments') THEN
    ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reel_comments_select"  ON reel_comments;
    DROP POLICY IF EXISTS "reel_comments_insert"  ON reel_comments;
    DROP POLICY IF EXISTS "reel_comments_delete"  ON reel_comments;
    CREATE POLICY "reel_comments_select" ON reel_comments FOR SELECT USING (true);
    CREATE POLICY "reel_comments_insert" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "reel_comments_delete" ON reel_comments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_reels') THEN
    CREATE INDEX IF NOT EXISTS saved_reels_user_id_idx ON saved_reels(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_reels') THEN
    ALTER TABLE saved_reels ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "saved_reels_select"  ON saved_reels;
    DROP POLICY IF EXISTS "saved_reels_insert"  ON saved_reels;
    DROP POLICY IF EXISTS "saved_reels_update"  ON saved_reels;
    DROP POLICY IF EXISTS "saved_reels_delete"  ON saved_reels;
    CREATE POLICY "saved_reels_select" ON saved_reels FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "saved_reels_insert" ON saved_reels FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "saved_reels_update" ON saved_reels FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "saved_reels_delete" ON saved_reels FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_reports') THEN
    ALTER TABLE reel_reports ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can report reels" ON reel_reports;
    CREATE POLICY "Users can report reels" ON reel_reports
      FOR INSERT WITH CHECK (auth.uid() = reporter_id);
    DROP POLICY IF EXISTS "reel_reports_service"   ON reel_reports;
    CREATE POLICY "reel_reports_service" ON reel_reports
      FOR SELECT USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
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
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reactions') THEN
    CREATE INDEX IF NOT EXISTS event_reactions_event_id_idx ON event_reactions(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reactions') THEN
    ALTER TABLE event_reactions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
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
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_updates') THEN
    CREATE INDEX IF NOT EXISTS event_updates_event_id_idx ON event_updates(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_updates') THEN
    ALTER TABLE event_updates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_updates_select" ON event_updates;
    DROP POLICY IF EXISTS "event_updates_insert" ON event_updates;
    DROP POLICY IF EXISTS "event_updates_delete" ON event_updates;
    CREATE POLICY "event_updates_select" ON event_updates FOR SELECT USING (true);
    CREATE POLICY "event_updates_insert" ON event_updates FOR INSERT WITH CHECK (auth.uid() = author_id);
    CREATE POLICY "event_updates_delete" ON event_updates FOR DELETE USING (auth.uid() = author_id);
  END IF;
END $$;
-- event_waitlist
CREATE TABLE IF NOT EXISTS event_waitlist (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_waitlist') THEN
    CREATE INDEX IF NOT EXISTS event_waitlist_event_id_idx ON event_waitlist(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_waitlist') THEN
    ALTER TABLE event_waitlist ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_waitlist_select" ON event_waitlist;
    DROP POLICY IF EXISTS "event_waitlist_insert" ON event_waitlist;
    DROP POLICY IF EXISTS "event_waitlist_delete" ON event_waitlist;
    CREATE POLICY "event_waitlist_select" ON event_waitlist FOR SELECT USING (true);
    CREATE POLICY "event_waitlist_insert" ON event_waitlist FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "event_waitlist_delete" ON event_waitlist FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
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
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpools') THEN
    CREATE INDEX IF NOT EXISTS event_carpools_event_id_idx ON event_carpools(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpools') THEN
    ALTER TABLE event_carpools ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_carpools_select" ON event_carpools;
    DROP POLICY IF EXISTS "event_carpools_insert" ON event_carpools;
    DROP POLICY IF EXISTS "event_carpools_delete" ON event_carpools;
    CREATE POLICY "event_carpools_select" ON event_carpools FOR SELECT USING (true);
    CREATE POLICY "event_carpools_insert" ON event_carpools FOR INSERT WITH CHECK (auth.uid() = driver_id);
    CREATE POLICY "event_carpools_delete" ON event_carpools FOR DELETE USING (auth.uid() = driver_id);
  END IF;
END $$;
-- event_carpool_requests
CREATE TABLE IF NOT EXISTS event_carpool_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id UUID        NOT NULL REFERENCES event_carpools(id) ON DELETE CASCADE,
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rider_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (carpool_id, rider_id)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    CREATE INDEX IF NOT EXISTS ecr_carpool_id_idx ON event_carpool_requests(carpool_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    CREATE INDEX IF NOT EXISTS ecr_rider_id_idx   ON event_carpool_requests(rider_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    ALTER TABLE event_carpool_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_carpool_requests_select" ON event_carpool_requests;
    DROP POLICY IF EXISTS "event_carpool_requests_insert" ON event_carpool_requests;
    DROP POLICY IF EXISTS "event_carpool_requests_delete" ON event_carpool_requests;
    CREATE POLICY "event_carpool_requests_select" ON event_carpool_requests FOR SELECT USING (true);
    CREATE POLICY "event_carpool_requests_insert" ON event_carpool_requests FOR INSERT WITH CHECK (auth.uid() = rider_id);
    CREATE POLICY "event_carpool_requests_delete" ON event_carpool_requests FOR DELETE USING (auth.uid() = rider_id);
  END IF;
END $$;
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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
    CREATE INDEX IF NOT EXISTS wallet_tx_user_id_idx    ON wallet_transactions(user_id, created_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
    CREATE INDEX IF NOT EXISTS wallet_tx_status_idx     ON wallet_transactions(status);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
    CREATE INDEX IF NOT EXISTS wallet_tx_type_idx       ON wallet_transactions(type);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
    ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "wallet_tx_owner"   ON wallet_transactions;
    DROP POLICY IF EXISTS "wallet_tx_service" ON wallet_transactions;
    CREATE POLICY "wallet_tx_owner"   ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "wallet_tx_service" ON wallet_transactions FOR INSERT
      WITH CHECK (auth.role() IN ('service_role','postgres','authenticated'));
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  §14  ADVANCED PERFORMANCE INDEXES
-- ══════════════════════════════════════════════════════════════

-- Events: full-text search vector (GIN)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_search_vector_idx ON events USING GIN(search_vector) WHERE search_vector IS NOT NULL';
  END IF;
END $$;

-- Events: trending score for feed sorting
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_trending_idx ON events(trending_score DESC NULLS LAST, event_date DESC) WHERE is_cancelled = false';
  END IF;
END $$;

-- Events: upcoming events by date
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_upcoming_idx ON events(event_date ASC, event_time ASC) WHERE is_cancelled = false AND event_date >= CURRENT_DATE';
  END IF;
END $$;

-- Events: geo lookup (GiST — requires postgis)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_geo_idx ON events USING GIST( CAST(ST_MakePoint(lon, lat) AS geography) ) WHERE lat IS NOT NULL AND lon IS NOT NULL';
  END IF;
END $$;

-- Profiles: geo lookup
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS profiles_geo_idx ON profiles USING GIST( CAST(ST_MakePoint(lon, lat) AS geography) ) WHERE lat IS NOT NULL AND lon IS NOT NULL';
  END IF;
END $$;

-- Notifications: unread count (most common query)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(recipient_id, created_at DESC) WHERE is_read = false';
  END IF;
END $$;

-- Messages: conversation view
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(sender_id, recipient_id, created_at DESC) WHERE deleted_at IS NULL';
  END IF;
END $$;

-- Event vibes: per-event count
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_vibes') THEN
    CREATE INDEX IF NOT EXISTS event_vibes_event_idx ON event_vibes(event_id);
  END IF;
END $$;

-- Echoes: per-event comment feed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'echoes') THEN
    CREATE INDEX IF NOT EXISTS echoes_event_idx ON echoes(event_id, created_at DESC);
  END IF;
END $$;

-- Reels: hashtag search (GIN on array)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS reels_hashtags_gin ON reels USING GIN(hashtags) WHERE hashtags IS NOT NULL AND is_removed = false';
  END IF;
END $$;

-- Stories: live stories per user
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS stories_live_user_idx ON stories(user_id, expires_at DESC) WHERE expires_at > CURRENT_TIMESTAMP';
  END IF;
END $$;

-- Service bookings: provider queue
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS service_bookings_provider_idx ON service_bookings(provider_id, status, created_at DESC) WHERE status IN (''pending'',''confirmed'')';
  END IF;
END $$;

-- Follows: follower/following lookups
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    CREATE INDEX IF NOT EXISTS follows_follower_idx  ON follows(follower_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);
  END IF;
END $$;


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
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_user_memory') THEN
    ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own ai memory"  ON ai_user_memory;
    DROP POLICY IF EXISTS "Service manages ai memory" ON ai_user_memory;
    CREATE POLICY "User reads own ai memory"  ON ai_user_memory FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service manages ai memory" ON ai_user_memory FOR ALL
      USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS ai_recommendations_cache (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  event_ids    UUID[]      DEFAULT '{}',
  viber_ids    UUID[]      DEFAULT '{}',
  reasoning    TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_recommendations_cache') THEN
    ALTER TABLE ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own recs"  ON ai_recommendations_cache;
    DROP POLICY IF EXISTS "Service manages recs" ON ai_recommendations_cache;
    CREATE POLICY "User reads own recs"  ON ai_recommendations_cache FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service manages recs" ON ai_recommendations_cache FOR ALL
      USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
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
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_interactions') THEN
    ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own interactions"  ON ai_interactions;
    DROP POLICY IF EXISTS "Service inserts interactions" ON ai_interactions;
    CREATE POLICY "User reads own interactions"  ON ai_interactions FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service inserts interactions" ON ai_interactions FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_interactions') THEN
    CREATE INDEX IF NOT EXISTS ai_interactions_created ON ai_interactions(created_at);
  END IF;
END $$;


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
