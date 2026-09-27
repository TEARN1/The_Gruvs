-- ─────────────────────────────────────────────────────────────────────────────
-- MAP VIEWPORT — load what the user is actually looking at, and count on the
-- server instead of shipping rows to the client to be counted.
--
-- Before this, MapScreen fetched every upcoming event on earth (LIMIT 300, no
-- geography), then fetched EVERY live_checkins row for those 300 events with
-- .in('event_id', ids) and tallied them in JavaScript. Two problems:
--   • pan to another city and you still saw the first city's pins;
--   • the check-in fetch grows linearly with attendance — the map gets slower
--     the more the product works, which is the worst possible failure curve.
--
-- Idempotent. Read-only function, safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Geography lookups need an index or the bbox filter degrades to a seq scan on
-- a table that only grows.
CREATE INDEX IF NOT EXISTS events_lat_lon_idx
  ON public.events (lat, lon)
  WHERE lat IS NOT NULL AND lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_event_date_idx ON public.events (event_date);
CREATE INDEX IF NOT EXISTS live_checkins_event_idx ON public.live_checkins (event_id);

-- ── events_in_bbox ───────────────────────────────────────────────────────────
-- Upcoming events inside the viewport, each already carrying its live Touch-Down
-- count. One round trip, one pass, no client-side tally.
CREATE OR REPLACE FUNCTION public.events_in_bbox(
  p_west  double precision,
  p_south double precision,
  p_east  double precision,
  p_north double precision,
  p_limit integer DEFAULT 300
)
RETURNS TABLE (
  id uuid,
  title text,
  category text,
  cover_url text,
  venue_name text,
  lat double precision,
  lon double precision,
  going integer,
  event_date date,
  here_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER          -- events are already readable; RLS still applies
SET search_path = public
AS $$
  SELECT
    e.id, e.title, e.category, e.cover_url, e.venue_name,
    COALESCE(e.lat, e.latitude)  AS lat,
    COALESCE(e.lon, e.longitude) AS lon,
    e.going, e.event_date,
    COALESCE(c.n, 0) AS here_count
  FROM public.events e
  LEFT JOIN (
    SELECT event_id, COUNT(*) AS n
    FROM public.live_checkins
    GROUP BY event_id
  ) c ON c.event_id = e.id
  WHERE e.event_date >= CURRENT_DATE
    AND e.deleted_at IS NULL
    AND COALESCE(e.lat, e.latitude) IS NOT NULL
    AND COALESCE(e.lon, e.longitude) IS NOT NULL
    AND COALESCE(e.lat, e.latitude) BETWEEN p_south AND p_north
    -- Longitude compare handles a viewport straddling the antimeridian, where
    -- west > east. Rare, but a world map that breaks at the date line isn't one.
    AND (
      (p_west <= p_east AND COALESCE(e.lon, e.longitude) BETWEEN p_west AND p_east)
      OR
      (p_west >  p_east AND (COALESCE(e.lon, e.longitude) >= p_west OR COALESCE(e.lon, e.longitude) <= p_east))
    )
  -- Busiest first, so if the cap does bite it keeps what matters rather than
  -- an arbitrary slice.
  ORDER BY COALESCE(c.n, 0) DESC, e.event_date ASC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$$;

GRANT EXECUTE ON FUNCTION public.events_in_bbox(double precision, double precision, double precision, double precision, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.events_in_bbox IS
  'Upcoming events within a lng/lat bbox, with their live check-in counts. Drives the map viewport.';
