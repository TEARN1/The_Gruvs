-- ═════════════════════════════════════════════════════════════════════════════
--  20261021000100_find_me_privacy.sql — "Find me" that you control.
--
--  Before this:
--  • get_safe_nearby_vibers was SECURITY INVOKER and read profiles.lat/lon,
--    which signed-in users have no column privilege on, so it failed for
--    everyone and "who's nearby" was always empty.
--  • Had it worked, it would have listed anyone discoverable at their EXACT
--    last position, live or not, including people who had blocked you, with
--    ghost mode "hidden" by a fresh random jitter you could average away.
--  • There was no way to stay hidden from particular people, and any
--    signed-in user could read anyone's RSVPs and check-ins.
--
--  After it:
--  • You are findable only while your beacon is on, for the time you chose
--    (at most 2 days, enforced here), and only to the audience you picked:
--    anyone nearby, mutuals, or people in one of your crews.
--  • Positions come back rounded: ~1.1 km with the cloak on (the default) or
--    in ghost mode, ~110 m with it off. Never the exact pin.
--  • presence_hidden_from: people you hide never see you nearby, nor your
--    RSVPs or check-ins. Blocking, either way, does the same. Hosts still see
--    their own guest lists. Nobody can see who hid them.
--
--  Idempotent: runs twice cleanly, on production and on the CI schema.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 0. Columns production already has; the CI schema never had them ─────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lon double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beacon_intent text;
-- The vibe someone shows while live. beacon_intent.sql allowed three; the app
-- now offers six, and a rejected vibe used to knock the whole save down a
-- fallback that also dropped the audience.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_beacon_intent_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_beacon_intent_check
  CHECK (beacon_intent IS NULL OR beacon_intent IN ('bored', 'late_bites', 'open', 'crew', 'music', 'chill'));

-- Who can find me while I'm live: anyone nearby, only people I follow who
-- follow me back, or only people in one of my crews.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beacon_audience text DEFAULT 'everyone';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_beacon_audience_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_beacon_audience_check
  CHECK (beacon_audience IS NULL OR beacon_audience IN ('everyone', 'mutuals', 'crew'));
-- The cloak: on, people see roughly where you are (~1 km); off, ~100 m.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beacon_cloak boolean NOT NULL DEFAULT true;
-- profiles uses column-level grants in production; new columns need their own.
GRANT SELECT (beacon_audience, beacon_cloak), UPDATE (beacon_audience, beacon_cloak) ON public.profiles TO authenticated;

-- ── 1. A beacon lasts at most 2 days, whatever the client sends ──────────────
CREATE OR REPLACE FUNCTION public.clamp_beacon_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.beacon_expires_at IS NOT NULL AND NEW.beacon_expires_at > now() + interval '48 hours' THEN
    NEW.beacon_expires_at := now() + interval '48 hours';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_clamp_beacon_expiry ON public.profiles;
CREATE TRIGGER trg_clamp_beacon_expiry
  BEFORE INSERT OR UPDATE OF beacon_expires_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.clamp_beacon_expiry();

-- ── 2. People you hide from ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presence_hidden_from (
  owner_id   uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  hidden_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, hidden_id),
  CHECK (owner_id <> hidden_id)
);
CREATE INDEX IF NOT EXISTS idx_presence_hidden_from_hidden ON public.presence_hidden_from (hidden_id);

ALTER TABLE public.presence_hidden_from ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.presence_hidden_from FROM public, anon;
GRANT SELECT, INSERT, DELETE ON public.presence_hidden_from TO authenticated;

-- Only your own list, ever. The person hidden can't find out.
DROP POLICY IF EXISTS presence_hidden_from_own ON public.presence_hidden_from;
CREATE POLICY presence_hidden_from_own ON public.presence_hidden_from
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ── 3. May this viewer see where this person is or goes? ─────────────────────
-- No when the owner hid the viewer, or either has blocked the other. Definer,
-- because it reads both people's lists, and answers yes or no only.
CREATE OR REPLACE FUNCTION public.can_see_presence(p_owner uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_owner IS NULL OR p_viewer IS NULL OR p_owner = p_viewer THEN true
    WHEN EXISTS (SELECT 1 FROM public.presence_hidden_from h
                  WHERE h.owner_id = p_owner AND h.hidden_id = p_viewer) THEN false
    WHEN EXISTS (SELECT 1 FROM public.user_blocks b
                  WHERE (b.blocker_id = p_owner AND b.blocked_id = p_viewer)
                     OR (b.blocker_id = p_viewer AND b.blocked_id = p_owner)) THEN false
    ELSE true
  END;
$$;
REVOKE ALL ON FUNCTION public.can_see_presence(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_see_presence(uuid, uuid) TO anon, authenticated;

-- Do these two people share a crew (as members, or one owns it)? PL/pgSQL so
-- it builds on schemas without crews, where it simply answers no. Not granted
-- to clients: only the definer functions here ask it.
CREATE OR REPLACE FUNCTION public.shares_crew(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_a IS NULL OR p_b IS NULL OR p_a = p_b
     OR to_regclass('public.crews') IS NULL OR to_regclass('public.crew_members') IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
      FROM public.crews c
     WHERE (c.owner_id = p_a OR EXISTS (SELECT 1 FROM public.crew_members m WHERE m.crew_id = c.id AND m.user_id = p_a))
       AND (c.owner_id = p_b OR EXISTS (SELECT 1 FROM public.crew_members m WHERE m.crew_id = c.id AND m.user_id = p_b))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.shares_crew(uuid, uuid) FROM public, anon, authenticated;

-- ── 4. Who's nearby, done properly ───────────────────────────────────────────
-- Same arguments as before, so the app's call is unchanged. It also returns
-- the vibe each person chose to show, and whether they are your mutual or in
-- one of your crews, which Find Them's filters need (clients can't read
-- beacon_intent). Changing the result columns needs a drop first.
DROP FUNCTION IF EXISTS public.get_safe_nearby_vibers(double precision, double precision, double precision);
CREATE FUNCTION public.get_safe_nearby_vibers(u_lat double precision, u_lon double precision, radius_km double precision)
RETURNS TABLE(id uuid, username text, avatar_url text, vibe_score integer, distance_km double precision, lat double precision, lon double precision,
              beacon_intent text, is_mutual boolean, is_crew boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH me AS (SELECT auth.uid() AS uid, LEAST(GREATEST(COALESCE(radius_km, 5), 0.5), 50) AS r),
  cand AS (
    SELECT p.id AS pid, p.username AS uname, p.avatar_url AS avatar, p.vibe_score AS score,
           p.beacon_intent AS intent, p.beacon_audience AS audience,
           (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = p.id AND f.following_id = me.uid)
            AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = me.uid AND f.following_id = p.id)) AS mutual,
           public.shares_crew(p.id, me.uid) AS crew,
           (p.identity_mode = 'ghost' OR COALESCE(p.beacon_cloak, true)) AS coarse,
           p.lat AS plat, p.lon AS plon,
           6371 * 2 * asin(sqrt(
             power(sin(radians(p.lat - u_lat) / 2), 2)
             + cos(radians(u_lat)) * cos(radians(p.lat)) * power(sin(radians(p.lon - u_lon) / 2), 2)
           )) AS d
      FROM public.profiles p, me
     WHERE me.uid IS NOT NULL
       AND p.id <> me.uid
       AND p.lat IS NOT NULL AND p.lon IS NOT NULL
       AND p.lat BETWEEN u_lat - me.r / 111.0 AND u_lat + me.r / 111.0
       AND COALESCE(p.is_discoverable, true)
       AND COALESCE(p.identity_mode, 'public') <> 'celebrity'
       AND COALESCE(p.is_beacon_active, false)
       AND p.beacon_expires_at > now()
       AND public.can_see_presence(p.id, me.uid)
  )
  SELECT c.pid, c.uname, c.avatar, c.score,
         -- Distance gives position away too, so cloaked people get whole km.
         CASE WHEN c.coarse THEN GREATEST(1, round(c.d::numeric, 0)) ELSE round(c.d::numeric, 1) END::double precision,
         round(c.plat::numeric, CASE WHEN c.coarse THEN 2 ELSE 3 END)::double precision,
         round(c.plon::numeric, CASE WHEN c.coarse THEN 2 ELSE 3 END)::double precision,
         c.intent, c.mutual, c.crew
    FROM cand c, me
   WHERE c.d <= me.r
     AND (COALESCE(c.audience, 'everyone') = 'everyone'
          OR (c.audience = 'mutuals' AND c.mutual)
          OR (c.audience = 'crew' AND c.crew))
   ORDER BY c.d
   LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.get_safe_nearby_vibers(double precision, double precision, double precision) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_safe_nearby_vibers(double precision, double precision, double precision) TO authenticated;

-- ── 5. Your RSVPs and check-ins stay away from people you hid ────────────────
-- Is this viewer the event's host? A definer, so the policies below don't
-- depend on the reader's own access to events.
CREATE OR REPLACE FUNCTION public.is_event_host(p_event uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p_event IS NOT NULL AND p_user IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event AND e.author_id = p_user);
$$;
REVOKE ALL ON FUNCTION public.is_event_host(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_event_host(uuid, uuid) TO anon, authenticated;

-- RESTRICTIVE, so it narrows whatever the permissive policies allow. You always
-- see your own rows, and a host always sees the guest list of their event.
DO $$
BEGIN
  IF to_regclass('public.event_rsvps') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS event_rsvps_hidden_from ON public.event_rsvps';
    EXECUTE $p$
      CREATE POLICY event_rsvps_hidden_from ON public.event_rsvps
        AS RESTRICTIVE FOR SELECT
        USING (
          user_id = auth.uid()
          OR public.can_see_presence(user_id, auth.uid())
          OR public.is_event_host(event_rsvps.event_id, auth.uid())
        )
    $p$;
  END IF;
  IF to_regclass('public.live_checkins') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS live_checkins_hidden_from ON public.live_checkins';
    EXECUTE $p$
      CREATE POLICY live_checkins_hidden_from ON public.live_checkins
        AS RESTRICTIVE FOR SELECT
        USING (
          user_id = auth.uid()
          OR public.can_see_presence(user_id, auth.uid())
          OR public.is_event_host(live_checkins.event_id, auth.uid())
        )
    $p$;
  END IF;
END $$;
