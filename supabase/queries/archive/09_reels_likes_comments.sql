-- ============================================================
--  THE GRUVS — 05: REELS, LIKES AND COMMENTS
--  Lightweight reels patch — safe to run after 03_untitled.
--  Adds any missing columns, fixes policies, re-creates triggers.
-- ============================================================

-- Ensure all columns exist (idempotent on top of 03)
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS like_count    INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS view_count    INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS is_deleted    BOOLEAN DEFAULT false;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS caption       TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_title   TEXT;

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_reels_user_id    ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_idx ON public.reel_comments(reel_id);

-- ── RLS (clean slate, idempotent) ────────────────────────────
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

-- ── Triggers (re-create, idempotent) ─────────────────────────
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
