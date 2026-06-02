-- ============================================================================
-- 02_reels_metadata_visibility.sql
-- ----------------------------------------------------------------------------
-- The Reel composer posts a `metadata` blob (filter, stickers, trim bounds,
-- aura colour/intensity) and a `visibility` setting (public / private /
-- attendees). The original reels table never had these columns, so every
-- insert from CreateReelModal failed and the Post button appeared to do
-- nothing. The app now degrades gracefully (it strips these columns when they
-- are absent), but running this restores the rich data + per-reel visibility.
--
-- Idempotent: safe to run on an existing database any number of times.
-- ============================================================================

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

-- Constrain visibility to the three values the composer offers. Guarded so a
-- re-run (or a column that already has the constraint) does not error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reels_visibility_check'
      AND conrelid = 'public.reels'::regclass
  ) THEN
    ALTER TABLE public.reels
      ADD CONSTRAINT reels_visibility_check
      CHECK (visibility IN ('public','private','attendees'));
  END IF;
END $$;

-- Backfill any pre-existing rows so they are visible in the public feed.
UPDATE public.reels SET visibility = 'public' WHERE visibility IS NULL;
UPDATE public.reels SET metadata   = '{}'::jsonb WHERE metadata IS NULL;