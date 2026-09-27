-- ============================================================
--  THE GRUVS — SPORT MEDIA LIKES
--  Replaces the dumb likes_count integer with a proper likes
--  table so you can track who liked what, prevent double-likes,
--  and show "liked by people you follow".
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

-- ── LIKES TABLE ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_media_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id   UUID        NOT NULL REFERENCES public.sport_media(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(media_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sport_media_likes_media ON public.sport_media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_sport_media_likes_user  ON public.sport_media_likes(user_id);

ALTER TABLE public.sport_media_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_media_likes_read" ON public.sport_media_likes;
CREATE POLICY "sport_media_likes_read" ON public.sport_media_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "sport_media_likes_own" ON public.sport_media_likes;
CREATE POLICY "sport_media_likes_own" ON public.sport_media_likes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── KEEP likes_count IN SYNC VIA TRIGGER ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_sport_media_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sport_media SET likes_count = likes_count + 1 WHERE id = NEW.media_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.sport_media SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.media_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sport_media_likes_count ON public.sport_media_likes;
CREATE TRIGGER trg_sport_media_likes_count
  AFTER INSERT OR DELETE ON public.sport_media_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_sport_media_likes_count();

-- ── REALTIME ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sport_media_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sport_media_likes;
  END IF;
END;
$$;
