-- ============================================================
--  THE GRUVS — Live Database Patch  (v2, verified)
--  Paste this entire file into Supabase → SQL Editor → Run
--  Every statement uses IF NOT EXISTS / IF EXISTS / ON CONFLICT
--  so it is completely safe to run more than once.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  1. PROFILES — columns + RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url            TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio                   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location              TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website               TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified           BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online             BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen             TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_score            INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests             TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat                   FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lon                   FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city                  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online           BOOLEAN     DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_events          BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count        INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_gallery       TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_title          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_description    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looks_description     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year            INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender                TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_discoverable       BOOLEAN     DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token            TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_mode         TEXT        DEFAULT 'public';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak        INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_integrity_score FLOAT      DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT now();

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
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type      TEXT             DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url         TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id         UUID             REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id          UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude          DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude         DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_request        BOOLEAN          DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_accepted  BOOLEAN          DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction          TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at           TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at      TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

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
--  5. EVENT VIBES (like/react on events) — RLS
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
--  9. NOTIFICATIONS — RLS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications"    ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users update own notifications"  ON notifications;
CREATE POLICY "Users read own notifications"    ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own notifications"  ON notifications FOR UPDATE USING (auth.uid() = recipient_id);


-- ══════════════════════════════════════════════════════════════
--  10. LIVE CHECKINS — columns
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
--  12. STORAGE BUCKETS (photos, covers, events, DM media)
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

-- Storage RLS policies
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
