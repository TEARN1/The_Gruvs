-- ==============================================================================
--  THE GRUVS — Master Combined Database Schema & Patch
--  File: supabase_combined_schema.sql
--  
--  Paste this entire file into Supabase → SQL Editor and click RUN.
--  Every statement is idempotent — safe to run multiple times.
-- ==============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
--  1. PROFILE COLUMNS & SECURITY
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name           TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url             TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url              TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio                    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location               TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website                TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified            BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online              BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen              TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vibe_score             INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests              TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat                    FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lon                    FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city                   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_online            BOOLEAN     DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_events           BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count         INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gallery        TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS career_title           TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS career_description     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS looks_description      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_year             INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender                 TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_discoverable        BOOLEAN     DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token             TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS identity_mode          TEXT        DEFAULT 'public';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_streak         INTEGER     DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_integrity_score FLOAT       DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles readable" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

-- Privacy-hardened profile visibility (authenticated users only for public mode, owner only for ghost/celebrity)
CREATE POLICY "Public profiles readable" ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR
  (
    identity_mode = 'public'
    AND auth.role() = 'authenticated'
  )
);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ══════════════════════════════════════════════════════════════════════════════
--  2. FOLLOWS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON public.follows;
DROP POLICY IF EXISTS "Users manage own follows" ON public.follows;
CREATE POLICY "Follows readable"         ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON public.follows FOR ALL    USING (auth.uid() = follower_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  3. MESSAGES (DIRECT MESSAGING)
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

-- Enforce spam blocking checks at DB level
CREATE POLICY "Users send own messages" ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND NOT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = recipient_id AND blocked_id = auth.uid()
  )
);

CREATE POLICY "Users update own messages" ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  4. EVENTS & ENGAGEMENT
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events readable by all"            ON public.events;
DROP POLICY IF EXISTS "Authenticated users insert events" ON public.events;
DROP POLICY IF EXISTS "Users update own events"           ON public.events;
DROP POLICY IF EXISTS "Users delete own events"           ON public.events;

CREATE POLICY "Events readable by all"            ON public.events FOR SELECT USING (true);
CREATE POLICY "Authenticated users insert events" ON public.events FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users update own events"           ON public.events FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users delete own events"           ON public.events FOR DELETE USING (auth.uid() = author_id);

-- Event Vibes RLS
ALTER TABLE public.event_vibes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event vibes readable"         ON public.event_vibes;
DROP POLICY IF EXISTS "Users manage own event vibes" ON public.event_vibes;
CREATE POLICY "Event vibes readable"         ON public.event_vibes FOR SELECT USING (true);
CREATE POLICY "Users manage own event vibes" ON public.event_vibes FOR ALL    USING (auth.uid() = user_id);

-- Saved Events RLS
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saves" ON public.saved_events;
CREATE POLICY "Users manage own saves" ON public.saved_events FOR ALL USING (auth.uid() = user_id);

-- Event RSVPs RLS
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RSVPs readable"         ON public.event_rsvps;
DROP POLICY IF EXISTS "Users manage own RSVPs" ON public.event_rsvps;
CREATE POLICY "RSVPs readable"         ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users manage own RSVPs" ON public.event_rsvps FOR ALL    USING (auth.uid() = user_id);

-- Echoes (Comments) RLS
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
--  5. SYSTEM & NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications"    ON public.notifications;
DROP POLICY IF EXISTS "System insert notifications"     ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications"  ON public.notifications;
CREATE POLICY "Users read own notifications"   ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "System insert notifications"    ON public.notifications FOR INSERT WITH CHECK (auth.role() IN ('service_role', 'postgres', 'authenticated'));
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- Live Checkins
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS venue_name    TEXT;
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Checkins readable"         ON public.live_checkins;
DROP POLICY IF EXISTS "Users manage own checkins" ON public.live_checkins;
CREATE POLICY "Checkins readable"         ON public.live_checkins FOR SELECT USING (true);
CREATE POLICY "Users manage own checkins" ON public.live_checkins FOR ALL    USING (auth.uid() = user_id);

-- App Updates
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS type        TEXT DEFAULT 'feature';
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read app_updates" ON public.app_updates;
CREATE POLICY "Anyone can read app_updates" ON public.app_updates FOR SELECT USING (true);

-- Campaign Analytics
DROP POLICY IF EXISTS "analytics_insert" ON public.campaign_analytics;
CREATE POLICY "analytics_insert" ON public.campaign_analytics FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Views (Security Invoker)
DROP VIEW IF EXISTS public.vibes CASCADE;
CREATE OR REPLACE VIEW public.vibes WITH (security_invoker = true) AS SELECT * FROM public.event_vibes;

DROP VIEW IF EXISTS public.conversations CASCADE;
CREATE OR REPLACE VIEW public.conversations WITH (security_invoker = true) AS SELECT * FROM public.dm_rooms;

-- Spatial Ref System RLS
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spatial_ref_sys public read" ON public.spatial_ref_sys;
CREATE POLICY "spatial_ref_sys public read" ON public.spatial_ref_sys FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
--  6. REELS (SHORT-FORM VIDEO MODULE)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reels (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caption       TEXT,
  media_url     TEXT          NOT NULL,
  media_type    TEXT          NOT NULL DEFAULT 'video',
  sound_name    TEXT,
  event_id      UUID          REFERENCES public.events(id) ON DELETE SET NULL,
  event_title   TEXT,
  like_count    INTEGER       NOT NULL DEFAULT 0,
  comment_count INTEGER       NOT NULL DEFAULT 0,
  view_count    INTEGER       NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN       NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reels_user_id_idx ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS reels_created_at_idx ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS reels_like_count_idx ON public.reels(like_count DESC) WHERE is_deleted = false;

-- Reel Likes Table
CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS reel_likes_user_id_idx ON public.reel_likes(user_id);

-- Reel Comments Table
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reel_comments_reel_id_idx ON public.reel_comments(reel_id);

-- Reel Views Table
CREATE TABLE IF NOT EXISTS public.reel_views (
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_id     UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS reel_views_viewer_id_idx ON public.reel_views(viewer_id);

-- Saved Reels Table
CREATE TABLE IF NOT EXISTS public.saved_reels (
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS saved_reels_user_id_idx ON public.saved_reels(user_id);

-- Reel Reports Table
CREATE TABLE IF NOT EXISTS public.reel_reports (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  reporter_id   UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason        TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (reel_id, reporter_id)
);

-- Reels RLS
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reels readable by all" ON public.reels;
CREATE POLICY "Reels readable by all" ON public.reels FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "Authenticated users insert reels" ON public.reels;
CREATE POLICY "Authenticated users insert reels" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users update own reels" ON public.reels;
CREATE POLICY "Users update own reels" ON public.reels FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own reels" ON public.reels;
CREATE POLICY "Users delete own reels" ON public.reels FOR DELETE USING (auth.uid() = user_id);

-- Reel Likes Policies
DROP POLICY IF EXISTS "Reel likes readable by all" ON public.reel_likes;
CREATE POLICY "Reel likes readable by all" ON public.reel_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own likes" ON public.reel_likes;
CREATE POLICY "Users manage own likes" ON public.reel_likes FOR ALL USING (auth.uid() = user_id);

-- Reel Comments Policies
DROP POLICY IF EXISTS "Reel comments readable by all" ON public.reel_comments;
CREATE POLICY "Reel comments readable by all" ON public.reel_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own comments" ON public.reel_comments;
CREATE POLICY "Users insert own comments" ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users update own comments" ON public.reel_comments;
CREATE POLICY "Users update own comments" ON public.reel_comments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own comments" ON public.reel_comments;
CREATE POLICY "Users delete own comments" ON public.reel_comments FOR DELETE USING (auth.uid() = user_id);

-- Reel Views Policies
DROP POLICY IF EXISTS "Users log own views" ON public.reel_views;
CREATE POLICY "Users log own views" ON public.reel_views FOR ALL USING (auth.uid() = viewer_id);

-- Saved Reels Policies
DROP POLICY IF EXISTS "Users manage own saved reels" ON public.saved_reels;
CREATE POLICY "Users manage own saved reels" ON public.saved_reels FOR ALL USING (auth.uid() = user_id);

-- Reel Reports Policies
DROP POLICY IF EXISTS "Users can report reels" ON public.reel_reports;
CREATE POLICY "Users can report reels" ON public.reel_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id AND auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════════
--  7. STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════════════════════
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

-- Bucket Security & Clean Up
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

-- Storage Policies with owner folders enforcement
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth delete avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read covers" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers" ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

CREATE POLICY "Public read event-media" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Public read chat_media" ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media" ON storage.objects FOR DELETE USING (bucket_id = 'chat_media' AND auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════════
--  8. AI MEMORY & LOGS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  user_id        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferences    JSONB        DEFAULT '{}',
  behaviour      JSONB        DEFAULT '{}',
  summary        TEXT,
  updated_at     TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own ai memory"    ON public.ai_user_memory;
DROP POLICY IF EXISTS "Service manages ai memory"   ON public.ai_user_memory;
CREATE POLICY "User reads own ai memory"  ON public.ai_user_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages ai memory" ON public.ai_user_memory FOR ALL   USING (auth.role() IN ('service_role','postgres'));

CREATE TABLE IF NOT EXISTS public.ai_recommendations_cache (
  user_id        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_ids      UUID[]       DEFAULT '{}',
  viber_ids      UUID[]       DEFAULT '{}',
  reasoning      TEXT,
  generated_at   TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE public.ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own recs"   ON public.ai_recommendations_cache;
DROP POLICY IF EXISTS "Service manages recs"  ON public.ai_recommendations_cache;
CREATE POLICY "User reads own recs"  ON public.ai_recommendations_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages recs" ON public.ai_recommendations_cache FOR ALL   USING (auth.role() IN ('service_role','postgres'));

CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature        TEXT         NOT NULL,
  input          TEXT,
  output         TEXT,
  model          TEXT,
  tokens_used    INTEGER,
  feedback       INTEGER,
  created_at     TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own interactions"    ON public.ai_interactions;
DROP POLICY IF EXISTS "Service inserts interactions"   ON public.ai_interactions;
CREATE POLICY "User reads own interactions"  ON public.ai_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts interactions" ON public.ai_interactions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ai_interactions_created ON public.ai_interactions(created_at);

CREATE TABLE IF NOT EXISTS public.ai_moderation_queue (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type   TEXT         NOT NULL,
  content_id     UUID         NOT NULL,
  content_text   TEXT         NOT NULL,
  author_id      UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  status         TEXT         DEFAULT 'pending',
  ai_verdict     TEXT,
  ai_reason      TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE public.ai_moderation_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service manages moderation" ON public.ai_moderation_queue;
CREATE POLICY "Service manages moderation" ON public.ai_moderation_queue FOR ALL USING (auth.role() IN ('service_role','postgres'));


-- ══════════════════════════════════════════════════════════════════════════════
--  9. TRIGGERS & FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Reel Likes Count sync trigger
CREATE OR REPLACE FUNCTION public.sync_reel_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET like_count = LEAST(0, like_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_reel_likes_count ON public.reel_likes;
CREATE TRIGGER trg_sync_reel_likes_count
AFTER INSERT OR DELETE ON public.reel_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_reel_likes_count();

-- Reel Comments Count sync trigger
CREATE OR REPLACE FUNCTION public.sync_reel_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comment_count = comment_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comment_count = LEAST(0, comment_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_reel_comments_count ON public.reel_comments;
CREATE TRIGGER trg_sync_reel_comments_count
AFTER INSERT OR DELETE ON public.reel_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comments_count();

-- Reel Views Count sync trigger
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

-- Secure Existing Functions
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

-- safe nearby vibers search function with fuzzing
CREATE OR REPLACE FUNCTION public.get_safe_nearby_vibers(u_lat FLOAT, u_lon FLOAT, radius_km FLOAT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  vibe_score INTEGER,
  distance_km FLOAT,
  lat FLOAT,
  lon FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.vibe_score,
    (ST_Distance(ST_MakePoint(p.lon, p.lat)::geography, ST_MakePoint(u_lon, u_lat)::geography) / 1000) as distance_km,
    CASE
      WHEN p.identity_mode = 'ghost' THEN p.lat + (random() - 0.5) * 0.01 -- Fuzz ~1km
      ELSE p.lat
    END as lat,
    CASE
      WHEN p.identity_mode = 'ghost' THEN p.lon + (random() - 0.5) * 0.01
      ELSE p.lon
    END as lon
  FROM public.profiles p
  WHERE
    p.is_discoverable = true
    AND p.identity_mode != 'celebrity'
    AND (ST_Distance(ST_MakePoint(p.lon, p.lat)::geography, ST_MakePoint(u_lon, u_lat)::geography) / 1000) <= radius_km
    AND p.id != auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
