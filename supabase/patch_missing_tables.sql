-- ============================================================
-- patch_missing_tables.sql
-- Run in Supabase SQL Editor → New Query
-- Safe to re-run — all statements are idempotent
-- ============================================================

-- ── 1. event_vibes (powers the Vibe button) ──────────────────
CREATE TABLE IF NOT EXISTS public.event_vibes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_vibes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_vibes_select" ON public.event_vibes;
DROP POLICY IF EXISTS "event_vibes_insert" ON public.event_vibes;
DROP POLICY IF EXISTS "event_vibes_delete" ON public.event_vibes;
CREATE POLICY "event_vibes_select" ON public.event_vibes FOR SELECT USING (true);
CREATE POLICY "event_vibes_insert" ON public.event_vibes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_vibes_delete" ON public.event_vibes FOR DELETE USING (user_id = auth.uid());

-- Keep vibe_count on events in sync
CREATE OR REPLACE FUNCTION public.sync_vibe_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET vibe_count = COALESCE(vibe_count, 0) + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET vibe_count = GREATEST(0, COALESCE(vibe_count, 0) - 1) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_vibe_count_trigger ON public.event_vibes;
CREATE TRIGGER sync_vibe_count_trigger
  AFTER INSERT OR DELETE ON public.event_vibes
  FOR EACH ROW EXECUTE FUNCTION public.sync_vibe_count();

-- RPC fallback for increment/decrement
CREATE OR REPLACE FUNCTION public.increment_vibe_count(p_event_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_vibes(event_id, user_id) VALUES (p_event_id, p_user_id) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_vibe_count(p_event_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.event_vibes WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;

-- ── 2. activity_feed (powers FriendActivityFeed + Activity tab) ──
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  body          TEXT,
  title         TEXT,
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_feed_recipient_idx ON public.activity_feed(recipient_id, created_at DESC);
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_feed_select_own" ON public.activity_feed;
DROP POLICY IF EXISTS "activity_feed_insert_sys" ON public.activity_feed;
CREATE POLICY "activity_feed_select_own" ON public.activity_feed FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "activity_feed_insert_sys" ON public.activity_feed FOR INSERT WITH CHECK (true);

-- mark_activity_read RPC (called when user taps activity tab)
CREATE OR REPLACE FUNCTION public.mark_activity_read(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.activity_feed SET is_read = true WHERE recipient_id = p_user_id AND is_read = false;
END;
$$;

-- ── 3. display_name column on profiles ───────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ── 4. event_carpools — add return_trip / return_time columns ──
ALTER TABLE public.event_carpools ADD COLUMN IF NOT EXISTS return_trip   BOOLEAN DEFAULT false;
ALTER TABLE public.event_carpools ADD COLUMN IF NOT EXISTS return_time   TIMESTAMPTZ;

-- ── 5. event_carpool_requests — add status column ─────────────
ALTER TABLE public.event_carpool_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'accepted', 'declined'));

-- accept_carpool_request / decline_carpool_request RPCs
CREATE OR REPLACE FUNCTION public.accept_carpool_request(p_request_id uuid, p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_driver_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.event_carpool_requests SET status = 'accepted'
  WHERE id = p_request_id
    AND carpool_id IN (SELECT id FROM public.event_carpools WHERE driver_id = p_driver_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_carpool_request(p_request_id uuid, p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_driver_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.event_carpool_requests SET status = 'declined'
  WHERE id = p_request_id
    AND carpool_id IN (SELECT id FROM public.event_carpools WHERE driver_id = p_driver_id);
END;
$$;

-- ── 6. Ensure events has vibe_count & media_urls columns ─────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS vibe_count  INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS media_urls  TEXT[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_url   TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS media       JSONB;

-- ── 7. Storage buckets (idempotent) ──────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('event-media', 'event-media', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for all buckets
DROP POLICY IF EXISTS "event_media_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read"       ON storage.objects;
DROP POLICY IF EXISTS "reels_public_read"         ON storage.objects;
CREATE POLICY "event_media_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "avatars_public_read"      ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "reels_public_read"        ON storage.objects FOR SELECT USING (bucket_id = 'reels');

-- Authenticated upload
DROP POLICY IF EXISTS "event_media_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_upload"      ON storage.objects;
DROP POLICY IF EXISTS "reels_auth_upload"        ON storage.objects;
CREATE POLICY "event_media_auth_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');
CREATE POLICY "avatars_auth_upload"     ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars'     AND auth.role() = 'authenticated');
CREATE POLICY "reels_auth_upload"       ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels'       AND auth.role() = 'authenticated');

-- Owner delete / update
DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
