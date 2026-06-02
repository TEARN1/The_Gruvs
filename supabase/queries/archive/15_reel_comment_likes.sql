-- ============================================================
--  THE GRUVS — 13: REEL COMMENT LIKES
--  Adds like_count to reel_comments and reel_comment_likes table
-- ============================================================

-- Add like_count to reel_comments if missing
ALTER TABLE public.reel_comments ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Likes on individual reel comments
CREATE TABLE IF NOT EXISTS public.reel_comment_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.reel_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reel_comment_likes_comment ON public.reel_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_reel_comment_likes_user    ON public.reel_comment_likes(user_id);

ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcl_read"   ON public.reel_comment_likes;
DROP POLICY IF EXISTS "rcl_insert" ON public.reel_comment_likes;
DROP POLICY IF EXISTS "rcl_delete" ON public.reel_comment_likes;

CREATE POLICY "rcl_read"   ON public.reel_comment_likes FOR SELECT USING (true);
CREATE POLICY "rcl_insert" ON public.reel_comment_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "rcl_delete" ON public.reel_comment_likes FOR DELETE USING (user_id = auth.uid());

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reel_comment_likes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_comment_likes;
  END IF;
END $$;
