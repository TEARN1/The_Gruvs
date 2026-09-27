-- ═════════════════════════════════════════════════════════════════════════════
-- RUN THIS ONE FILE — the 2026-08 map + referral batch.
--
-- Combines three migrations whose client code is ALREADY LIVE on thegruvs.com.
-- Paste the whole thing into Supabase → SQL Editor → Run. Idempotent: safe to
-- re-run, safe to run out of order with the rest of DEPLOY_SQL_RUNBOOK.md.
--
--   1. referral_lineage.sql  — THE ONE THAT MATTERS. Without it, ?ref= has no
--      column to land in, so every invite and every door-sign QR scan
--      attributes to nobody. The client captures and claims already.
--   2. map_viewport.sql      — map works without it (client-side fallback), but
--      until it runs the map still tallies check-ins in the browser.
--   3. venue_flows.sql       — until it runs, the flow-trails layer renders
--      EMPTY by design (no fabricated fallback).
--
-- After running, verify with the three checks at the bottom.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- referral_lineage.sql — Makes every invite link and door-sign QR actually attribute to someone
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- REFERRAL LINEAGE — make ?ref= mean something.
--
-- profiles already had `referral_code` and `referral_count`, and ReferralCard
-- has been handing out ?ref= links for a while — but NOTHING read the parameter
-- and there was no column to record who invited whom. So every invite link, and
-- every door-sign QR (BD_PLAYBOOK §4.5/§5), attributed to nobody.
--
-- This adds the missing edge of the invite tree and one RPC to claim it.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Look-ups go code -> profile on every signup, and "who did I bring" on profile.
CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx   ON public.profiles (referred_by);

-- ── claim_referral ───────────────────────────────────────────────────────────
-- Called once, by the new user, just after signup. SECURITY DEFINER because it
-- must increment the REFERRER's count — a row the caller has no right to write.
-- That's exactly why every guard below matters.
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
BEGIN
  IF auth.uid() IS NULL OR p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN false;
  END IF;

  SELECT id INTO v_referrer
  FROM public.profiles
  WHERE referral_code = btrim(p_code)
  LIMIT 1;

  -- Unknown code, or someone feeding their own code back to farm their count.
  IF v_referrer IS NULL OR v_referrer = auth.uid() THEN
    RETURN false;
  END IF;

  -- Claim ONCE and only for yourself. The WHERE referred_by IS NULL is the
  -- whole anti-abuse story: without it a user could re-claim on a loop and
  -- inflate any referrer's count arbitrarily.
  UPDATE public.profiles
     SET referred_by = v_referrer
   WHERE id = auth.uid()
     AND referred_by IS NULL;

  IF NOT FOUND THEN
    RETURN false;  -- already attributed; do NOT increment again
  END IF;

  UPDATE public.profiles
     SET referral_count = COALESCE(referral_count, 0) + 1
   WHERE id = v_referrer;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

COMMENT ON FUNCTION public.claim_referral(text) IS
  'Attach the caller to the profile owning p_code, once. Returns true only on the first successful claim.';

-- ─────────────────────────────────────────────────────────────────────────
-- map_viewport.sql — Map loads the viewport server-side, with check-in counts in one pass
-- ─────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────
-- venue_flows.sql — Real venue-to-venue crowd movement (aggregate-only, 3+ people)
-- ─────────────────────────────────────────────────────────────────────────

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


-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFY (run these after; all three should succeed)
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Referral lineage: the column exists and the RPC is callable.
--    Expect: false (an unknown code is refused, which is the correct answer).
select public.claim_referral('__not_a_real_code__') as should_be_false;

-- 2. Map viewport: returns rows (or zero rows) rather than erroring.
select count(*) as events_in_joburg
from public.events_in_bbox(27.8, -26.4, 28.3, -26.0, 300);

-- 3. Venue flows: returns rows (zero is expected until people check in at 2+
--    venues — that is the honest answer, not a failure).
select count(*) as flows_found
from public.venue_flows_in_bbox(27.8, -26.4, 28.3, -26.0, 72, 3);
