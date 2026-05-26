-- ============================================================
--  THE GRUVS — 03: UNTITLED (Reels — Full)
--  reels, reel_likes, reel_comments, reel_views,
--  saved_reels, reel_reports + count triggers + RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_title   TEXT,
  media_url     TEXT NOT NULL,
  media_type    TEXT DEFAULT 'video' CHECK (media_type IN ('video','image')),
  caption       TEXT CHECK (length(caption) <= 500),
  sound_name    TEXT,
  hashtags      TEXT[],
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  likes_count   INTEGER DEFAULT 0,
  views_count   INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reels_user       ON public.reels(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_event      ON public.reels(event_id);
CREATE INDEX IF NOT EXISTS idx_reels_feed       ON public.reels(created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_reels_likes      ON public.reels(like_count DESC) WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_likes_user ON public.reel_likes(user_id);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON public.reel_comments(reel_id);

CREATE TABLE IF NOT EXISTS public.reel_views (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(reel_id, viewer_id)
);
ALTER TABLE public.reel_views ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.saved_reels (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_reels_user ON public.saved_reels(user_id);

CREATE TABLE IF NOT EXISTS public.reel_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reel_reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.reel_reports ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reel_reports_reporter
  ON public.reel_reports(reel_id, reporter_id) WHERE reporter_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reel_reports_user
  ON public.reel_reports(reel_id, user_id) WHERE user_id IS NOT NULL AND reporter_id IS NULL;

-- ── Count sync triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_reel_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = COALESCE(like_count,0)+1, likes_count = COALESCE(likes_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET like_count = GREATEST(0,COALESCE(like_count,0)-1), likes_count = GREATEST(0,COALESCE(likes_count,0)-1) WHERE id = OLD.reel_id;
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

CREATE OR REPLACE FUNCTION public.sync_reel_view_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.reels SET view_count = COALESCE(view_count,0)+1, views_count = COALESCE(views_count,0)+1 WHERE id = NEW.reel_id;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_view_count_trigger ON public.reel_views;
CREATE TRIGGER reel_view_count_trigger AFTER INSERT ON public.reel_views
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_view_count();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.reels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"     ON public.reels;
DROP POLICY IF EXISTS "reels_insert"     ON public.reels;
DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
DROP POLICY IF EXISTS "reels_delete_own" ON public.reels;
CREATE POLICY "reels_select"     ON public.reels FOR SELECT USING (is_deleted = false);
CREATE POLICY "reels_insert"     ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_likes_select" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_manage" ON public.reel_likes;
CREATE POLICY "reel_likes_select" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_manage" ON public.reel_likes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_manage" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_manage" ON public.reel_comments FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_views_manage" ON public.reel_views;
CREATE POLICY "reel_views_manage" ON public.reel_views FOR ALL
  USING (viewer_id = auth.uid() OR user_id = auth.uid());

DROP POLICY IF EXISTS "saved_reels_manage" ON public.saved_reels;
CREATE POLICY "saved_reels_manage" ON public.saved_reels FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_reports_insert" ON public.reel_reports;
CREATE POLICY "reel_reports_insert" ON public.reel_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid() OR user_id = auth.uid());
