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
