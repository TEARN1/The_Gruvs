-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — RUN ALL NOW  (one paste · idempotent · fresh OR existing DB)
--  Bundles: fix_core_writes.sql + add_content_age_rating.sql
--  Supabase → SQL Editor → paste everything → Run. Safe to run repeatedly.
-- ════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — FIX CORE WRITES  (messages · follows · reels · storage · realtime)
-- ══════════════════════════════════════════════════════════════════════════════
--  WHY THIS EXISTS
--  The app code is correct and resilient, but these user-facing actions fail when
--  the LIVE database is missing tables/columns or has RLS that rejects the write:
--    • DMs send then turn red & vanish  → messages table/columns/RLS
--    • Follow toggles then resets        → follows table/RLS
--    • Reels upload but play black        → reels columns + the 'reels' bucket not public
--    • New events take long to appear     → events not in the realtime publication
--
--  This single file fixes ALL of the above. It is FULLY IDEMPOTENT — safe to run
--  as many times as you like, on a fresh OR an existing database. Paste the whole
--  thing into Supabase → SQL Editor → Run. No other file is required for these.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. MESSAGES ───────────────────────────────────────────────────────────────
-- Create if missing, then add EVERY column the app's send code writes so the
-- full insert succeeds (rich features: replies, shared events, location, images).
CREATE TABLE IF NOT EXISTS public.messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type     TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions        JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id        UUID;  -- DM reply target (the app uses parent_id)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to         UUID;  -- legacy alias kept for compatibility
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event_id         UUID;  -- shared-event card
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_messages_pair ON public.messages (sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages (recipient_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ── 2. FOLLOWS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT
  WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE
  USING (follower_id = auth.uid());

-- ── 3. REELS (table + columns + RLS) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT,
  media_type  TEXT DEFAULT 'video',
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS sound_name  TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_id    UUID;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_title TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS visibility  TEXT DEFAULT 'public';
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS like_count  INTEGER DEFAULT 0;

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_select"      ON public.reels;
DROP POLICY IF EXISTS "reels_insert"      ON public.reels;
DROP POLICY IF EXISTS "reels_update_own"  ON public.reels;
DROP POLICY IF EXISTS "reels_delete_own"  ON public.reels;
CREATE POLICY "reels_select"     ON public.reels FOR SELECT USING (true);
CREATE POLICY "reels_insert"     ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());

-- ── 4. STORAGE BUCKETS — make media public + allow signed-in uploads ──────────
-- Wrapped so a permissions hiccup on storage.* never aborts the rest of the file.
DO $$
BEGIN
  -- Public read for all media buckets the app serves; create if missing.
  INSERT INTO storage.buckets (id, name, public) VALUES
    ('reels','reels',true), ('avatars','avatars',true),
    ('event-media','event-media',true), ('moments','moments',true)
  ON CONFLICT (id) DO UPDATE SET public = true;

  -- Public read of objects in those buckets.
  DROP POLICY IF EXISTS "gruvs_media_public_read" ON storage.objects;
  CREATE POLICY "gruvs_media_public_read" ON storage.objects FOR SELECT
    USING (bucket_id IN ('reels','avatars','event-media','moments'));

  -- Signed-in users can upload to those buckets.
  DROP POLICY IF EXISTS "gruvs_media_auth_write" ON storage.objects;
  CREATE POLICY "gruvs_media_auth_write" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('reels','avatars','event-media','moments'));

  -- Owners can overwrite/delete their own objects (upsert on re-upload).
  DROP POLICY IF EXISTS "gruvs_media_owner_modify" ON storage.objects;
  CREATE POLICY "gruvs_media_owner_modify" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id IN ('reels','avatars','event-media','moments') AND owner = auth.uid());
  DROP POLICY IF EXISTS "gruvs_media_owner_delete" ON storage.objects;
  CREATE POLICY "gruvs_media_owner_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id IN ('reels','avatars','event-media','moments') AND owner = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage step skipped (%): set bucket "reels" to Public manually in Dashboard → Storage', SQLERRM;
END $$;

-- ── 5. REALTIME — make new events / messages / reels stream live ───────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='reels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reels; END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'realtime publication step skipped: %', SQLERRM;
END $$;

-- ✅ Done. DMs persist, follows stick, reels play, events appear live.


-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — CONTENT AGE-RATING  (silent min-age floor on user posts)
-- ══════════════════════════════════════════════════════════════════════════════
--  The app rates every reel / event / echo at post time (src/utils/contentAgeRating)
--  and stores a MINIMUM VIEWING AGE so younger users are never served mature posts
--  — no report, no message to the poster. These columns persist that rating.
--
--  Fully idempotent. The app degrades gracefully without it (it re-rates text on
--  read), so running this is an optimisation + enables the moderator review flag.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.reels  ADD COLUMN IF NOT EXISTS min_age      INTEGER DEFAULT 13;
ALTER TABLE public.reels  ADD COLUMN IF NOT EXISTS auto_flagged BOOLEAN DEFAULT false;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS min_age      INTEGER DEFAULT 13;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS auto_flagged BOOLEAN DEFAULT false;

ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS min_age      INTEGER DEFAULT 13;
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS auto_flagged BOOLEAN DEFAULT false;

-- Partial indexes so the moderator review queue (auto_flagged) and age filters
-- stay fast without bloating the common case (min_age = 13, not flagged).
CREATE INDEX IF NOT EXISTS idx_reels_flagged  ON public.reels  (created_at DESC) WHERE auto_flagged;
CREATE INDEX IF NOT EXISTS idx_events_flagged ON public.events (created_at DESC) WHERE auto_flagged;
CREATE INDEX IF NOT EXISTS idx_echoes_flagged ON public.echoes (created_at DESC) WHERE auto_flagged;

-- ✅ Done. Mature posts now carry an age floor; worst cases are flagged for review.
