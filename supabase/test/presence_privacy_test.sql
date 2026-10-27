-- ══════════════════════════════════════════════════════════════════════════════
--  presence_privacy_test.sql — "Find me" shows you only for the time and to the
--  people you chose. See supabase/migrations/20261021000100_find_me_privacy.sql.
--  Runs as the real anon / authenticated roles inside a rolled-back transaction.
-- ══════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;

-- Fixture: A goes live near Joburg CBD. V is a stranger, H is someone A hid,
-- M follows A and A follows M back, X hosts event E that A RSVP'd to and
-- checked into, and X is in A's crew. A starts with the cloak off.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id) VALUES
  ('b1000000-0000-0000-0000-00000000000a'), ('b2000000-0000-0000-0000-00000000000b'),
  ('b3000000-0000-0000-0000-00000000000c'), ('b4000000-0000-0000-0000-00000000000d'),
  ('b5000000-0000-0000-0000-00000000000e');
INSERT INTO public.profiles (id, username) VALUES
  ('b1000000-0000-0000-0000-00000000000a', 't_live'),   ('b2000000-0000-0000-0000-00000000000b', 't_stranger'),
  ('b3000000-0000-0000-0000-00000000000c', 't_hidden'), ('b4000000-0000-0000-0000-00000000000d', 't_mutual'),
  ('b5000000-0000-0000-0000-00000000000e', 't_host');
UPDATE public.profiles
   SET lat = -26.204103, lon = 28.047305, is_discoverable = true, is_beacon_active = true,
       beacon_expires_at = now() + interval '3 hours', identity_mode = 'public', beacon_audience = 'everyone',
       beacon_cloak = false
 WHERE id = 'b1000000-0000-0000-0000-00000000000a';
INSERT INTO public.follows (follower_id, following_id) VALUES
  ('b1000000-0000-0000-0000-00000000000a', 'b4000000-0000-0000-0000-00000000000d'),
  ('b4000000-0000-0000-0000-00000000000d', 'b1000000-0000-0000-0000-00000000000a');
INSERT INTO public.presence_hidden_from (owner_id, hidden_id)
VALUES ('b1000000-0000-0000-0000-00000000000a', 'b3000000-0000-0000-0000-00000000000c');
INSERT INTO public.events (id, author_id, title)
VALUES ('e3000000-0000-0000-0000-00000000000e', 'b5000000-0000-0000-0000-00000000000e', 'Presence test');
INSERT INTO public.event_rsvps (event_id, user_id, status)
VALUES ('e3000000-0000-0000-0000-00000000000e', 'b1000000-0000-0000-0000-00000000000a', 'going');
INSERT INTO public.live_checkins (user_id, event_id)
VALUES ('b1000000-0000-0000-0000-00000000000a', 'e3000000-0000-0000-0000-00000000000e');
SET LOCAL session_replication_role = origin;
GRANT SELECT ON public.event_rsvps, public.live_checkins TO authenticated;   -- Supabase default

CREATE TEMP TABLE seen (who text, n int, lat double precision) ON COMMIT DROP;
GRANT ALL ON seen TO anon, authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. A stranger nearby sees A, at a rounded position ───────────────────────
SET LOCAL test.uid = 'b2000000-0000-0000-0000-00000000000b';
INSERT INTO seen SELECT 'stranger', count(*), max(lat) FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5)
 WHERE id = 'b1000000-0000-0000-0000-00000000000a';
-- ── 2. The person A hid sees nothing: not nearby, not the RSVP, not the check-in
SET LOCAL test.uid = 'b3000000-0000-0000-0000-00000000000c';
INSERT INTO seen SELECT 'hidden_nearby', count(*), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5)
 WHERE id = 'b1000000-0000-0000-0000-00000000000a';
INSERT INTO seen SELECT 'hidden_rsvp', count(*), null FROM public.event_rsvps WHERE user_id = 'b1000000-0000-0000-0000-00000000000a';
INSERT INTO seen SELECT 'hidden_checkin', count(*), null FROM public.live_checkins WHERE user_id = 'b1000000-0000-0000-0000-00000000000a';
INSERT INTO seen SELECT 'hidden_list', count(*), null FROM public.presence_hidden_from;
-- ── 3. The host still sees A on their own guest list ─────────────────────────
SET LOCAL test.uid = 'b5000000-0000-0000-0000-00000000000e';
INSERT INTO seen SELECT 'host_rsvp', count(*), null FROM public.event_rsvps WHERE user_id = 'b1000000-0000-0000-0000-00000000000a';
RESET ROLE;

DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM seen WHERE who = 'stranger';
  IF s.n <> 1 THEN RAISE EXCEPTION 'FAIL a stranger nearby could not find a live, discoverable viber'; END IF;
  IF s.lat <> -26.204 THEN RAISE EXCEPTION 'FAIL position not rounded to ~110 m: %', s.lat; END IF;
  RAISE NOTICE 'OK  live vibers are findable, at a position rounded to ~110 m';

  IF (SELECT n FROM seen WHERE who = 'hidden_nearby') <> 0 THEN RAISE EXCEPTION 'FAIL a hidden person found them nearby'; END IF;
  IF (SELECT n FROM seen WHERE who = 'hidden_rsvp') <> 0 THEN RAISE EXCEPTION 'FAIL a hidden person saw their RSVP'; END IF;
  IF (SELECT n FROM seen WHERE who = 'hidden_checkin') <> 0 THEN RAISE EXCEPTION 'FAIL a hidden person saw their check-in'; END IF;
  IF (SELECT n FROM seen WHERE who = 'hidden_list') <> 0 THEN RAISE EXCEPTION 'FAIL a hidden person can read who hid them'; END IF;
  RAISE NOTICE 'OK  people you hide see nothing of where you are or go, and cannot tell they are hidden';

  IF (SELECT n FROM seen WHERE who = 'host_rsvp') <> 1 THEN RAISE EXCEPTION 'FAIL the host lost a guest from their own list'; END IF;
  RAISE NOTICE 'OK  hosts still see their full guest list';
END $$;

-- ── 4. Mutuals only: the stranger loses A, the mutual keeps them ─────────────
UPDATE public.profiles SET beacon_audience = 'mutuals' WHERE id = 'b1000000-0000-0000-0000-00000000000a';
SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'b2000000-0000-0000-0000-00000000000b';
INSERT INTO seen SELECT 'stranger_mutuals', count(*), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
SET LOCAL test.uid = 'b4000000-0000-0000-0000-00000000000d';
INSERT INTO seen SELECT 'mutual', count(*) FILTER (WHERE is_mutual AND NOT is_crew), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT n FROM seen WHERE who = 'stranger_mutuals') <> 0 THEN RAISE EXCEPTION 'FAIL "mutuals only" still showed them to a stranger'; END IF;
  IF (SELECT n FROM seen WHERE who = 'mutual') <> 1 THEN RAISE EXCEPTION 'FAIL "mutuals only" hid them from a mutual, or did not mark them as one'; END IF;
  RAISE NOTICE 'OK  "mutuals only" means exactly that';
END $$;

-- ── 4b. Crew only: crewmates find A, a mutual outside the crew does not ─────
-- The CI schema has no crews; production does. Same columns either way.
CREATE TABLE IF NOT EXISTS public.crews (id uuid PRIMARY KEY, name text, owner_id uuid);
CREATE TABLE IF NOT EXISTS public.crew_members (crew_id uuid, user_id uuid, role text);
SET LOCAL session_replication_role = replica;
INSERT INTO public.crews (id, name, owner_id)
VALUES ('c4000000-0000-0000-0000-00000000000c', 'Presence test crew', 'b1000000-0000-0000-0000-00000000000a');
INSERT INTO public.crew_members (crew_id, user_id, role)
VALUES ('c4000000-0000-0000-0000-00000000000c', 'b5000000-0000-0000-0000-00000000000e', 'member');
SET LOCAL session_replication_role = origin;
UPDATE public.profiles SET beacon_audience = 'crew', beacon_intent = 'late_bites' WHERE id = 'b1000000-0000-0000-0000-00000000000a';
SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'b5000000-0000-0000-0000-00000000000e';
INSERT INTO seen SELECT 'crewmate', count(*) FILTER (WHERE is_crew AND beacon_intent = 'late_bites'), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
SET LOCAL test.uid = 'b4000000-0000-0000-0000-00000000000d';
INSERT INTO seen SELECT 'mutual_not_crew', count(*), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
SET LOCAL test.uid = 'b2000000-0000-0000-0000-00000000000b';
INSERT INTO seen SELECT 'stranger_crew', count(*), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT n FROM seen WHERE who = 'crewmate') <> 1 THEN RAISE EXCEPTION 'FAIL "crew only" hid them from their own crew, or lost the crew flag or vibe'; END IF;
  IF (SELECT n FROM seen WHERE who = 'mutual_not_crew') <> 0 THEN RAISE EXCEPTION 'FAIL "crew only" showed them to a mutual outside the crew'; END IF;
  IF (SELECT n FROM seen WHERE who = 'stranger_crew') <> 0 THEN RAISE EXCEPTION 'FAIL "crew only" showed them to a stranger'; END IF;
  IF has_function_privilege('authenticated', 'public.shares_crew(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL clients can probe who shares a crew with whom';
  END IF;
  RAISE NOTICE 'OK  "crew only" means exactly that';
END $$;

-- ── 5. The cloak and ghost mode round to ~1.1 km; a block hides them; an ended beacon too
UPDATE public.profiles SET beacon_audience = 'everyone', beacon_cloak = true WHERE id = 'b1000000-0000-0000-0000-00000000000a';
SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'b2000000-0000-0000-0000-00000000000b';
INSERT INTO seen SELECT 'cloak', count(*), max(lat) FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
INSERT INTO seen SELECT 'cloak_km', count(*) FILTER (WHERE distance_km = round(distance_km::numeric, 0)), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
RESET ROLE;
UPDATE public.profiles SET beacon_cloak = false, identity_mode = 'ghost' WHERE id = 'b1000000-0000-0000-0000-00000000000a';
SET LOCAL ROLE authenticated;
INSERT INTO seen SELECT 'ghost', count(*), max(lat) FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
RESET ROLE;
SET LOCAL session_replication_role = replica;
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('b2000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-00000000000a');
SET LOCAL session_replication_role = origin;
SET LOCAL ROLE authenticated;
INSERT INTO seen SELECT 'blocked', count(*), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
SET LOCAL test.uid = 'b4000000-0000-0000-0000-00000000000d';
RESET ROLE;
UPDATE public.profiles SET beacon_expires_at = now() - interval '1 minute' WHERE id = 'b1000000-0000-0000-0000-00000000000a';
SET LOCAL ROLE authenticated;
INSERT INTO seen SELECT 'expired', count(*), null FROM public.get_safe_nearby_vibers(-26.2, 28.04, 5);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT n FROM seen WHERE who = 'cloak_km') <> 1 THEN RAISE EXCEPTION 'FAIL a cloaked distance was more precise than a whole km'; END IF;
  IF (SELECT lat FROM seen WHERE who = 'cloak') <> -26.20 THEN RAISE EXCEPTION 'FAIL the cloak did not round to ~1.1 km: %', (SELECT lat FROM seen WHERE who = 'cloak'); END IF;
  IF (SELECT lat FROM seen WHERE who = 'ghost') <> -26.20 THEN RAISE EXCEPTION 'FAIL ghost mode not rounded to ~1.1 km: %', (SELECT lat FROM seen WHERE who = 'ghost'); END IF;
  IF (SELECT n FROM seen WHERE who = 'blocked') <> 0 THEN RAISE EXCEPTION 'FAIL a blocked pair can still find each other'; END IF;
  IF (SELECT n FROM seen WHERE who = 'expired') <> 0 THEN RAISE EXCEPTION 'FAIL still findable after the chosen time ran out'; END IF;
  RAISE NOTICE 'OK  the cloak and ghost mode round to ~1.1 km, blocks hide both ways, and findability ends on time';
END $$;

-- ── 6. Nobody can be findable for more than 2 days ───────────────────────────
UPDATE public.profiles SET beacon_expires_at = now() + interval '10 days' WHERE id = 'b1000000-0000-0000-0000-00000000000a';
DO $$ BEGIN
  IF (SELECT beacon_expires_at FROM public.profiles WHERE id = 'b1000000-0000-0000-0000-00000000000a') > now() + interval '48 hours' THEN
    RAISE EXCEPTION 'FAIL a beacon was allowed past 2 days';
  END IF;
  IF has_function_privilege('anon', 'public.get_safe_nearby_vibers(double precision,double precision,double precision)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL logged-out visitors can search for people nearby';
  END IF;
  RAISE NOTICE 'OK  beacons cap at 2 days, and only signed-in people can search nearby';
END $$;

-- ── 7. The switches save from the phone; a self-granted badge does not ─────
-- guard_profile_privilege_escalation once read a column production lacks,
-- which would have failed every profile save, these switches included.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;   -- as in production
GRANT USAGE ON SCHEMA auth TO authenticated;                -- Supabase default
SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'b1000000-0000-0000-0000-00000000000a';
UPDATE public.profiles SET beacon_audience = 'crew', beacon_cloak = false, is_discoverable = false
 WHERE id = 'b1000000-0000-0000-0000-00000000000a';
-- Refused or quietly undone (protect_profile_trust_columns runs first); either way, no badge.
DO $$ BEGIN
  UPDATE public.profiles SET is_verified = true WHERE id = 'b1000000-0000-0000-0000-00000000000a';
EXCEPTION WHEN raise_exception THEN NULL;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT COALESCE(is_verified, false) FROM public.profiles WHERE id = 'b1000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'FAIL a viber gave themselves a verified badge';
  END IF;
  IF (SELECT beacon_audience FROM public.profiles WHERE id = 'b1000000-0000-0000-0000-00000000000a') <> 'crew'
     OR (SELECT beacon_cloak FROM public.profiles WHERE id = 'b1000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'FAIL Find Me settings did not save from the phone';
  END IF;
  RAISE NOTICE 'OK  Find Me settings save from the phone, and nobody can verify themselves';
END $$;

ROLLBACK;

\echo ''
\echo '════════════════════════════════════════════════════════════════════'
\echo ' Find-me privacy: VERIFIED'
\echo '════════════════════════════════════════════════════════════════════'
