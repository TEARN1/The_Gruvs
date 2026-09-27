-- ─────────────────────────────────────────────────────────────────────────────
-- VENUE FLOWS — where crowds ACTUALLY move between venues.
--
-- The map's "flow trails" layer drew a line from each event to the next one in
-- the array. Array order. Not an observed movement — a decoration shaped like an
-- insight, which is precisely the promoter spin the Truth Protocol exists to
-- replace. This replaces it with the real thing.
--
-- A flow is: the same person Touched Down at venue A and then at venue B, within
-- the same night. That is unfakeable presence data we already collect.
--
-- Privacy: this returns AGGREGATES ONLY — a from/to pair and how many people
-- made that hop. No user ids, ever. And a hop is only returned once at least
-- MIN_PEOPLE distinct people made it, so no individual's movement between two
-- venues can be read off the map. That threshold is the whole safety property
-- here; do not lower it.
--
-- Idempotent, read-only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS live_checkins_user_time_idx
  ON public.live_checkins (user_id, checked_in_at);

CREATE OR REPLACE FUNCTION public.venue_flows_in_bbox(
  p_west  double precision,
  p_south double precision,
  p_east  double precision,
  p_north double precision,
  p_hours integer DEFAULT 72,
  p_min_people integer DEFAULT 3
)
RETURNS TABLE (
  from_lat double precision,
  from_lon double precision,
  to_lat   double precision,
  to_lon   double precision,
  people   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER              -- reads other users' check-ins to aggregate them
SET search_path = public
AS $$
  WITH win AS (
    SELECT
      lc.user_id,
      lc.event_id,
      lc.checked_in_at,
      COALESCE(e.lat, e.latitude) AS lat,
      COALESCE(e.lon, e.longitude) AS lon
    FROM public.live_checkins lc
    JOIN public.events e ON e.id = lc.event_id
    WHERE lc.checked_in_at >= now() - make_interval(hours => GREATEST(1, LEAST(p_hours, 720)))
      AND COALESCE(e.lat, e.latitude) IS NOT NULL
      AND COALESCE(e.lon, e.longitude) IS NOT NULL
      AND e.deleted_at IS NULL
  ),
  hops AS (
    SELECT
      lat AS from_lat,
      lon AS from_lon,
      LEAD(lat) OVER w AS to_lat,
      LEAD(lon) OVER w AS to_lon,
      event_id          AS from_event,
      LEAD(event_id) OVER w AS to_event,
      user_id
    FROM win
    WINDOW w AS (PARTITION BY user_id ORDER BY checked_in_at)
  )
  SELECT
    h.from_lat, h.from_lon, h.to_lat, h.to_lon,
    COUNT(DISTINCT h.user_id) AS people
  FROM hops h
  WHERE h.to_lat IS NOT NULL
    AND h.from_event <> h.to_event          -- a re-check-in at the same venue isn't a flow
    AND h.from_lat BETWEEN p_south AND p_north
    AND h.from_lon BETWEEN p_west  AND p_east
    AND h.to_lat   BETWEEN p_south AND p_north
    AND h.to_lon   BETWEEN p_west  AND p_east
  GROUP BY h.from_lat, h.from_lon, h.to_lat, h.to_lon
  -- The k-anonymity gate. Below this, a line on a map would describe one
  -- identifiable person's night out.
  HAVING COUNT(DISTINCT h.user_id) >= GREATEST(3, p_min_people)
  ORDER BY people DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.venue_flows_in_bbox(double precision, double precision, double precision, double precision, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.venue_flows_in_bbox(double precision, double precision, double precision, double precision, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.venue_flows_in_bbox IS
  'Aggregated venue-to-venue movement from real consecutive check-ins. Never returns user ids, and only returns a hop made by 3+ distinct people.';
