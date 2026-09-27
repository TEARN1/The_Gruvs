-- ─────────────────────────────────────────────────────────────────────────────
-- REFERRAL LINEAGE — make ?ref= mean something.
--
-- profiles already had `referral_code` and `referral_count`, and ReferralCard
-- has been handing out ?ref= links for a while — but NOTHING read the parameter
-- and there was no column to record who invited whom. So every invite link, and
-- every door-sign QR (BD_PLAYBOOK §4.5/§5), attributed to nobody.
--
-- This adds the missing edge of the invite tree and one RPC to claim it.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Look-ups go code -> profile on every signup, and "who did I bring" on profile.
CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx   ON public.profiles (referred_by);

-- ── claim_referral ───────────────────────────────────────────────────────────
-- Called once, by the new user, just after signup. SECURITY DEFINER because it
-- must increment the REFERRER's count — a row the caller has no right to write.
-- That's exactly why every guard below matters.
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
BEGIN
  IF auth.uid() IS NULL OR p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN false;
  END IF;

  SELECT id INTO v_referrer
  FROM public.profiles
  WHERE referral_code = btrim(p_code)
  LIMIT 1;

  -- Unknown code, or someone feeding their own code back to farm their count.
  IF v_referrer IS NULL OR v_referrer = auth.uid() THEN
    RETURN false;
  END IF;

  -- Claim ONCE and only for yourself. The WHERE referred_by IS NULL is the
  -- whole anti-abuse story: without it a user could re-claim on a loop and
  -- inflate any referrer's count arbitrarily.
  UPDATE public.profiles
     SET referred_by = v_referrer
   WHERE id = auth.uid()
     AND referred_by IS NULL;

  IF NOT FOUND THEN
    RETURN false;  -- already attributed; do NOT increment again
  END IF;

  UPDATE public.profiles
     SET referral_count = COALESCE(referral_count, 0) + 1
   WHERE id = v_referrer;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

COMMENT ON FUNCTION public.claim_referral(text) IS
  'Attach the caller to the profile owning p_code, once. Returns true only on the first successful claim.';
