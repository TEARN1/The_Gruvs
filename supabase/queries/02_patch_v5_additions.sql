-- ============================================================
--  THE GRUVS — schema_v5 additions patch
--  Adds everything from the 7 Supabase editor queries that
--  was missing from schema_v5.sql.
--  Fully idempotent — safe to run on top of v5.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  1. PROFILE COLUMNS MISSING FROM V5
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followers_count   INTEGER   DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS following_count   INTEGER   DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS events_posted     INTEGER   DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_count       INTEGER   DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vibe_equity       NUMERIC   DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp                INTEGER   DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges            TEXT[]    DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gallery   TEXT[]    DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_online       BOOLEAN   DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_events      BOOLEAN   DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance    NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base_lat     FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base_lon     FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count    INTEGER   DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role              TEXT      DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at      TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_streak    INTEGER   DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider_type     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider_rate     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider_bio      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider_verified BOOLEAN   DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coords            geography(Point, 4326);


-- ══════════════════════════════════════════════════════════════
--  2. AUTO-CREATE PROFILE ON SIGNUP (handle_new_user trigger)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
  BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      new.id,
      base_uname,
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ══════════════════════════════════════════════════════════════
--  3. FOLLOW COUNT SYNC TRIGGER
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = COALESCE(followers_count, 0) + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = COALESCE(following_count, 0) + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(0, COALESCE(followers_count, 0) - 1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0, COALESCE(following_count, 0) - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS follows_sync_counts ON public.follows;
CREATE TRIGGER follows_sync_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();


-- ══════════════════════════════════════════════════════════════
--  4. REELS — add missing columns & count-sync triggers
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS like_count    INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS view_count    INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS is_deleted    BOOLEAN DEFAULT false;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS sound_name    TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_title   TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS media_type    TEXT    DEFAULT 'video' CHECK (media_type IN ('video','image'));

-- Sync reel like count
CREATE OR REPLACE FUNCTION public.sync_reel_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = COALESCE(like_count, 0) + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET like_count = GREATEST(0, COALESCE(like_count, 0) - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_like_count_trigger ON public.reel_likes;
CREATE TRIGGER reel_like_count_trigger
  AFTER INSERT OR DELETE ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_like_count();

-- Sync reel comment count
CREATE OR REPLACE FUNCTION public.sync_reel_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comment_count = GREATEST(0, COALESCE(comment_count, 0) - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_comment_count_trigger ON public.reel_comments;
CREATE TRIGGER reel_comment_count_trigger
  AFTER INSERT OR DELETE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comment_count();

-- Sync reel view count
CREATE OR REPLACE FUNCTION public.sync_reel_view_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.reels SET view_count = COALESCE(view_count, 0) + 1 WHERE id = NEW.reel_id;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_view_count_trigger ON public.reel_views;
CREATE TRIGGER reel_view_count_trigger
  AFTER INSERT ON public.reel_views
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_view_count();


-- ══════════════════════════════════════════════════════════════
--  5. PULSE SCHEDULES (live timeline blocks per event)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pulse_schedules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_time  TIMESTAMPTZ,
  end_time    TIMESTAMPTZ,
  title       TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pulse_schedules_event ON public.pulse_schedules(event_id);
ALTER TABLE public.pulse_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pulse_schedules_select" ON public.pulse_schedules;
DROP POLICY IF EXISTS "pulse_schedules_manage" ON public.pulse_schedules;
CREATE POLICY "pulse_schedules_select" ON public.pulse_schedules FOR SELECT USING (true);
CREATE POLICY "pulse_schedules_manage" ON public.pulse_schedules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

-- Add schedule_id + enhanced columns to pulse_requests
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS schedule_id    UUID REFERENCES public.pulse_schedules(id) ON DELETE CASCADE;
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS content        TEXT;
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS request_type   TEXT DEFAULT 'media';
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'pending'
  CHECK (status IN ('pending','accepted','rejected','completed'));
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS vote_count     INTEGER DEFAULT 1;
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS is_live        BOOLEAN DEFAULT false;
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS requested_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Pulse vote count sync trigger
CREATE OR REPLACE FUNCTION public.sync_pulse_vote_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pulse_requests SET vote_count = COALESCE(vote_count, 0) + 1 WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pulse_requests SET vote_count = GREATEST(0, COALESCE(vote_count, 1) - 1) WHERE id = OLD.request_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS pulse_vote_count_trigger ON public.pulse_votes;
CREATE TRIGGER pulse_vote_count_trigger
  AFTER INSERT OR DELETE ON public.pulse_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_pulse_vote_count();

-- Enable realtime for pulse voting
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pulse_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_requests;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  6. DM_MESSAGES (was missing from v5 dm_rooms section)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID        NOT NULL REFERENCES public.dm_rooms(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  sent_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_room ON public.dm_messages(room_id, sent_at DESC);
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dm_messages_insert" ON public.dm_messages;
DROP POLICY IF EXISTS "dm_messages_select" ON public.dm_messages;
CREATE POLICY "dm_messages_insert" ON public.dm_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "dm_messages_select" ON public.dm_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.dm_rooms r
    WHERE r.id = room_id
      AND (r.participant_ids @> ARRAY[auth.uid()])
  ));

-- dm_rooms: add user_a/user_b columns for direct lookups (alongside participant_ids)
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS user_a     UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS user_b     UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS event_id   UUID REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dm_rooms_user_a ON public.dm_rooms(user_a);
CREATE INDEX IF NOT EXISTS idx_dm_rooms_user_b ON public.dm_rooms(user_b);

DROP POLICY IF EXISTS "dm_rooms_manage" ON public.dm_rooms;
CREATE POLICY "dm_rooms_manage" ON public.dm_rooms FOR ALL
  USING (user_a = auth.uid() OR user_b = auth.uid() OR participant_ids @> ARRAY[auth.uid()]);


-- ══════════════════════════════════════════════════════════════
--  7. EVENT_RSVPS — add tier_id column
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS tier_id TEXT;


-- ══════════════════════════════════════════════════════════════
--  8. GIG_POSTS — add missing columns
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS event_id  UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS slots     INTEGER DEFAULT 1;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS filled    INTEGER DEFAULT 0;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS lat       FLOAT;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS lon       FLOAT;


-- ══════════════════════════════════════════════════════════════
--  9. STORAGE BUCKET: covers
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "covers_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "covers_auth_upload"   ON storage.objects;
CREATE POLICY "covers_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "covers_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ══════════════════════════════════════════════════════════════
--  10. ENABLE REALTIME for key tables
-- ══════════════════════════════════════════════════════════════
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'events','notifications','messages','follows',
    'live_checkins','event_vibes','echoes','service_bookings',
    'gig_acceptances','dm_rooms','dm_messages','ad_campaigns',
    'event_updates','event_reactions','event_moments'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
--  11. RPCs MISSING FROM V5
-- ══════════════════════════════════════════════════════════════

-- Upsert RSVP with tier selection
CREATE OR REPLACE FUNCTION public.upsert_rsvp_tier(
  p_event_id UUID,
  p_user_id  UUID,
  p_tier_id  TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.event_rsvps (event_id, user_id, status, tier_id)
  VALUES (p_event_id, p_user_id, 'going', p_tier_id)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET tier_id = EXCLUDED.tier_id, status = 'going';
END;
$$;

-- Social Integrity Score update
CREATE OR REPLACE FUNCTION public.update_sis_score(
  p_user_id UUID,
  p_delta   INT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET social_integrity_score = GREATEST(0, LEAST(100, COALESCE(social_integrity_score, 50) + p_delta))
  WHERE id = p_user_id;
END;
$$;

-- Wallet balance increment
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(
  p_user_id UUID,
  p_amount  NUMERIC
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE id = p_user_id;
END;
$$;

-- Purge expired live_checkins (call from pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.purge_expired_checkins()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.live_checkins WHERE expires_at IS NOT NULL AND expires_at < NOW();
$$;

-- live_checkins: add expires_at for TTL-based presence
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS expires_at     TIMESTAMPTZ;
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS identity_layer TEXT DEFAULT 'public';
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS ghost_alias    TEXT;
CREATE INDEX IF NOT EXISTS idx_live_checkins_expires ON public.live_checkins(expires_at) WHERE expires_at IS NOT NULL;


-- ══════════════════════════════════════════════════════════════
--  12. CONTEXTUAL ADS — standalone (non-event-tied) type
--      v5 ties contextual_ads to campaigns; add standalone support
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS type     TEXT DEFAULT 'event' CHECK (type IN ('event','service','gig'));
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS subline  TEXT;
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS cta      TEXT DEFAULT 'View';
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS color    TEXT;
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS icon     TEXT DEFAULT 'zap';
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS badge    TEXT DEFAULT 'PROMOTED';
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE public.contextual_ads ADD COLUMN IF NOT EXISTS active   BOOLEAN DEFAULT true;


-- ══════════════════════════════════════════════════════════════
--  13. PATH CROSSINGS — add overlap_score column
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS overlap_score FLOAT DEFAULT 0;
ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS crossed_at    TIMESTAMPTZ DEFAULT now();


-- ══════════════════════════════════════════════════════════════
--  14. DISPUTES — add raised_by alias (v5 uses filed_by)
-- ══════════════════════════════════════════════════════════════
-- v5 schema uses filed_by; older schemas use raised_by.
-- Add raised_by as computed column so both column names work.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'disputes' AND column_name = 'raised_by' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.disputes ADD COLUMN raised_by UUID
      GENERATED ALWAYS AS (filed_by) STORED;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  15. INDEXES for new / updated tables
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_coords    ON public.profiles USING gist(coords);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_interests ON public.profiles USING gin(interests) WHERE interests IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pulse_requests_event_votes ON public.pulse_requests(event_id, vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_room_sent      ON public.dm_messages(room_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_is_deleted           ON public.reels(created_at DESC) WHERE is_deleted = false;
