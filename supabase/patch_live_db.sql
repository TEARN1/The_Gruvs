-- ============================================================
--  THE GRUVS — Live Database Patch
--  Paste this entire file into Supabase → SQL Editor → Run
--  Safe to run multiple times (all statements are idempotent).
-- ============================================================


-- ── 1. PROFILES — missing columns ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat                   FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lon                   FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city                  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online           BOOLEAN     DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_events          BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code         TEXT        UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count        INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_gallery       TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified           BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online             BOOLEAN     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen             TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_score            INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests             TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio                   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location              TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website               TEXT;
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


-- ── 2. PROFILES — RLS ─────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles readable" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Public profiles readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ── 3. FOLLOWS — RLS ──────────────────────────────────────────────────────────
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON follows;
DROP POLICY IF EXISTS "Users manage own follows" ON follows;
CREATE POLICY "Follows readable"         ON follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON follows FOR ALL    USING (auth.uid() = follower_id);


-- ── 4. MESSAGES — missing column + RLS ────────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type      TEXT        DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url         TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id         UUID        REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id          UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude          DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude         DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_request        BOOLEAN     DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_accepted  BOOLEAN     DEFAULT false;
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


-- ── 5. LIVE CHECKINS — missing column ─────────────────────────────────────────
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS venue_name   TEXT;
ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();


-- ── 6. NOTIFICATIONS — RLS ────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications"   ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "Users read own notifications"    ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own notifications"  ON notifications FOR UPDATE USING (auth.uid() = recipient_id);


-- ── 7. STORAGE BUCKETS ────────────────────────────────────────────────────────
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

-- Storage RLS
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

CREATE POLICY "Public read avatars"     ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars"     ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars"     ON storage.objects FOR UPDATE USING  (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete avatars"     ON storage.objects FOR DELETE USING  (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public read covers"      ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers"      ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers"      ON storage.objects FOR UPDATE USING  (bucket_id = 'covers' AND auth.role() = 'authenticated');

CREATE POLICY "Public read event-media" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Public read chat_media"  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media"  ON storage.objects FOR DELETE USING  (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
