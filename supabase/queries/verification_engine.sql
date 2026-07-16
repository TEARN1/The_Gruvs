-- ═══════════════════════════════════════════════════════════════════════════
-- verification_engine.sql — A2: the engine is_verified never had
--
-- Until now the green tick was granted only by hand (and, since Feature B,
-- via The Resident's reviewed-ID path). This adds the in-Gruvs path:
--
--   request_verification()  — a user asks; CRITERIA ARE CHECKED SERVER-SIDE
--                             (never trust the client's word):
--                               • account ≥ 30 days old
--                               • SIS ≥ 60 (behaviour trust)
--                               • ≥ 10 Touch Downs (real-world presence)
--                               • vibe_score ≥ 101 (Elite+ contribution)
--                             A Resident 'trusted' tier fast-tracks the
--                             presence requirement (already vetted there).
--   review_verification()   — an ADMIN verdict; approval sets
--                             profiles.is_verified (SECURITY DEFINER passes
--                             the protect_profile_trust_columns pin).
--
-- Truth Protocol: verification is EARNED-ONLY — no purchase path, ever.
-- ORDER: standalone; safe any time (to_regclass-guarded where needed).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note         TEXT,                          -- the applicant's pitch (optional)
  evidence     JSONB,                         -- server-computed criteria snapshot at request time
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  reviewed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_verif_requests_user   ON public.verification_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_verif_requests_status ON public.verification_requests (status);
-- One live application at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_verif_pending
  ON public.verification_requests (user_id) WHERE status = 'pending';

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verif_owner_select ON public.verification_requests;
CREATE POLICY verif_owner_select ON public.verification_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- No INSERT/UPDATE policies: writes go ONLY through the RPCs below.

-- ── request_verification: criteria checked server-side ───────────────────────
CREATE OR REPLACE FUNCTION public.request_verification(p_note TEXT DEFAULT NULL)
RETURNS public.verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_touchdowns INTEGER;
  v_age_days INTEGER;
  v_resident_fast BOOLEAN;
  v_row public.verification_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM verification_requests WHERE user_id = v_uid AND status = 'pending') THEN
    RAISE EXCEPTION 'request already pending';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND is_verified = true) THEN
    RAISE EXCEPTION 'already verified';
  END IF;
  -- Cooldown: one application per 30 days after a rejection.
  IF EXISTS (SELECT 1 FROM verification_requests
             WHERE user_id = v_uid AND status = 'rejected'
               AND reviewed_at > now() - interval '30 days') THEN
    RAISE EXCEPTION 'rejected recently — try again later';
  END IF;

  SELECT vibe_score, social_integrity_score, resident_trust_tier, created_at
    INTO v_prof FROM profiles WHERE id = v_uid;
  SELECT count(*) INTO v_touchdowns FROM live_checkins WHERE user_id = v_uid;
  v_age_days := EXTRACT(day FROM now() - COALESCE(v_prof.created_at, now()));
  v_resident_fast := v_prof.resident_trust_tier IN ('trusted', 'verified');

  -- THE CRITERIA (server-side, never the client's claim):
  IF v_age_days < 30 THEN RAISE EXCEPTION 'account too new (need 30 days)'; END IF;
  IF COALESCE(v_prof.social_integrity_score, 50) < 60 THEN RAISE EXCEPTION 'integrity score below 60'; END IF;
  IF COALESCE(v_prof.vibe_score, 0) < 101 THEN RAISE EXCEPTION 'reach Elite Viber first (vibe score 101)'; END IF;
  IF v_touchdowns < 10 AND NOT v_resident_fast THEN RAISE EXCEPTION 'need 10 Touch Downs (real-world presence)'; END IF;

  INSERT INTO verification_requests (user_id, note, evidence)
  VALUES (v_uid, left(COALESCE(p_note, ''), 500), jsonb_build_object(
    'age_days', v_age_days,
    'sis', v_prof.social_integrity_score,
    'vibe_score', v_prof.vibe_score,
    'touchdowns', v_touchdowns,
    'resident_tier', v_prof.resident_trust_tier
  )) RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- ── review_verification: ADMIN verdict; approval grants the tick ──────────────
CREATE OR REPLACE FUNCTION public.review_verification(p_request UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req RECORD;
BEGIN
  -- Only an admin (profiles.role) or the service key may pass verdicts.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND role = 'admin') THEN
      RAISE EXCEPTION 'not authorised to review';
    END IF;
  END IF;

  SELECT * INTO v_req FROM verification_requests WHERE id = p_request AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'no pending request'; END IF;

  UPDATE verification_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = v_uid, review_note = left(COALESCE(p_note, ''), 500), reviewed_at = now()
   WHERE id = p_request;

  IF p_approve THEN
    UPDATE profiles SET is_verified = true WHERE id = v_req.user_id;
    INSERT INTO notifications (recipient_id, actor_id, type, title, body, data)
    VALUES (v_req.user_id, v_req.user_id, 'verified',
            'You are Verified ✓', 'Your identity check passed — the green tick is yours.',
            jsonb_build_object('request_id', p_request));
  ELSE
    INSERT INTO notifications (recipient_id, actor_id, type, title, body, data)
    VALUES (v_req.user_id, v_req.user_id, 'verification_rejected',
            'Verification not approved', COALESCE(p_note, 'Keep building your presence and try again in 30 days.'),
            jsonb_build_object('request_id', p_request));
  END IF;
END;
$$;

-- ── Default-deny grants ───────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.request_verification(TEXT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.request_verification(TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.review_verification(UUID, BOOLEAN, TEXT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.review_verification(UUID, BOOLEAN, TEXT) TO authenticated, service_role;
