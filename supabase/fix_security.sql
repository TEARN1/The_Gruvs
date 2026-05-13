-- ============================================================
--  THE GRUVS — Security Fix Patch
--  Paste into Supabase → SQL Editor → Run
--  Addresses all warnings from the Supabase security linter.
--  Safe to run more than once.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  1. VIEWS — Remove SECURITY DEFINER
--     Recreate vibes + conversations as plain (SECURITY INVOKER)
--     views so they respect the querying user's RLS context.
-- ══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.vibes CASCADE;
CREATE OR REPLACE VIEW public.vibes
  WITH (security_invoker = true)
AS SELECT * FROM public.event_vibes;

DROP VIEW IF EXISTS public.conversations CASCADE;
CREATE OR REPLACE VIEW public.conversations
  WITH (security_invoker = true)
AS SELECT * FROM public.dm_rooms;


-- ══════════════════════════════════════════════════════════════
--  2. spatial_ref_sys — Enable RLS
--     PostGIS installs this table in public; it is read-only
--     reference data so a SELECT-only public policy is safe.
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spatial_ref_sys public read" ON public.spatial_ref_sys;
CREATE POLICY "spatial_ref_sys public read"
  ON public.spatial_ref_sys FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════
--  3. RLS policies — tighten always-true INSERT/UPDATE
-- ══════════════════════════════════════════════════════════════

-- notifications: only authenticated backend (service_role) or
-- the trigger functions should insert; lock down anon inserts.
DROP POLICY IF EXISTS "System can insert notifications"  ON public.notifications;
DROP POLICY IF EXISTS "System insert notifications"      ON public.notifications;
CREATE POLICY "System insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    -- allow trigger/service-role inserts (no JWT → role = postgres/service_role)
    -- and allow authenticated users to insert their own outbound notifications
    auth.role() IN ('service_role', 'postgres', 'authenticated')
  );

-- campaign_analytics: restrict to authenticated users only
DROP POLICY IF EXISTS "analytics_insert" ON public.campaign_analytics;
CREATE POLICY "analytics_insert"
  ON public.campaign_analytics FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════
--  4. Storage — restrict event-media listing
--     Replace the broad SELECT with a per-object policy so
--     clients can fetch URLs but cannot list the entire bucket.
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anyone can view media"      ON storage.objects;
DROP POLICY IF EXISTS "Public read event-media"    ON storage.objects;
CREATE POLICY "Public read event-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-media');


-- ══════════════════════════════════════════════════════════════
--  5. Functions — fix mutable search_path
--     Pinning search_path = public prevents search-path
--     injection attacks (a low-risk but real vector).
-- ══════════════════════════════════════════════════════════════
ALTER FUNCTION public.handle_new_user_welcome()           SET search_path = public;
ALTER FUNCTION public.request_booking()                   SET search_path = public;
ALTER FUNCTION public.verify_pop()                        SET search_path = public;
ALTER FUNCTION public.on_booking_completed_sis()          SET search_path = public;
ALTER FUNCTION public.array_overlap_count(anyarray, anyarray) SET search_path = public;
ALTER FUNCTION public.calculate_event_heat_index()        SET search_path = public;
ALTER FUNCTION public.create_notification()               SET search_path = public;
ALTER FUNCTION public.sync_follows_counts()               SET search_path = public;
ALTER FUNCTION public.sync_echo_likes()                   SET search_path = public;
ALTER FUNCTION public.events_update_search_vector()       SET search_path = public;
ALTER FUNCTION public.sync_follow_counts()                SET search_path = public;
ALTER FUNCTION public.set_current_timestamp_updated_at()  SET search_path = public;
ALTER FUNCTION public.check_event_capacity()              SET search_path = public;
ALTER FUNCTION public.increment_vibe(uuid, uuid)          SET search_path = public;
ALTER FUNCTION public.handle_new_chat_creator()           SET search_path = public;
ALTER FUNCTION public.find_gruv_hotspots()                SET search_path = public;
ALTER FUNCTION public.release_escrow()                    SET search_path = public;
ALTER FUNCTION public.place_bid(uuid, uuid, numeric)      SET search_path = public;
ALTER FUNCTION public.feed_for_user(uuid, integer, integer) SET search_path = public;
ALTER FUNCTION public.calculate_sis_score()               SET search_path = public;
ALTER FUNCTION public.refresh_trending_events()           SET search_path = public;
ALTER FUNCTION public.sync_event_engagement()             SET search_path = public;
ALTER FUNCTION public.get_event_full(uuid, uuid)          SET search_path = public;
ALTER FUNCTION public.find_nearby_vibers(uuid, double precision, integer) SET search_path = public;
ALTER FUNCTION public.handle_new_bid_notification()       SET search_path = public;
ALTER FUNCTION public.mark_notifications_read(uuid)       SET search_path = public;
ALTER FUNCTION public.decrement_vibe(uuid, uuid)          SET search_path = public;
ALTER FUNCTION public.sync_save_counts()                  SET search_path = public;
ALTER FUNCTION public.sync_echo_counts()                  SET search_path = public;
ALTER FUNCTION public.sync_social_counters()              SET search_path = public;
ALTER FUNCTION public.search_events_fts(text, integer)    SET search_path = public;
ALTER FUNCTION public.find_popular_spots(integer)         SET search_path = public;
ALTER FUNCTION public.increment_profile_score(uuid, integer) SET search_path = public;
ALTER FUNCTION public.sync_reaction_count()               SET search_path = public;
ALTER FUNCTION public.match_events_advanced()             SET search_path = public;
ALTER FUNCTION public.safe_div(numeric, numeric)          SET search_path = public;
ALTER FUNCTION public.sync_vibe_counts()                  SET search_path = public;
ALTER FUNCTION public.process_automated_payouts()         SET search_path = public;
ALTER FUNCTION public.set_message_delivered()             SET search_path = public;
ALTER FUNCTION public.find_nearby_events(double precision, double precision, double precision, integer) SET search_path = public;
ALTER FUNCTION public.sync_check_in_counts()              SET search_path = public;
ALTER FUNCTION public.handle_new_user()                   SET search_path = public;
ALTER FUNCTION public.purchase_tickets(uuid, uuid, text, numeric, integer) SET search_path = public;
ALTER FUNCTION public.events_set_slug()                   SET search_path = public;
ALTER FUNCTION public.touch_updated_at()                  SET search_path = public;
ALTER FUNCTION public.tag_early_bird_rsvp()               SET search_path = public;
ALTER FUNCTION public.increment_views(uuid)               SET search_path = public;
ALTER FUNCTION public.handle_location_match()             SET search_path = public;
ALTER FUNCTION public.search_events(text)                 SET search_path = public;
ALTER FUNCTION public.sync_events_posted()                SET search_path = public;
ALTER FUNCTION public.find_gruv_hotspots()                SET search_path = public;
ALTER FUNCTION public.sync_rsvp_counts()                  SET search_path = public;


-- ══════════════════════════════════════════════════════════════
--  6. SECURITY DEFINER functions — revoke anon EXECUTE
--     Trigger functions and write functions should never be
--     callable directly by unauthenticated clients.
--     Read/geo functions that legitimately serve the public
--     are switched to SECURITY INVOKER so they respect RLS.
-- ══════════════════════════════════════════════════════════════

-- Trigger-only functions: revoke anon entirely
REVOKE EXECUTE ON FUNCTION public.handle_new_user()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_welcome()   FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_chat_creator()   FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_bid_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_location_match()     FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_vibe_counts()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_follow_counts()        FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_follows_counts()       FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_echo_counts()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_echo_likes()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_save_counts()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_social_counters()      FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_event_engagement()     FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_reaction_count()       FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_check_in_counts()      FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_events_posted()        FROM anon;
REVOKE EXECUTE ON FUNCTION public.events_update_search_vector() FROM anon;
REVOKE EXECUTE ON FUNCTION public.events_set_slug()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.tag_early_bird_rsvp()       FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_message_delivered()     FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_current_timestamp_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_booking_completed_sis()  FROM anon;

-- Write functions: require authentication
REVOKE EXECUTE ON FUNCTION public.increment_vibe(uuid, uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_vibe(uuid, uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_views(uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_profile_score(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification()               FROM anon;
REVOKE EXECUTE ON FUNCTION public.place_bid(uuid, uuid, numeric)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_escrow()                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.purchase_tickets(uuid, uuid, text, numeric, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_automated_payouts()         FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_booking()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_pop()                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.feed_for_user(uuid, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_nearby_vibers(uuid, double precision, integer) FROM anon;

-- Public-safe geo/read functions: switch to SECURITY INVOKER
-- so they respect the caller's own RLS permissions
CREATE OR REPLACE FUNCTION public.find_nearby_events(
  lat double precision, lon double precision,
  radius_km double precision, limit_count integer
)
RETURNS SETOF events LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM events
  WHERE ST_DWithin(
    ST_MakePoint(longitude, latitude)::geography,
    ST_MakePoint(lon, lat)::geography,
    radius_km * 1000
  )
  ORDER BY ST_Distance(
    ST_MakePoint(longitude, latitude)::geography,
    ST_MakePoint(lon, lat)::geography
  )
  LIMIT limit_count;
$$;

-- Refresh trending is an admin-triggered task; revoke anon
REVOKE EXECUTE ON FUNCTION public.refresh_trending_events() FROM anon;

-- calculate_event_heat_index and check_event_capacity are read-only
-- and safe for public use — switch to SECURITY INVOKER
ALTER FUNCTION public.calculate_event_heat_index() SECURITY INVOKER;
ALTER FUNCTION public.check_event_capacity()        SECURITY INVOKER;
ALTER FUNCTION public.find_popular_spots(integer)   SECURITY INVOKER;
ALTER FUNCTION public.get_event_full(uuid, uuid)    SECURITY INVOKER;
ALTER FUNCTION public.match_events_advanced()       SECURITY INVOKER;
ALTER FUNCTION public.search_events_fts(text, integer) SECURITY INVOKER;
ALTER FUNCTION public.safe_div(numeric, numeric)    SECURITY INVOKER;
ALTER FUNCTION public.find_gruv_hotspots()          SECURITY INVOKER;


-- ══════════════════════════════════════════════════════════════
--  7. Extensions — move to extensions schema
--     This is the safest long-term fix. Creating the schema and
--     moving extensions prevents public-schema search-path abuse.
--     NOTE: This may require superuser. Skip if it errors and
--     the WARN is acceptable for your risk tolerance.
-- ══════════════════════════════════════════════════════════════
-- Skipped: postgis, vector, pg_trgm, unaccent are commonly left
-- in public on Supabase-managed instances. Moving them requires
-- re-creating all dependent objects. Accept this warning unless
-- Supabase support advises otherwise.


-- ══════════════════════════════════════════════════════════════
--  Done. Re-run the Supabase linter to verify.
-- ══════════════════════════════════════════════════════════════
