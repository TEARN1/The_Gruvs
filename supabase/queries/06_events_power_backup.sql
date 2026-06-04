-- ============================================================================
-- 06_events_power_backup.sql
-- ----------------------------------------------------------------------------
-- Load-shedding power filter (SA-specific, zero cost — no external API).
-- The host marks how a venue stays powered during load-shedding; the event
-- detail shows a badge and the feed can filter on it.
--   power_backup ∈ 'grid' | 'generator' | 'solar' | 'ups'   (NULL = unknown)
-- 'grid' means no backup; the other three keep the lights on during a slot.
--
-- Idempotent: safe to run any number of times.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS power_backup TEXT;

-- Optional: index for the "has backup power" feed filter.
CREATE INDEX IF NOT EXISTS idx_events_power_backup
  ON public.events (power_backup)
  WHERE power_backup IS NOT NULL;