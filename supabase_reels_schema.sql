-- ============================================================
--  THE GRUVS — Reels Database Schema (Short-form Video)
--  File: supabase_reels_schema.sql
--  Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- ══════════════════════════════════════════════════════════════
--  1. REELS Table
-- ══════════════════════════════════════════════════════════════
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

-- Indexing for fast feed load
CREATE INDEX IF NOT EXISTS reels_user_id_idx ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS reels_created_at_idx ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS reels_like_count_idx ON public.reels(like_count DESC) WHERE is_deleted = false;

-- ══════════════════════════════════════════════════════════════
--  2. REEL LIKES Table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS reel_likes_user_id_idx ON public.reel_likes(user_id);

-- ══════════════════════════════════════════════════════════════
--  3. REEL COMMENTS Table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reel_comments_reel_id_idx ON public.reel_comments(reel_id);

-- ══════════════════════════════════════════════════════════════
--  4. REEL VIEWS Table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reel_views (
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_id     UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS reel_views_viewer_id_idx ON public.reel_views(viewer_id);

-- ══════════════════════════════════════════════════════════════
--  5. SAVED REELS Table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.saved_reels (
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS saved_reels_user_id_idx ON public.saved_reels(user_id);

-- ══════════════════════════════════════════════════════════════
--  6. REEL REPORTS Table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reel_reports (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id       UUID          NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  reporter_id   UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason        TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (reel_id, reporter_id)
);

-- ══════════════════════════════════════════════════════════════
--  7. ROW-LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_reports ENABLE ROW LEVEL SECURITY;

-- Reels Policies
DROP POLICY IF EXISTS "Reels readable by all" ON public.reels;
CREATE POLICY "Reels readable by all" ON public.reels
  FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "Authenticated users insert reels" ON public.reels;
CREATE POLICY "Authenticated users insert reels" ON public.reels
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users update own reels" ON public.reels;
CREATE POLICY "Users update own reels" ON public.reels
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own reels" ON public.reels;
CREATE POLICY "Users delete own reels" ON public.reels
  FOR DELETE USING (auth.uid() = user_id);

-- Reel Likes Policies
DROP POLICY IF EXISTS "Reel likes readable by all" ON public.reel_likes;
CREATE POLICY "Reel likes readable by all" ON public.reel_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own likes" ON public.reel_likes;
CREATE POLICY "Users manage own likes" ON public.reel_likes
  FOR ALL USING (auth.uid() = user_id);

-- Reel Comments Policies
DROP POLICY IF EXISTS "Reel comments readable by all" ON public.reel_comments;
CREATE POLICY "Reel comments readable by all" ON public.reel_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own comments" ON public.reel_comments;
CREATE POLICY "Users insert own comments" ON public.reel_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users update own comments" ON public.reel_comments;
CREATE POLICY "Users update own comments" ON public.reel_comments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own comments" ON public.reel_comments;
CREATE POLICY "Users delete own comments" ON public.reel_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Reel Views Policies
DROP POLICY IF EXISTS "Users log own views" ON public.reel_views;
CREATE POLICY "Users log own views" ON public.reel_views
  FOR ALL USING (auth.uid() = viewer_id);

-- Saved Reels Policies
DROP POLICY IF EXISTS "Users manage own saved reels" ON public.saved_reels;
CREATE POLICY "Users manage own saved reels" ON public.saved_reels
  FOR ALL USING (auth.uid() = user_id);

-- Reel Reports Policies
DROP POLICY IF EXISTS "Users can report reels" ON public.reel_reports;
CREATE POLICY "Users can report reels" ON public.reel_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id AND auth.role() = 'authenticated');

-- ══════════════════════════════════════════════════════════════
--  8. AUTOMATIC COUNT SYNCHRONIZATION (TRIGGERS)
-- ══════════════════════════════════════════════════════════════

-- Reel Likes Count sync
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

-- Reel Comments Count sync
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

-- Reel Views Count sync
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
