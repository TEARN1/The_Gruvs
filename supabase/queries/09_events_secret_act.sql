-- ============================================================================
-- 09_events_secret_act.sql
-- ----------------------------------------------------------------------------
-- Secret-act reveal (engagement hook, zero cost). The host hides the headliner
-- behind an RSVP milestone — the app shows "🤫 Secret headliner, revealed at N
-- RSVPs" and unlocks the name (with a glitter flourish) once the going count
-- crosses the threshold. Drives RSVPs because attending unlocks the reveal.
--   secret_act               TEXT     — the hidden headliner/act name
--   secret_reveal_threshold  INTEGER  — RSVP "going" count needed to reveal
-- Both NULL = no secret act (normal event).
--
-- Idempotent: safe to run any number of times.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS secret_act TEXT;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS secret_reveal_threshold INTEGER;
