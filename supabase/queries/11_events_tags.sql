-- ============================================================================
-- 10_events_tags.sql
-- ----------------------------------------------------------------------------
-- Inclusivity & safety "good to know" tags on events (zero cost, no API).
-- A free text[] of keys from src/constants/EventTags.js — accessibility
-- (wheelchair, accessible_restroom, seating, quiet_zone), sensory warnings
-- (strobe, loud, pyro), vibe (sober_friendly, all_ages), safety/parking
-- (gated_parking, car_guards, uber_dropoff), eco/transit (eco_friendly,
-- near_transit). Renders as badges on the event detail and can feed filters.
--
-- Idempotent: safe to run any number of times.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- GIN index so "events with tag X" filters stay fast (uses array containment).
CREATE INDEX IF NOT EXISTS idx_events_tags
  ON public.events USING GIN (tags);
