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
--    (at most 2 days, enforced here), and only to the audience you picked.
--  • Positions come back rounded: ~110 m normally, ~1.1 km in ghost mode.
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

-- Who can find me while I'm live: anyone nearby, or only people I follow who
-- follow me back.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beacon_audience text DEFAULT 'everyone';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_beacon_audience_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_beacon_audience_check
      CHECK (beacon_audience IS NULL OR beacon_audience IN ('everyone', 'mutuals'));
  END IF;
END $$;
-- profiles uses column-level grants in production; the new column needs its own.
GRANT SELECT (beacon_audience), UPDATE (beacon_audience) ON public.profiles TO authenticated;

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

-- ── 4. Who's nearby, done properly ───────────────────────────────────────────
-- Same signature as before, so the app's call is unchanged.
CREATE OR REPLACE FUNCTION public.get_safe_nearby_vibers(u_lat double precision, u_lon double precision, radius_km double precision)
RETURNS TABLE(id uuid, username text, avatar_url text, vibe_score integer, distance_km double precision, lat double precision, lon double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH me AS (SELECT auth.uid() AS uid, LEAST(GREATEST(COALESCE(radius_km, 5), 0.5), 50) AS r),
  cand AS (
    SELECT p.id AS pid, p.username AS uname, p.avatar_url AS avatar, p.vibe_score AS score,
           p.identity_mode AS mode, p.lat AS plat, p.lon AS plon,
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
       AND (
         COALESCE(p.beacon_audience, 'everyone') = 'everyone'
         OR (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = p.id AND f.following_id = me.uid)
             AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = me.uid AND f.following_id = p.id))
       )
  )
  SELECT c.pid, c.uname, c.avatar, c.score,
         round(c.d::numeric, 1)::double precision,
         round(c.plat::numeric, CASE WHEN c.mode = 'ghost' THEN 2 ELSE 3 END)::double precision,
         round(c.plon::numeric, CASE WHEN c.mode = 'ghost' THEN 2 ELSE 3 END)::double precision
    FROM cand c, me
   WHERE c.d <= me.r
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
