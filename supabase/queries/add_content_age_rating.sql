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
