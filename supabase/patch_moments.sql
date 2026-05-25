-- ============================================================
-- patch_moments.sql
-- Run in Supabase SQL Editor → New Query
-- Safe to re-run — all statements are idempotent
-- ============================================================

-- ── 1. event_moments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_moments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url   TEXT NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption     TEXT,
  view_count  INTEGER DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_moments_event_idx ON public.event_moments(event_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS event_moments_user_idx  ON public.event_moments(user_id, created_at DESC);

ALTER TABLE public.event_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "moments_select" ON public.event_moments;
DROP POLICY IF EXISTS "moments_insert" ON public.event_moments;
DROP POLICY IF EXISTS "moments_delete" ON public.event_moments;
CREATE POLICY "moments_select" ON public.event_moments FOR SELECT USING (true);
CREATE POLICY "moments_insert" ON public.event_moments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "moments_delete" ON public.event_moments FOR DELETE USING (user_id = auth.uid());

-- ── 2. event_moment_views ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_moment_views (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id  UUID NOT NULL REFERENCES public.event_moments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(moment_id, user_id)
);
CREATE INDEX IF NOT EXISTS moment_views_moment_idx ON public.event_moment_views(moment_id);

ALTER TABLE public.event_moment_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "moment_views_select" ON public.event_moment_views;
DROP POLICY IF EXISTS "moment_views_insert" ON public.event_moment_views;
CREATE POLICY "moment_views_select" ON public.event_moment_views FOR SELECT USING (true);
CREATE POLICY "moment_views_insert" ON public.event_moment_views FOR INSERT WITH CHECK (user_id = auth.uid());

-- Keep view_count in sync
CREATE OR REPLACE FUNCTION public.sync_moment_view_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.event_moments
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = NEW.moment_id;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_moment_view_count_trigger ON public.event_moment_views;
CREATE TRIGGER sync_moment_view_count_trigger
  AFTER INSERT ON public.event_moment_views
  FOR EACH ROW EXECUTE FUNCTION public.sync_moment_view_count();

-- ── 3. event_moment_reactions ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_moment_reactions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id  UUID NOT NULL REFERENCES public.event_moments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(moment_id, user_id)
);
CREATE INDEX IF NOT EXISTS moment_reactions_moment_idx ON public.event_moment_reactions(moment_id);

ALTER TABLE public.event_moment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "moment_reactions_select" ON public.event_moment_reactions;
DROP POLICY IF EXISTS "moment_reactions_insert" ON public.event_moment_reactions;
DROP POLICY IF EXISTS "moment_reactions_delete" ON public.event_moment_reactions;
CREATE POLICY "moment_reactions_select" ON public.event_moment_reactions FOR SELECT USING (true);
CREATE POLICY "moment_reactions_insert" ON public.event_moment_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "moment_reactions_delete" ON public.event_moment_reactions FOR DELETE USING (user_id = auth.uid());

-- ── 4. Auto-delete expired moments (pg_cron — optional) ──────
-- If pg_cron extension is enabled in your Supabase project:
-- SELECT cron.schedule('delete-expired-moments', '0 * * * *', $$
--   DELETE FROM public.event_moments WHERE expires_at < now();
-- $$);
