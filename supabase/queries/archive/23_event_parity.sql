-- ============================================================
--  THE GRUVS — NON-SPORT EVENT PARITY
--  Brings music/conference/market events up to the same level
--  as the sports platform:
--    • event_followers — follow any event (not just sport)
--    • event_media_likes — proper likes for event_media
--    • now_playing — real-time "currently playing" for setlists
--    • event_sessions now-live tracking
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

-- ── EVENT FOLLOWERS (mirrors sport_event_followers for all events) ────────────
CREATE TABLE IF NOT EXISTS public.event_followers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_lineup     BOOLEAN     DEFAULT true,   -- artist/speaker changes
  notify_updates    BOOLEAN     DEFAULT true,   -- general announcements
  notify_nowplaying BOOLEAN     DEFAULT true,   -- now playing / set starting
  notify_results    BOOLEAN     DEFAULT true,   -- hackathon scores, award results
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_followers_event ON public.event_followers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_followers_user  ON public.event_followers(user_id);
ALTER TABLE public.event_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_followers_own" ON public.event_followers;
CREATE POLICY "event_followers_own" ON public.event_followers FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "event_followers_read" ON public.event_followers;
CREATE POLICY "event_followers_read" ON public.event_followers FOR SELECT USING (true);

-- ── NOW PLAYING (real-time current setlist entry) ─────────────────────────────
-- One active row per event at any time. Host marks a song as playing;
-- previous row is automatically cleared by trigger.
CREATE TABLE IF NOT EXISTS public.event_now_playing (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  lineup_id   UUID        REFERENCES public.event_lineup(id) ON DELETE SET NULL,
  setlist_id  UUID        REFERENCES public.event_setlists(id) ON DELETE SET NULL,
  artist_name TEXT        NOT NULL,
  song_title  TEXT,
  started_at  TIMESTAMPTZ DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  is_active   BOOLEAN     DEFAULT true,
  UNIQUE(event_id, is_active) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_now_playing_event ON public.event_now_playing(event_id) WHERE is_active = true;
ALTER TABLE public.event_now_playing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "now_playing_read" ON public.event_now_playing;
CREATE POLICY "now_playing_read" ON public.event_now_playing FOR SELECT USING (true);
DROP POLICY IF EXISTS "now_playing_host" ON public.event_now_playing;
CREATE POLICY "now_playing_host" ON public.event_now_playing FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- Trigger: when a new now_playing is inserted, close out the previous active one
CREATE OR REPLACE FUNCTION public.on_now_playing_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.event_now_playing
  SET is_active = false, ended_at = now()
  WHERE event_id = NEW.event_id
    AND is_active = true
    AND id <> NEW.id;

  -- Mark the matched setlist entry as played
  IF NEW.setlist_id IS NOT NULL THEN
    UPDATE public.event_setlists
    SET is_played = true, played_at = now()
    WHERE id = NEW.setlist_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_now_playing_insert ON public.event_now_playing;
CREATE TRIGGER trg_now_playing_insert
  AFTER INSERT ON public.event_now_playing
  FOR EACH ROW EXECUTE FUNCTION public.on_now_playing_insert();

-- ── EVENT MEDIA TABLE (created if missing) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption     TEXT,
  tags        TEXT[],
  likes_count INTEGER     DEFAULT 0,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_media_event ON public.event_media(event_id, created_at DESC);
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_media_read" ON public.event_media;
CREATE POLICY "event_media_read" ON public.event_media FOR SELECT USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "event_media_own" ON public.event_media;
CREATE POLICY "event_media_own" ON public.event_media FOR INSERT WITH CHECK (uploader_id = auth.uid());

-- ── EVENT MEDIA LIKES (for general event photos/videos) ──────────────────────
CREATE TABLE IF NOT EXISTS public.event_media_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id   UUID        NOT NULL REFERENCES public.event_media(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(media_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_media_likes_media ON public.event_media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_event_media_likes_user  ON public.event_media_likes(user_id);
ALTER TABLE public.event_media_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_media_likes_read" ON public.event_media_likes;
CREATE POLICY "event_media_likes_read" ON public.event_media_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_media_likes_own" ON public.event_media_likes;
CREATE POLICY "event_media_likes_own" ON public.event_media_likes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Sync likes_count on event_media (add column if it doesn't exist)
ALTER TABLE public.event_media ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_event_media_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.event_media SET likes_count = likes_count + 1 WHERE id = NEW.media_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.event_media SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.media_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_media_likes_count ON public.event_media_likes;
CREATE TRIGGER trg_event_media_likes_count
  AFTER INSERT OR DELETE ON public.event_media_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_media_likes_count();

-- ── SESSION LIVE TRACKING ─────────────────────────────────────────────────────
-- is_live already on event_sessions; add soft end tracking
ALTER TABLE public.event_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.event_sessions ADD COLUMN IF NOT EXISTS recording_live_url TEXT;

-- ── REALTIME ──────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'event_followers',
    'event_now_playing',
    'event_media_likes',
    'event_sessions'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
