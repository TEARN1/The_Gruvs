-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — FIX LIVE ISSUES (reels black video, reels Explore error, check-in)
--  Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) BLACK VIDEO: these reels are videos saved with an image-looking name, and
--    media_type was never set to 'video', so the app renders them as a photo
--    (black frame). Mark them as video.
UPDATE public.reels
SET media_type = 'video'
WHERE id IN (
  'e5245a84-1291-4f4e-b0fa-5754c8c62a5b',
  'd2909991-dd83-4058-ab56-f50c4a79e871',
  '12780b46-eae0-4d3d-9031-b3153876358b',
  'bcc01894-0acf-44f0-8fe7-5a10bc7f2d6b',
  '98527ff5-297b-435e-a776-f119ce5a0ba4',
  'df273ecc-d7f7-4c04-a335-f4ccd53293ea',
  '16222c83-34de-4fe0-bb70-8548d8cc7110',
  '22e9fed7-03d2-4015-85c5-25f8e605e547'
);

-- 2) REELS ERROR (Explore tab): the app reads reels.thumbnail_url, which is
--    missing in the live DB. Add it (nullable; the app falls back to cover_url).
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 3) CHECK-IN: the GPS-privacy hardening revoked lat/lon from LOGGED-IN users too,
--    not just anonymous visitors — which breaks the check-in map. Restore read
--    access for authenticated users only (anonymous stays blocked = no GPS harvesting).
GRANT SELECT ON public.live_checkins TO authenticated;
GRANT SELECT (lat, lon) ON public.live_checkins TO authenticated;
-- anon remains revoked (do NOT grant to anon).

-- 4) PROFILE COLUMNS the app uses but that were never migrated to the live DB.
--    Their absence throws "column does not exist", breaking signup personalization,
--    profile display, and Find Them targeting.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS surname       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clan_name     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_village  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base_lat FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base_lon FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date    DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday      DATE;    -- app also queries this name
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_year    INTEGER; -- and this one
-- NOTE: the app inconsistently uses birth_date / birthday / birth_year for date-of-birth.
-- All three are added so nothing errors; consolidating to a single column is a future cleanup.

-- 5) NEW FEATURES added since (profile age field + Vibe Passport stamps).
--    profiles.age: ProfilePage reads (load) AND writes (save) it -> both 400 without it.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;

--    event_stamps: Vibe Passport reads it (ViberProfileModal). Table never existed,
--    so the read 404s (currently swallowed -> empty passport). Create it so it works.
CREATE TABLE IF NOT EXISTS public.event_stamps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  venue_name  TEXT,
  stamp_icon  TEXT DEFAULT 'award',
  stamp_color TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_stamps_user ON public.event_stamps(user_id);
ALTER TABLE public.event_stamps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_stamps_read ON public.event_stamps;
CREATE POLICY event_stamps_read ON public.event_stamps FOR SELECT TO authenticated USING (true);
-- (stamps are minted server-side / by a future trigger; no client INSERT policy on purpose)

-- 6) CHECK-IN (Touch Down) — probing the live DB showed live_checkins is missing
--    the identity_mode column (so ghost/incognito check-ins can't carry their mode),
--    and the write relied on a UNIQUE(user_id,event_id) that may be absent + an
--    INSERT policy that may be missing. Add all three, safely + idempotently.
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS identity_mode TEXT DEFAULT 'public';
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ;
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();

-- one row per user per event — add the unique constraint only if none exists on
-- (user_id, event_id), de-duping any existing rows first so it can be created.
DO $$
DECLARE has_uniq boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.live_checkins'::regclass AND c.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
             FROM unnest(c.conkey) k
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k)
          = ARRAY['event_id','user_id']
  ) INTO has_uniq;
  IF NOT has_uniq THEN
    DELETE FROM public.live_checkins a USING public.live_checkins b
      WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.event_id = b.event_id;
    ALTER TABLE public.live_checkins
      ADD CONSTRAINT live_checkins_user_event_uniq UNIQUE (user_id, event_id);
  END IF;
END $$;

-- ensure an authenticated user can write their OWN check-in (RLS INSERT/UPDATE).
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS live_checkins_select     ON public.live_checkins;
CREATE POLICY live_checkins_select     ON public.live_checkins FOR SELECT USING (true);
DROP POLICY IF EXISTS live_checkins_insert     ON public.live_checkins;
CREATE POLICY live_checkins_insert     ON public.live_checkins FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS live_checkins_update_own ON public.live_checkins;
CREATE POLICY live_checkins_update_own ON public.live_checkins FOR UPDATE USING (user_id = auth.uid());

-- 7) DIRECT MESSAGES (the 400 on send): MessageManager.send writes message_type,
--    is_request, request_accepted, media_url, parent_id, event_id, latitude,
--    longitude — if the live `messages` table is missing ANY of these, the INSERT
--    400s. Add them all (additive, idempotent) + ensure participant RLS.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS body             TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type     TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id        UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event_id         UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_select_parts ON public.messages;
CREATE POLICY messages_select_parts ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS messages_update_parts ON public.messages;
CREATE POLICY messages_update_parts ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- 8) DIAGNOSTIC (read-only — changes nothing). If DMs STILL 400 after the column
--    adds above, the cause is a CHECK constraint or trigger — run these two and
--    share the output so we can pinpoint the exact rule rejecting the insert.
SELECT conname, pg_get_constraintdef(oid) AS check_definition
FROM pg_constraint
WHERE conrelid = 'public.messages'::regclass AND contype = 'c';

SELECT tgname AS trigger_name, pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.messages'::regclass AND NOT tgisinternal;

-- ✅ Done.
