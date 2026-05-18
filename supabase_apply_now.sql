-- ══════════════════════════════════════════════════════════════════════════════
-- THE GRUVS — APPLY NOW PATCH
-- Run the entire contents of this file in Supabase → SQL Editor
-- This is safe to run multiple times (idempotent).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Profile columns (gallery, badges, xp) ─────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_gallery TEXT[]    DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges          TEXT[]    DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp              INTEGER   DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen       TIMESTAMPTZ;

-- ── 2. Fix follows table RLS so the Follow button works ──────────────────────
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON follows;
DROP POLICY IF EXISTS "Users manage own follows" ON follows;
CREATE POLICY "Follows readable"         ON follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON follows FOR ALL    USING (auth.uid() = follower_id);

-- ── 3. Reels table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reels (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL DEFAULT 'video' CHECK (media_type IN ('video', 'image')),
  caption       TEXT    DEFAULT '',
  event_id      UUID    REFERENCES events(id) ON DELETE SET NULL,
  event_title   TEXT,
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Reel likes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (reel_id, user_id)
);

-- ── 5. Reel comments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reel_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS reels_user_id_idx      ON reels(user_id);
CREATE INDEX IF NOT EXISTS reels_created_at_idx   ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS reel_comments_reel_idx ON reel_comments(reel_id);

-- ── 7. RLS for reels ──────────────────────────────────────────────────────────
ALTER TABLE reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"  ON reels;
DROP POLICY IF EXISTS "reels_insert"  ON reels;
DROP POLICY IF EXISTS "reels_delete"  ON reels;
DROP POLICY IF EXISTS "reels_update"  ON reels;
CREATE POLICY "reels_select" ON reels FOR SELECT USING (is_deleted = FALSE);
CREATE POLICY "reels_insert" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_delete" ON reels FOR DELETE  USING (auth.uid() = user_id);
CREATE POLICY "reels_update" ON reels FOR UPDATE  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_likes_select" ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON reel_likes;
CREATE POLICY "reel_likes_select" ON reel_likes FOR SELECT USING (TRUE);
CREATE POLICY "reel_likes_insert" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON reel_likes FOR DELETE  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_comments_select" ON reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert" ON reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete" ON reel_comments;
CREATE POLICY "reel_comments_select" ON reel_comments FOR SELECT USING (TRUE);
CREATE POLICY "reel_comments_insert" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete" ON reel_comments FOR DELETE  USING (auth.uid() = user_id);

-- ── 8. Auto-sync like/comment counts via triggers ─────────────────────────────
CREATE OR REPLACE FUNCTION sync_reel_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reels SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_like_count_trigger ON reel_likes;
CREATE TRIGGER reel_like_count_trigger
  AFTER INSERT OR DELETE ON reel_likes
  FOR EACH ROW EXECUTE FUNCTION sync_reel_like_count();

CREATE OR REPLACE FUNCTION sync_reel_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reels SET comment_count = comment_count + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reels SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_comment_count_trigger ON reel_comments;
CREATE TRIGGER reel_comment_count_trigger
  AFTER INSERT OR DELETE ON reel_comments
  FOR EACH ROW EXECUTE FUNCTION sync_reel_comment_count();

-- ── 9. Storage buckets (run ONCE — comment out after first run if already exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', TRUE)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', TRUE)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', TRUE)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('event-media', 'event-media', TRUE)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "reels_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "reels_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "reels_storage_delete" ON storage.objects;
CREATE POLICY "reels_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "reels_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels' AND auth.uid() IS NOT NULL);
CREATE POLICY "reels_storage_delete" ON storage.objects FOR DELETE  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars bucket policies
DROP POLICY IF EXISTS "avatars_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_delete" ON storage.objects;
CREATE POLICY "avatars_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_storage_delete" ON storage.objects FOR DELETE  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Covers bucket policies
DROP POLICY IF EXISTS "covers_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "covers_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "covers_storage_delete" ON storage.objects;
CREATE POLICY "covers_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "covers_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
CREATE POLICY "covers_storage_delete" ON storage.objects FOR DELETE  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Event media bucket policies
DROP POLICY IF EXISTS "event_media_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "event_media_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "event_media_storage_delete" ON storage.objects;
CREATE POLICY "event_media_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "event_media_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "event_media_storage_delete" ON storage.objects FOR DELETE  USING (bucket_id = 'event-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- After running this file:
-- 1. The Follow button will work for all users
-- 2. Profile gallery photos will persist across sessions
-- 3. The Reels tab is fully backed by the database
-- 4. All 4 storage buckets are ready for uploads
