-- ══════════════════════════════════════════════════════════════
--  THE GRUVS — SCHEMA DRIFT RECONCILIATION & SECURITY HARDENING
-- ══════════════════════════════════════════════════════════════
--  This script aligns the live database with code expectations:
--  1. Adds missing columns to activity_feed, event_views, path_crossings, route_steps.
--  2. Adds gamification column support (vibe_coins, reputation_status) to profiles.
--  3. Hardens RLS security on live_checkins, profiles, and admin RPCs.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Column Drift Reconciliation ────────────────────────────

-- activity_feed expects 'read' column (synced with is_read if needed)
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- Sync read and is_read in triggers to maintain backward compatibility
CREATE OR REPLACE FUNCTION sync_activity_feed_read_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.read := COALESCE(NEW.read, NEW.is_read, false);
    NEW.is_read := COALESCE(NEW.is_read, NEW.read, false);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.read IS DISTINCT FROM OLD.read THEN
      NEW.is_read := NEW.read;
    ELSIF NEW.is_read IS DISTINCT FROM OLD.is_read THEN
      NEW.read := NEW.is_read;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_activity_feed_read ON public.activity_feed;
CREATE TRIGGER trg_sync_activity_feed_read
  BEFORE INSERT OR UPDATE ON public.activity_feed
  FOR EACH ROW EXECUTE FUNCTION sync_activity_feed_read_status();

-- event_views expects 'author_id'
ALTER TABLE public.event_views ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- path_crossings expects user_id and cross_count
ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS other_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS cross_count INTEGER DEFAULT 1;

-- route_steps expects step_order
ALTER TABLE public.route_steps ADD COLUMN IF NOT EXISTS step_order INTEGER DEFAULT 1;

-- ticket_tokens table
CREATE TABLE IF NOT EXISTS public.ticket_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token_str TEXT UNIQUE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ticket_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_tokens_own" ON public.ticket_tokens;
CREATE POLICY "ticket_tokens_own" ON public.ticket_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. Gamification Columns ───────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vibe_coins INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_status TEXT DEFAULT 'Novice Viber';


-- ── 3. RLS Security Hardening ────────────────────────────────

-- GPS location harvesting prevention on live_checkins
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_checkins are viewable by everyone" ON public.live_checkins;
DROP POLICY IF EXISTS "Enable read access for all users"        ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins: owner reads own"          ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins: authenticated read"       ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins: owner management"         ON public.live_checkins;

-- 1. Owners read and write their own check-ins
CREATE POLICY "live_checkins: owner management"
  ON public.live_checkins FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Authenticated users can read event check-ins (guest list)
CREATE POLICY "live_checkins: authenticated read"
  ON public.live_checkins FOR SELECT
  TO authenticated
  USING (true);

-- 3. Anonymous users are blocked from SELECTing checkins
REVOKE SELECT ON public.live_checkins FROM anon;
REVOKE SELECT (lat, lon) ON public.live_checkins FROM anon, authenticated;

-- Explicitly grant other columns to authenticated users
GRANT SELECT (id, user_id, event_id, checked_in_at, expires_at, identity_layer, ghost_alias)
  ON public.live_checkins TO authenticated;

-- Hide profiles PII from anonymous users
REVOKE SELECT (email, push_token, emergency_contacts, siblings, first_name, surname)
  ON public.profiles FROM anon;

-- Require login to read the social graph (follows)
-- Require login to read and manage the social graph (follows)
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "follows: authenticated read"       ON public.follows;
DROP POLICY IF EXISTS "Follows readable"                 ON public.follows;
DROP POLICY IF EXISTS "follows_select"                   ON public.follows;
DROP POLICY IF EXISTS "follows_insert"                   ON public.follows;
DROP POLICY IF EXISTS "follows_delete"                   ON public.follows;

CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- Hardening / verifying messages RLS policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_insert_own"   ON public.messages;
DROP POLICY IF EXISTS "messages_select_own"   ON public.messages;
DROP POLICY IF EXISTS "messages_update_parts" ON public.messages;

CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_update_parts" ON public.messages FOR UPDATE TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Reels RLS Verification
ALTER TABLE public.reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"     ON public.reels;
DROP POLICY IF EXISTS "reels_insert"     ON public.reels;
DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
DROP POLICY IF EXISTS "reels_delete_own" ON public.reels;
CREATE POLICY "reels_select"     ON public.reels FOR SELECT USING (is_deleted = false);
CREATE POLICY "reels_insert"     ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_likes_select" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON public.reel_likes;
CREATE POLICY "reel_likes_select" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert" ON public.reel_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reel_likes_delete" ON public.reel_likes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert" ON public.reel_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reel_comments_delete" ON public.reel_comments FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "rcl_read"   ON public.reel_comment_likes;
DROP POLICY IF EXISTS "rcl_insert" ON public.reel_comment_likes;
DROP POLICY IF EXISTS "rcl_delete" ON public.reel_comment_likes;
CREATE POLICY "rcl_read"   ON public.reel_comment_likes FOR SELECT USING (true);
CREATE POLICY "rcl_insert" ON public.reel_comment_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "rcl_delete" ON public.reel_comment_likes FOR DELETE USING (user_id = auth.uid());

-- Trigger for reel_comment_likes count synchronization
CREATE OR REPLACE FUNCTION public.sync_reel_comment_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reel_comments SET like_count = COALESCE(like_count,0)+1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reel_comments SET like_count = GREATEST(0,COALESCE(like_count,0)-1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reel_comment_like_count_trigger ON public.reel_comment_likes;
CREATE TRIGGER reel_comment_like_count_trigger AFTER INSERT OR DELETE ON public.reel_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comment_like_count();

-- ── 4. Storage Buckets and Policies ─────────────────────────────
-- Ensure storage extension and schema exists
CREATE SCHEMA IF NOT EXISTS storage;

-- Insert buckets if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('event-media', 'event-media', true, 104857600, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/x-m4v','video/webm']),
  ('reels',       'reels',       true, 104857600, ARRAY['video/mp4','video/quicktime','video/x-m4v','video/webm','image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('moments',     'moments',     true, 52428800,  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/x-m4v','video/webm']),
  ('chat_media',  'chat_media',  true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Public read for all buckets
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "covers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "event_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "reels_public_read" ON storage.objects;
DROP POLICY IF EXISTS "moments_public_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_public_read" ON storage.objects;

CREATE POLICY "avatars_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "covers_public_read"      ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "event_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "reels_public_read"       ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "moments_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'moments');
CREATE POLICY "chat_media_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');

-- Authenticated upload
DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "covers_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "event_media_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "reels_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "moments_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_auth_upload" ON storage.objects;

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
DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Pinned search_path security on Admin functions
CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  
  INSERT INTO public.user_suspensions (user_id, reason, suspended_by)
  VALUES (p_user_id, 'Suspended by admin', auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles
  SET is_discoverable = false, is_online = false
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_flag_user(p_user_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  INSERT INTO public.reports (reporter_id, target_id, target_type, reason, status)
  VALUES (auth.uid(), p_user_id, 'user', p_reason, 'pending');
END;
$$;

