-- ── Reels Schema ──────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor

-- Reels table
CREATE TABLE IF NOT EXISTS reels (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL DEFAULT 'video' CHECK (media_type IN ('video', 'image')),
  caption       TEXT DEFAULT '',
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  event_title   TEXT,
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Reel likes
CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (reel_id, user_id)
);

-- Reel comments
CREATE TABLE IF NOT EXISTS reel_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS reels_user_id_idx      ON reels(user_id);
CREATE INDEX IF NOT EXISTS reels_created_at_idx   ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS reel_comments_reel_idx ON reel_comments(reel_id);

-- RLS
ALTER TABLE reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;

-- Reels: anyone can read non-deleted; only owner can insert/delete
CREATE POLICY "reels_select"  ON reels FOR SELECT USING (is_deleted = FALSE);
CREATE POLICY "reels_insert"  ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_delete"  ON reels FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "reels_update"  ON reels FOR UPDATE USING (auth.uid() = user_id);

-- Reel likes: anyone can read; authenticated users can insert/delete their own
CREATE POLICY "reel_likes_select" ON reel_likes FOR SELECT USING (TRUE);
CREATE POLICY "reel_likes_insert" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON reel_likes FOR DELETE USING (auth.uid() = user_id);

-- Reel comments: anyone can read; authenticated users can insert their own
CREATE POLICY "reel_comments_select" ON reel_comments FOR SELECT USING (TRUE);
CREATE POLICY "reel_comments_insert" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete" ON reel_comments FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for reels (run separately if bucket doesn't exist)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', TRUE) ON CONFLICT DO NOTHING;
-- CREATE POLICY "reels_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
-- CREATE POLICY "reels_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels' AND auth.uid() IS NOT NULL);
-- CREATE POLICY "reels_storage_delete" ON storage.objects FOR DELETE USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Auto-update like/comment counts via triggers
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

CREATE OR REPLACE TRIGGER reel_like_count_trigger
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

CREATE OR REPLACE TRIGGER reel_comment_count_trigger
AFTER INSERT OR DELETE ON reel_comments
FOR EACH ROW EXECUTE FUNCTION sync_reel_comment_count();
