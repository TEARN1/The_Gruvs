-- Trending Now showed events that had already happened (and could show
-- deleted ones): find_popular_spots ranked ALL events by trending_score with
-- only an is_cancelled check. The app's fallback query already limited itself
-- to upcoming events; this brings the live function in line.
--
-- An event stays trending through its last day (end_date, else event_date,
-- else the SAST date of date_time). Same signature + return type, so this is
-- a drop-in replace. Idempotent.

CREATE OR REPLACE FUNCTION public.find_popular_spots(limit_count integer DEFAULT 10)
RETURNS TABLE(event_id uuid, title text, description text, image text, vibe_count integer, rsvp_count integer, going integer, category text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    e.id AS event_id, e.title,
    e.description,
    COALESCE(e.media_urls[1], (e.media->0->>'url')::text) AS image,
    e.vibe_count, e.going AS rsvp_count, e.going, e.category
  FROM events e
  WHERE COALESCE(e.is_cancelled, false) = false
    AND e.deleted_at IS NULL
    AND COALESCE(e.status, '') <> 'cancelled'
    AND COALESCE(e.end_date, e.event_date, (e.date_time AT TIME ZONE 'Africa/Johannesburg')::date)
        >= (now() AT TIME ZONE 'Africa/Johannesburg')::date
  ORDER BY e.trending_score DESC NULLS LAST, e.vibe_count DESC
  LIMIT limit_count;
$function$;
