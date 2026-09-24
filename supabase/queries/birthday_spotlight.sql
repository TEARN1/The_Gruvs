-- ═══════════════════════════════════════════════════════════════════════════
-- birthday_spotlight.sql — restore the birthday features after the coordinate
-- lockdown, WITHOUT re-opening the leak it closed.
--
-- Background: lock_profile_coordinates.sql revoked SELECT on profiles.lat/lon
-- from `authenticated`. Column grants are NOT row-aware, so this blocked even a
-- user reading their OWN coordinates. src/services/birthdaySpotlight.js selected
-- lat/lon in all three of its functions, so every one of them began throwing
-- `permission denied for table profiles`, was swallowed by a catch, and returned
-- an empty list. The Drop's "birthdays today" rail and the "YOUR BIRTHDAY IS IN
-- N DAYS" build-up have silently rendered nothing ever since.
--
-- Fix: do the geo server-side. These are SECURITY DEFINER so they can read
-- coordinates, but they return only a COARSE BUCKET ('1-5 km'), never a number
-- and never the raw pair — matching the precedent set by profiles_within_radius
-- and the standing rule: proximity leaves the DB as IDs or buckets, never coords.
--
-- The centre is derived from auth.uid() inside the function. No caller supplies
-- a location, so a caller cannot probe someone else's position by sweeping a
-- centre point around the map.
--
-- Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Coarse distance bucket ───────────────────────────────────────────────────
-- Deliberately lossy. A precise "3.7 km away" on a nightlife app, combined with
-- a couple of readings, trilaterates someone's home. A bucket does not.
CREATE OR REPLACE FUNCTION public.distance_bucket(p_km double precision)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_km IS NULL THEN NULL
    WHEN p_km <  1  THEN 'under 1 km'
    WHEN p_km <  5  THEN '1-5 km'
    WHEN p_km < 20  THEN '5-20 km'
    WHEN p_km < 50  THEN '20-50 km'
    ELSE 'over 50 km'
  END;
$$;

-- ── Great-circle km between two points (internal helper) ─────────────────────
CREATE OR REPLACE FUNCTION public.geo_km(
  p_lat1 double precision, p_lon1 double precision,
  p_lat2 double precision, p_lon2 double precision
) RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * acos(
    least(1, greatest(-1,
      cos(radians(p_lat1)) * cos(radians(p_lat2)) *
      cos(radians(p_lon2) - radians(p_lon1)) +
      sin(radians(p_lat1)) * sin(radians(p_lat2))
    ))
  );
$$;

-- ── 1. Whose birthday is today, near me ──────────────────────────────────────
-- Centre = the CALLER's own stored coordinates, read server-side.
-- Users with no stored coordinates are still returned (bucket NULL) rather than
-- dropped: a missing location must never make someone invisible on their birthday.
CREATE OR REPLACE FUNCTION public.birthdays_near_me(
  p_radius_km double precision DEFAULT 100,
  p_limit     integer          DEFAULT 30
)
RETURNS TABLE (
  id              uuid,
  username        text,
  display_name    text,
  avatar_url      text,
  city            text,
  birth_date      date,
  distance_bucket text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_lat double precision;
  v_lon double precision;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;  -- signed out: no spotlight, no error
  END IF;

  SELECT p.lat, p.lon INTO v_lat, v_lon
  FROM public.profiles p WHERE p.id = auth.uid();

  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.city, p.birth_date,
         public.distance_bucket(
           CASE WHEN v_lat IS NOT NULL AND v_lon IS NOT NULL
                     AND p.lat IS NOT NULL AND p.lon IS NOT NULL
                THEN public.geo_km(v_lat, v_lon, p.lat, p.lon) END
         ) AS distance_bucket
  FROM public.profiles p
  WHERE p.is_discoverable = true
    AND p.id <> auth.uid()
    AND p.birth_date IS NOT NULL
    AND COALESCE(p.is_auto_hidden, false) = false
    -- birthday is TODAY (month + day; the year stays private)
    AND EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY   FROM p.birth_date) = EXTRACT(DAY   FROM CURRENT_DATE)
    -- inside the radius, OR position unknown on either side (never hide someone
    -- just because they have not shared a location)
    AND (
      v_lat IS NULL OR v_lon IS NULL OR p.lat IS NULL OR p.lon IS NULL
      OR public.geo_km(v_lat, v_lon, p.lat, p.lon) <= GREATEST(p_radius_km, 0)
    )
  ORDER BY
    CASE WHEN v_lat IS NOT NULL AND p.lat IS NOT NULL
         THEN public.geo_km(v_lat, v_lon, p.lat, p.lon) ELSE 1e9 END,
    p.username
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100));
END;
$$;

-- ── 2. People who share my exact day ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_birthday_twins(
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id              uuid,
  username        text,
  display_name    text,
  avatar_url      text,
  city            text,
  birth_date      date,
  distance_bucket text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_lat double precision;
  v_lon double precision;
  v_bd  date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT p.lat, p.lon, p.birth_date INTO v_lat, v_lon, v_bd
  FROM public.profiles p WHERE p.id = auth.uid();

  IF v_bd IS NULL THEN
    RETURN;  -- caller has no birthday set: nothing to twin with
  END IF;

  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.city, p.birth_date,
         public.distance_bucket(
           CASE WHEN v_lat IS NOT NULL AND v_lon IS NOT NULL
                     AND p.lat IS NOT NULL AND p.lon IS NOT NULL
                THEN public.geo_km(v_lat, v_lon, p.lat, p.lon) END
         ) AS distance_bucket
  FROM public.profiles p
  WHERE p.is_discoverable = true
    AND p.id <> auth.uid()
    AND p.birth_date IS NOT NULL
    AND COALESCE(p.is_auto_hidden, false) = false
    AND EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM v_bd)
    AND EXTRACT(DAY   FROM p.birth_date) = EXTRACT(DAY   FROM v_bd)
  ORDER BY
    CASE WHEN v_lat IS NOT NULL AND p.lat IS NOT NULL
         THEN public.geo_km(v_lat, v_lon, p.lat, p.lon) ELSE 1e9 END,
    p.username
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
END;
$$;

-- ── 3. Events to celebrate at, ranked by distance from ME ────────────────────
-- Powers the "your birthday is in N days" build-up. Returns event IDs + a real
-- distance: EVENT coordinates are public (they are on the map already), so only
-- the CALLER's position needs protecting, and that never leaves the function.
CREATE OR REPLACE FUNCTION public.birthday_event_suggestions(
  p_from      date,
  p_to        date,
  p_radius_km double precision DEFAULT 60,
  p_limit     integer          DEFAULT 12
)
RETURNS TABLE (id uuid, distance_km double precision)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_lat double precision;
  v_lon double precision;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT p.lat, p.lon INTO v_lat, v_lon
  FROM public.profiles p WHERE p.id = auth.uid();

  RETURN QUERY
  SELECT e.id,
         CASE WHEN v_lat IS NOT NULL AND v_lon IS NOT NULL
                   AND e.lat IS NOT NULL AND e.lon IS NOT NULL
              THEN public.geo_km(v_lat, v_lon, e.lat, e.lon) END AS distance_km
  FROM public.events e
  WHERE e.status = 'published'
    AND e.deleted_at IS NULL
    AND e.event_date >= p_from
    AND e.event_date <= p_to
    AND (
      v_lat IS NULL OR v_lon IS NULL OR e.lat IS NULL OR e.lon IS NULL
      OR public.geo_km(v_lat, v_lon, e.lat, e.lon) <= GREATEST(p_radius_km, 0)
    )
  ORDER BY
    CASE WHEN v_lat IS NOT NULL AND e.lat IS NOT NULL
         THEN public.geo_km(v_lat, v_lon, e.lat, e.lon) ELSE 1e9 END,
    e.event_date
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 100));
END;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- EXECUTE only. The functions are the sole path to this geo; the underlying
-- columns stay unreadable.
REVOKE ALL ON FUNCTION public.birthdays_near_me(double precision, integer)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_birthday_twins(integer)                            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birthday_event_suggestions(date, date, double precision, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.birthdays_near_me(double precision, integer)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_birthday_twins(integer)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.birthday_event_suggestions(date, date, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distance_bucket(double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.geo_km(double precision, double precision, double precision, double precision) TO authenticated;
