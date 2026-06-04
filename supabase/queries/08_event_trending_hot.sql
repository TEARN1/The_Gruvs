-- ============================================================================
-- 08_event_trending_hot.sql
-- ----------------------------------------------------------------------------
-- Trending Event Velocity Radar (logic rule #16 — "HOT / TURNING UP").
-- Flags an event as HOT when its *recent* engagement velocity (RSVPs + vibes
-- in the last hour) is running well above the baseline for its city. This is
-- a real, live signal — not a static popularity sort — so the badge means
-- "this is heating up right now", which is exactly what makes people pull up.
--
-- Zero cost (Supabase only, no external API). The app calls get_hot_event_ids()
-- and renders a badge for any event in the returned set. Degrades silently if
-- the function isn't deployed yet (the app falls back to an empty set).
--
-- Threshold: an event is HOT if, among upcoming published events in its city,
--   recent velocity >= 3 interactions  AND  >= 3x the city average.
-- The GREATEST(avg, 0.5) floor stops a single early RSVP in a quiet city from
-- tripping the badge.
--
-- Idempotent: safe to run any number of times.
-- ============================================================================

-- Velocity scans filter on created_at — index it so the function stays cheap.
CREATE INDEX IF NOT EXISTS idx_rsvps_created ON public.event_rsvps (created_at);
CREATE INDEX IF NOT EXISTS idx_vibes_created ON public.event_vibes (created_at);

CREATE OR REPLACE FUNCTION public.get_hot_event_ids()
RETURNS TABLE (event_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH recent AS (
    SELECT
      e.id,
      e.city,
      COALESCE(r.cnt, 0) + COALESCE(v.cnt, 0) AS vel
    FROM public.events e
    LEFT JOIN (
      SELECT event_id, COUNT(*) AS cnt
      FROM public.event_rsvps
      WHERE created_at > now() - interval '60 minutes'
      GROUP BY event_id
    ) r ON r.event_id = e.id
    LEFT JOIN (
      SELECT event_id, COUNT(*) AS cnt
      FROM public.event_vibes
      WHERE created_at > now() - interval '60 minutes'
      GROUP BY event_id
    ) v ON v.event_id = e.id
    WHERE e.is_published = true
      AND e.event_date >= CURRENT_DATE
  ),
  baseline AS (
    SELECT city, AVG(vel) AS avg_vel
    FROM recent
    GROUP BY city
  )
  SELECT r.id
  FROM recent r
  JOIN baseline b ON b.city IS NOT DISTINCT FROM r.city
  WHERE r.vel >= 3
    AND r.vel >= 3 * GREATEST(b.avg_vel, 0.5);
$$;

GRANT EXECUTE ON FUNCTION public.get_hot_event_ids() TO anon, authenticated;
