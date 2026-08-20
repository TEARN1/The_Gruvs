-- ═══════════════════════════════════════════════════════════════════════════
-- res_map_bridge.sql — THE GRUVS ⇄ THE RESIDENT bridge (Milestone 1).
--
-- Two jobs, one shared Supabase project (both apps already live here):
--   1. IDENTITY — make "one account across both apps" whole: idempotent,
--      caller-only upserts that guarantee a person who signed up in either app
--      has both the master `profiles` row and the `res_profiles` satellite.
--      Plus a PII-safe identity VIEW so cross-app reads never touch the raw
--      profiles table (no email/phone/coords/wallet/contacts ever cross).
--   2. LIVING MAP — mirror Resident civic reports (res_alerts /
--      res_neighbourhood_status) onto the shared `map_zones` so they appear on
--      the Gruvs map AND Resident's own map, with zero client duplication.
--
-- Security posture (defense in depth — every layer guards independently):
--   * Identity RPCs take NO id/privilege params — they derive auth.uid() and
--     upsert ONLY the caller's own row. Cannot seed/overwrite anyone else.
--   * Cross-app reads go through public_identity (whitelisted columns only).
--   * Map mirroring is SERVER-SIDE ONLY (a SECURITY DEFINER trigger is the sole
--     path). source_app is forced to 'resident', tier forced to declared (never
--     official), coords range-validated, severity clamped, owner = the row's own
--     user. A Resident user can never forge an official/host closure.
--   * The mirror NEVER blocks the civic report: any failure is swallowed.
--
-- Idempotent. Depends on map_zones.sql (Phase 1) + PostGIS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Back-link columns so a resident row maps to exactly one zone ──────────
ALTER TABLE public.map_zones ADD COLUMN IF NOT EXISTS ext_source text;
ALTER TABLE public.map_zones ADD COLUMN IF NOT EXISTS ext_id     uuid;
CREATE UNIQUE INDEX IF NOT EXISTS map_zones_ext_uk
  ON public.map_zones (ext_source, ext_id) WHERE ext_source IS NOT NULL;

-- ── 1. Identity: caller-only satellite upserts ──────────────────────────────
-- Ensures the master profile exists (safety net for a Resident-first signup).
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  INSERT INTO public.profiles (id) VALUES (uid) ON CONFLICT (id) DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_profile() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

-- Ensures the Resident satellite exists (master first, so its FK is satisfied).
CREATE OR REPLACE FUNCTION public.ensure_res_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  INSERT INTO public.profiles (id) VALUES (uid) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.res_profiles (id, role) VALUES (uid, 'resident')
    ON CONFLICT (id) DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_res_profile() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.ensure_res_profile() TO authenticated;

-- profiles.avatar / verified / verification_badge: existed live but in zero
-- tracked SQL files (hand-added at some point, never saved back) — found
-- 2026-08-20 when db-schema-ci.yml's fresh rebuild died on the view below,
-- one column at a time. verified and verification_badge are both distinct
-- from is_verified — all three are real live columns.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_badge boolean;

-- ── 2. PII-safe cross-app identity view (whitelisted columns only) ──────────
-- security_invoker: runs with the caller's rights + RLS, so it never leaks rows
-- the caller couldn't already see, and it exposes NO sensitive column at all.
CREATE OR REPLACE VIEW public.public_identity
WITH (security_invoker = true) AS
  SELECT id, username, display_name, avatar_url, avatar,
         is_verified, verified, verification_badge,
         city, resident_trust_tier, vibe_score, level
  FROM public.profiles;
REVOKE ALL ON public.public_identity FROM public;
GRANT SELECT ON public.public_identity TO anon, authenticated;

-- ── 3. Map mirror: Resident civic reports → shared map_zones ─────────────────
CREATE OR REPLACE FUNCTION public.res_mirror_to_map()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid;
  v_lat   double precision;
  v_lon   double precision;
  v_sev   int;
  v_label text;
  v_note  text;
  v_resolved boolean;
  v_src   text := TG_TABLE_NAME;
  g       geometry;
BEGIN
  -- Per-source field mapping.
  IF TG_TABLE_NAME = 'res_alerts' THEN
    -- SAFETY GATE: res_alerts is a personal-safety table (panic/incident/
    -- suspicious/safe_walk). A `panic` or `safe_walk` is a vulnerable person's
    -- distress location — it must NEVER be published on a public map (that would
    -- hand an attacker their coordinates). Only community-watch kinds are mapped.
    IF NEW.kind NOT IN ('incident','suspicious') THEN RETURN NEW; END IF;
    v_uid := NEW.user_id; v_lat := NEW.lat; v_lon := NEW.lon;
    v_label := NEW.title; v_note := NEW.description;
    v_sev := CASE lower(coalesce(NEW.severity,''))
               WHEN 'low' THEN 1 WHEN 'medium' THEN 2
               WHEN 'high' THEN 3 WHEN 'critical' THEN 3
               ELSE 2 END;
    v_resolved := (lower(coalesce(NEW.status,'')) IN ('resolved','false_alarm','closed','cleared'))
                  OR NEW.resolved_at IS NOT NULL;
  ELSE  -- res_neighbourhood_status
    v_uid := NEW.reporter_id; v_lat := NEW.lat; v_lon := NEW.lon;
    v_label := NEW.kind; v_note := NEW.detail; v_sev := 2;
    v_resolved := lower(coalesce(NEW.status,'')) IN
                  ('resolved','restored','cleared','normal','ok','back','online');
  END IF;

  -- Guards: a real owner in profiles + valid coordinates. Otherwise skip
  -- silently — the resident's report still succeeds, it just isn't mirrored.
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    RETURN NEW;
  END IF;
  IF v_lat IS NULL OR v_lon IS NULL
     OR v_lat < -90 OR v_lat > 90 OR v_lon < -180 OR v_lon > 180 THEN
    RETURN NEW;
  END IF;

  g := ST_SetSRID(ST_MakePoint(v_lon, v_lat), 4326);

  -- Anti-flood: cap open resident zones per user (skip, never block the report).
  IF NOT v_resolved AND (
       SELECT count(*) FROM public.map_zones
       WHERE created_by = v_uid AND source_app = 'resident'
         AND status NOT IN ('removed','expired') AND ends_at > now()) >= 30 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.map_zones
    (ext_source, ext_id, source_app, event_id, kind, geom, label, note, severity,
     starts_at, ends_at, created_by, status)
  VALUES
    (v_src, NEW.id, 'resident', NULL, 'alert', g,
     NULLIF(btrim(left(v_label, 200)), ''),
     NULLIF(btrim(left(v_note,  500)), ''),
     v_sev,
     coalesce(NEW.created_at, now()),
     coalesce(NEW.created_at, now())
       + CASE WHEN v_resolved THEN interval '1 minute' ELSE interval '24 hours' END,
     v_uid,
     CASE WHEN v_resolved THEN 'expired' ELSE 'declared' END)
  ON CONFLICT (ext_source, ext_id) WHERE ext_source IS NOT NULL DO UPDATE SET
     geom     = EXCLUDED.geom,
     label    = EXCLUDED.label,
     note     = EXCLUDED.note,
     severity = EXCLUDED.severity,
     ends_at  = EXCLUDED.ends_at,
     status   = CASE WHEN EXCLUDED.status = 'expired' THEN 'expired'
                     WHEN public.map_zones.status = 'official' THEN 'official'
                     ELSE public.map_zones.status END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- The civic report must NEVER fail because of the mirror. Fail closed → skip.
  RETURN NEW;
END;
$$;
-- Trigger function only — never an RPC. Lock it out of the REST surface entirely.
REVOKE EXECUTE ON FUNCTION public.res_mirror_to_map() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS res_alerts_mirror ON public.res_alerts;
CREATE TRIGGER res_alerts_mirror
  AFTER INSERT OR UPDATE ON public.res_alerts
  FOR EACH ROW EXECUTE FUNCTION public.res_mirror_to_map();

DROP TRIGGER IF EXISTS res_nstatus_mirror ON public.res_neighbourhood_status;
CREATE TRIGGER res_nstatus_mirror
  AFTER INSERT OR UPDATE ON public.res_neighbourhood_status
  FOR EACH ROW EXECUTE FUNCTION public.res_mirror_to_map();
