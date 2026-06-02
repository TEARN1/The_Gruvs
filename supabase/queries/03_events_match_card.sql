-- ============================================================================
-- 03_events_match_card.sql
-- ----------------------------------------------------------------------------
-- A two-team competition event (e.g. "Claude FC vs Gemini FC") stores a small
-- match_card blob so the feed and detail screens can render both team crests as
-- the match's face — whether or not the teams uploaded a logo.
--
--   match_card = {
--     "home": { "name": "Claude FC", "logo_url": null, "color": "#00f2ff" },
--     "away": { "name": "Gemini FC", "logo_url": "https://…", "color": "#d946ef" }
--   }
--
-- Written by SportEventSetupModal when exactly two teams are configured, and
-- cleared (NULL) when the line-up isn't a head-to-head. Without this column the
-- app degrades gracefully — the write is ignored and the normal cover is shown.
--
-- Idempotent: safe to run any number of times.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS match_card JSONB;