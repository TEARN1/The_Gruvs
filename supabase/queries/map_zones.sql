-- ═══════════════════════════════════════════════════════════════════════════
-- map_zones.sql — The Living Map spine (Phase 1).
--
-- A shared civic/events geometry layer for The Gruvs (and later The Resident).
-- A host draws what their event does to the physical world — a road closure, an
-- affected area, a race route — with a TYPE and a TIME WINDOW. The community
-- sees it live, can confirm/dispute it (Truth Protocol), and it auto-expires at
-- its end time so the map is never stale with yesterday's closures.
--
-- Security posture (mirrors the messaging spine):
--   * RPC-ONLY writes — tables have no INSERT/UPDATE/DELETE for authenticated.
--   * Only an event's host/co-host (or an official/service account) may create a
--     zone; provenance (created_by) is stamped from auth.uid(), never a param.
--   * One verify vote per user (map_zone_votes PK). Counts recomputed server-side.
--   * Geometry is PUBLIC event data, never user GPS — sidesteps the location
--     privacy lockdown entirely (deliberate civic act, not ambient tracking).
--   * GeoJSON in / GeoJSON out — no PostGIS types on the wire.
--
-- Idempotent. Depends on PostGIS (already installed) + public.events/profiles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tables ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.map_zones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app    text NOT NULL DEFAULT 'gruvs' CHECK (source_app IN ('gruvs','resident')),
  event_id      uuid REFERENCES public.events(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('road_closed','heavy_traffic','detour','no_parking','route','zone','alert')),
  geom          geometry(Geometry, 4326) NOT NULL,
  label         text CHECK (label IS NULL OR length(label) <= 200),
  note          text CHECK (note IS NULL OR length(note) <= 500),
  severity      int  NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 3),
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  created_by    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  confirm_count int NOT NULL DEFAULT 0,
  dispute_count int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'declared' CHECK (status IN ('declared','confirmed','official','expired','removed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS map_zones_geom_gix  ON public.map_zones USING gist (geom);
CREATE INDEX IF NOT EXISTS map_zones_time_idx  ON public.map_zones (ends_at) WHERE status NOT IN ('removed','expired');
CREATE INDEX IF NOT EXISTS map_zones_event_idx ON public.map_zones (event_id);

CREATE TABLE IF NOT EXISTS public.map_zone_votes (
  zone_id    uuid NOT NULL REFERENCES public.map_zones(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote       text NOT NULL CHECK (vote IN ('confirm','dispute')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (zone_id, user_id)
);

ALTER TABLE public.map_zones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_zone_votes ENABLE ROW LEVEL SECURITY;

-- Zones are public (read); votes readable by their owner. Writes are RPC-only.
DROP POLICY IF EXISTS map_zones_select ON public.map_zones;
CREATE POLICY map_zones_select ON public.map_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS map_zone_votes_select ON public.map_zone_votes;
CREATE POLICY map_zone_votes_select ON public.map_zone_votes FOR SELECT USING (user_id = auth.uid());

REVOKE ALL ON public.map_zones, public.map_zone_votes FROM public, anon;
GRANT SELECT ON public.map_zones TO anon, authenticated;   -- guests can read the map
GRANT SELECT ON public.map_zone_votes TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.map_zones, public.map_zone_votes FROM authenticated;

-- ── Who may mark a zone: the event's host or co-host ────────────────────────
CREATE OR REPLACE FUNCTION public.can_mark_zone(p_event uuid, p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_uid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event AND e.author_id = p_uid)
    OR EXISTS (SELECT 1 FROM public.event_roles r
               WHERE r.event_id = p_event AND r.user_id = p_uid AND r.role = 'co_host')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_mark_zone(uuid,uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.can_mark_zone(uuid,uuid) TO authenticated;

-- ── Create a zone (GeoJSON geometry in) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zone_create(
  p_event      uuid,
  p_kind       text,
  p_geojson    text,
  p_starts_at  timestamptz,
  p_ends_at    timestamptz,
  p_label      text DEFAULT NULL,
  p_note       text DEFAULT NULL,
  p_severity   int  DEFAULT 2
) RETURNS public.map_zones
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  g   geometry;
  z   public.map_zones;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF p_event IS NULL OR NOT public.can_mark_zone(p_event, uid) THEN
    RAISE EXCEPTION 'only the event host can mark its impact on the map';
  END IF;
  IF p_kind NOT IN ('road_closed','heavy_traffic','detour','no_parking','route','zone','alert') THEN
    RAISE EXCEPTION 'invalid zone kind';
  END IF;
  IF p_ends_at <= p_starts_at THEN RAISE EXCEPTION 'end must be after start'; END IF;
  IF p_ends_at < now() THEN RAISE EXCEPTION 'that time window is already over'; END IF;

  -- Anti-spam: cap open (unexpired) zones per user.
  IF (SELECT count(*) FROM public.map_zones
      WHERE created_by = uid AND status <> 'removed' AND ends_at > now()) >= 40 THEN
    RAISE EXCEPTION 'too many active zones — remove or let some expire first';
  END IF;

  BEGIN
    g := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid geometry';
  END;
  IF g IS NULL OR NOT ST_IsValid(g) THEN RAISE EXCEPTION 'invalid geometry'; END IF;

  INSERT INTO public.map_zones
    (event_id, kind, geom, label, note, severity, starts_at, ends_at, created_by)
  VALUES
    (p_event, p_kind, g, NULLIF(btrim(p_label),''), NULLIF(btrim(p_note),''),
     GREATEST(1, LEAST(3, COALESCE(p_severity,2))), p_starts_at, p_ends_at, uid)
  RETURNING * INTO z;
  RETURN z;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.zone_create(uuid,text,text,timestamptz,timestamptz,text,text,int) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.zone_create(uuid,text,text,timestamptz,timestamptz,text,text,int) TO authenticated;

-- ── Remove a zone (creator or event host) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.zone_remove(p_zone uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); z public.map_zones;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO z FROM public.map_zones WHERE id = p_zone;
  IF NOT FOUND THEN RETURN; END IF;
  IF z.created_by <> uid AND NOT public.can_mark_zone(z.event_id, uid) THEN
    RAISE EXCEPTION 'not allowed to remove this zone';
  END IF;
  UPDATE public.map_zones SET status = 'removed' WHERE id = p_zone;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.zone_remove(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.zone_remove(uuid) TO authenticated;

-- ── Verify / dispute (Truth Protocol; one vote per user) ────────────────────
CREATE OR REPLACE FUNCTION public.zone_verify(p_zone uuid, p_vote text)
RETURNS public.map_zones
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c int; d int; z public.map_zones;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF p_vote NOT IN ('confirm','dispute') THEN RAISE EXCEPTION 'invalid vote'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.map_zones WHERE id = p_zone AND status NOT IN ('removed','expired')) THEN
    RAISE EXCEPTION 'zone not found';
  END IF;

  INSERT INTO public.map_zone_votes (zone_id, user_id, vote)
  VALUES (p_zone, uid, p_vote)
  ON CONFLICT (zone_id, user_id) DO UPDATE SET vote = EXCLUDED.vote, created_at = now();

  SELECT count(*) FILTER (WHERE vote='confirm'),
         count(*) FILTER (WHERE vote='dispute')
    INTO c, d FROM public.map_zone_votes WHERE zone_id = p_zone;

  UPDATE public.map_zones
     SET confirm_count = c,
         dispute_count = d,
         status = CASE
           WHEN status = 'official' THEN 'official'          -- official never demoted by crowd
           WHEN d >= 3 AND d > c THEN 'declared'             -- disputed back down
           WHEN c >= 3 THEN 'confirmed'                       -- crowd-confirmed
           ELSE 'declared' END
   WHERE id = p_zone
   RETURNING * INTO z;
  RETURN z;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.zone_verify(uuid,text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.zone_verify(uuid,text) TO authenticated;

-- ── Zones near a point, active at a time (GeoJSON out) ───────────────────────
CREATE OR REPLACE FUNCTION public.zones_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision DEFAULT 8000,
  p_at timestamptz DEFAULT now()
) RETURNS TABLE (
  id uuid, source_app text, event_id uuid, kind text, label text, note text,
  severity int, starts_at timestamptz, ends_at timestamptz, created_by uuid,
  confirm_count int, dispute_count int, status text, geojson text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT z.id, z.source_app, z.event_id, z.kind, z.label, z.note, z.severity,
         z.starts_at, z.ends_at, z.created_by, z.confirm_count, z.dispute_count,
         z.status, ST_AsGeoJSON(z.geom) AS geojson
  FROM public.map_zones z
  WHERE z.status NOT IN ('removed','expired')
    AND z.ends_at > p_at
    AND z.starts_at < p_at + interval '14 days'
    AND ST_DWithin(
          z.geom::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          GREATEST(100, LEAST(50000, COALESCE(p_radius_m, 8000)))
        )
  ORDER BY z.starts_at
  LIMIT 500;
$$;
REVOKE EXECUTE ON FUNCTION public.zones_near(double precision,double precision,double precision,timestamptz) FROM public;
GRANT  EXECUTE ON FUNCTION public.zones_near(double precision,double precision,double precision,timestamptz) TO anon, authenticated;

-- ── Auto-expire (called by maintenance L1; also safe to run anytime) ────────
CREATE OR REPLACE FUNCTION public.expire_map_zones()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.map_zones SET status = 'expired'
   WHERE status IN ('declared','confirmed','official') AND ends_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.expire_map_zones() FROM public, anon, authenticated;

-- Realtime so a new/confirmed/expired zone updates every open map live.
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.map_zones;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
