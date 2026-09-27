-- ============================================================
--  THE GRUVS — 06: REELS AND STORAGE
--  Profile column patches, follows fix, reels table,
--  all storage buckets + RLS policies
-- ============================================================

-- ── Profile column patches ────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gallery TEXT[]  DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges          TEXT[]  DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp              INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen       TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_online     BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_events    BOOLEAN DEFAULT false;

-- ── Fix follows RLS so Follow button works ───────────────────
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON public.follows;
DROP POLICY IF EXISTS "Users manage own follows" ON public.follows;
CREATE POLICY "Follows readable"         ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- ── Reels table (idempotent) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  media_type    TEXT DEFAULT 'video' CHECK (media_type IN ('video','image')),
  caption       TEXT DEFAULT '',
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_title   TEXT,
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(reel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reels_user_id_idx      ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at_idx   ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_idx ON public.reel_comments(reel_id);

-- ── Reels RLS ─────────────────────────────────────────────────
ALTER TABLE public.reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"  ON public.reels;
DROP POLICY IF EXISTS "reels_insert"  ON public.reels;
DROP POLICY IF EXISTS "reels_update"  ON public.reels;
DROP POLICY IF EXISTS "reels_delete"  ON public.reels;
CREATE POLICY "reels_select" ON public.reels FOR SELECT USING (is_deleted = false);
CREATE POLICY "reels_insert" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update" ON public.reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete" ON public.reels FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_likes_select" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON public.reel_likes;
CREATE POLICY "reel_likes_select" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert" ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert" ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete" ON public.reel_comments FOR DELETE USING (auth.uid() = user_id);

-- ── Count sync triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_reel_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = COALESCE(like_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET like_count = GREATEST(0,COALESCE(like_count,0)-1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_like_count_trigger ON public.reel_likes;
CREATE TRIGGER reel_like_count_trigger AFTER INSERT OR DELETE ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_like_count();

CREATE OR REPLACE FUNCTION public.sync_reel_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comment_count = COALESCE(comment_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comment_count = GREATEST(0,COALESCE(comment_count,0)-1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_comment_count_trigger ON public.reel_comments;
CREATE TRIGGER reel_comment_count_trigger AFTER INSERT OR DELETE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comment_count();

-- ── Storage buckets ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic']),
  ('covers',      'covers',      true, 10485760,  ARRAY['image/jpeg','image/png','image/webp']),
  ('event-media', 'event-media', true, 104857600, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime']),
  ('reels',       'reels',       true, 104857600, ARRAY['video/mp4','video/quicktime','image/jpeg','image/png','image/webp']),
  ('moments',     'moments',     true, 52428800,  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']),
  ('chat_media',  'chat_media',  true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage RLS ───────────────────────────────────────────────
-- Drop all old policies first
DO $$ DECLARE pol TEXT;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol);
  END LOOP;
END $$;

-- Public read for all buckets
CREATE POLICY "avatars_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "covers_public_read"      ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "event_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "reels_public_read"       ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "moments_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'moments');
CREATE POLICY "chat_media_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');

-- Authenticated upload — first path segment = caller's user ID
CREATE POLICY "avatars_auth_upload"     ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars'     AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "covers_auth_upload"      ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'covers'      AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "event_media_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "reels_auth_upload"       ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reels'       AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "moments_auth_upload"     ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'moments'     AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat_media_auth_upload"  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat_media'  AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Owner delete / update
CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
