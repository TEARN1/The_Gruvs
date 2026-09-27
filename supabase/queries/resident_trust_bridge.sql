-- ═══════════════════════════════════════════════════════════════════════════
-- resident_trust_bridge.sql — Feature B: Resident completeness → Gruvs trust
--
-- The Resident becomes the engine `is_verified` never had. Tiered:
--   • Trusted  = a COMPLETE res_profiles row (role + bio + gender chosen)
--   • Verified = Trusted + a verification doc uploaded AND reviewed
--                (verification_status = 'reviewed' — settable ONLY by
--                 service_role, never a self-claim; enforced by trigger)
--
-- Writes a denormalised provenance flag onto public.profiles
-- (resident_trust_tier) so every Gruvs surface can badge "Via The Resident"
-- without reading res_profiles (whose RLS blocks cross-user reads).
-- Also lifts is_verified (UPWARD ONLY — never unsets a verification granted
-- elsewhere) and floors social_integrity_score (never lowers it), so
-- Resident-trust feeds the SAME trust spine the ranking engine already reads —
-- no fourth trust system.
--
-- ORDER: run AFTER resident_schema_v2.sql. Every res_profiles-touching
-- statement is guarded with to_regclass, so running this early is a safe no-op
-- for those parts (the profiles column + RPC still land).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Provenance column on the shared profiles table ────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resident_trust_tier TEXT
  CHECK (resident_trust_tier IN ('trusted', 'verified'));

-- ── 2. Review-state column on res_profiles (guarded — table may not be live) ─
DO $$
BEGIN
  IF to_regclass('public.res_profiles') IS NOT NULL THEN
    ALTER TABLE public.res_profiles
      ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'none'
      CHECK (verification_status IN ('none', 'pending', 'reviewed', 'rejected'));
  END IF;
END $$;

-- ── 3. Anti-self-verification trigger ─────────────────────────────────────────
-- res_profiles_update RLS lets a user edit their OWN row, which would otherwise
-- let them set verification_status='reviewed' themselves. Block that: a client
-- role may only move none↔pending; reviewed/rejected are service-side verdicts.
CREATE OR REPLACE FUNCTION public.res_guard_verification_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- trusted server path (service_role / definer RPCs) — allow
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status NOT IN ('none', 'pending') THEN
    NEW.verification_status := OLD.verification_status; -- pin: no self-review
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.res_profiles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS res_guard_verification_status_trigger ON public.res_profiles;
    CREATE TRIGGER res_guard_verification_status_trigger
      BEFORE UPDATE ON public.res_profiles
      FOR EACH ROW EXECUTE FUNCTION public.res_guard_verification_status();
  END IF;
END $$;

-- ── 4. The bridge RPC ─────────────────────────────────────────────────────────
-- Called on Resident profile save (self) and after a doc review (service_role).
-- SECURITY DEFINER so it passes protect_profile_trust_columns (which pins
-- is_verified / social_integrity_score against direct client updates).
CREATE OR REPLACE FUNCTION public.res_sync_trust(p_user UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := COALESCE(p_user, auth.uid());
  v_rp RECORD;
  v_trusted BOOLEAN := false;
  v_verified BOOLEAN := false;
  v_tier TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  -- A user may only sync THEMSELVES; the server may sync anyone (post-review).
  IF v_user <> auth.uid() AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'may only sync own trust';
  END IF;
  -- Schema not deployed yet → honest no-op.
  IF to_regclass('public.res_profiles') IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_rp FROM public.res_profiles WHERE id = v_user;
  IF FOUND THEN
    -- Trusted = the profile is genuinely COMPLETE (no null-permissive pass).
    v_trusted := v_rp.role IS NOT NULL
             AND COALESCE(length(trim(v_rp.bio)), 0) >= 20
             AND v_rp.gender IS NOT NULL;
    -- Verified = Trusted + doc uploaded + reviewed by the server side.
    v_verified := v_trusted
              AND COALESCE(v_rp.verification_doc_url, '') <> ''
              AND v_rp.verification_status = 'reviewed';
  END IF;

  v_tier := CASE WHEN v_verified THEN 'verified'
                 WHEN v_trusted  THEN 'trusted'
                 ELSE NULL END;

  UPDATE public.profiles SET
    resident_trust_tier = v_tier,
    -- Upward only: Resident review can GRANT verification, never revoke a
    -- verification granted through another path.
    is_verified = CASE WHEN v_verified THEN true ELSE is_verified END,
    -- Floor, never lower: Resident trust feeds the existing SIS (0–100, base 50).
    social_integrity_score = GREATEST(
      COALESCE(social_integrity_score, 50),
      CASE WHEN v_verified THEN 75 WHEN v_trusted THEN 62 ELSE 0 END
    )
  WHERE id = v_user;

  RETURN v_tier;
END;
$$;

-- ── 5. Default-deny grants (matches security_layers.sql posture) ──────────────
REVOKE EXECUTE ON FUNCTION public.res_sync_trust(UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.res_sync_trust(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.res_guard_verification_status() FROM public, anon, authenticated;
