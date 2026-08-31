-- ─────────────────────────────────────────────────────────────────────────────
-- lock_business_tier.sql — close the free upgrade-to-Enterprise bug.
--
-- BusinessDashboardScreen.js's upgradeTierAction() does a bare
-- `supabase.from('business_profiles').update({ tier: newTier })` from the
-- client. business_profiles has no column-level protection and its RLS policy
-- ("biz_manage" FOR ALL USING (user_id = auth.uid())) is row-scoped, not
-- column-scoped — so any business owner can set their OWN tier to 'enterprise'
-- for free. The R299/R799 prices in the upgrade sheet are decorative.
--
-- `tier` was also never a tracked migration — it exists live (confirmed: one
-- row already sitting at 'royal') but no ALTER TABLE for it appears anywhere
-- in supabase/queries/. This file both formalizes the column AND locks it.
--
-- Fix: revoke UPDATE on the tier column specifically (row-level RLS still lets
-- an owner update their OTHER columns — name, logo, etc), and move tier
-- changes to an admin-only SECURITY DEFINER RPC. The client's update() call
-- keeps running (other columns still succeed); only `tier` silently stops
-- moving until an admin approves a paid upgrade.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- Formalize the drifted column with the same 4-tier vocabulary
-- businessEntitlements.js already codes against (TIER_ORDER).
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'starter';

DO $$ BEGIN
  ALTER TABLE public.business_profiles
    ADD CONSTRAINT business_profiles_tier_check
    CHECK (tier IN ('starter', 'pro', 'royal', 'enterprise'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The column-level lock. Table-level UPDATE stays granted (via Supabase's
-- project-default GRANT ALL to authenticated) so every other column an owner
-- edits — business_name, logo_url, tagline, website — keeps working exactly as
-- before. Only `tier` is pulled out of that grant.
REVOKE UPDATE (tier) ON public.business_profiles FROM authenticated, anon;

-- ── admin_set_business_tier ─────────────────────────────────────────────────
-- The only path left that can move a business's tier. Re-checks admin status
-- SERVER-SIDE against profiles.role (the same column useIsAdmin.js and the
-- existing talent/security RLS policies already trust) — the client hint is
-- advisory only, per useIsAdmin.js's own header comment.
CREATE OR REPLACE FUNCTION public.admin_set_business_tier(
  p_business_id uuid,
  p_tier text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_old_tier text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN false;
  END IF;

  IF p_tier NOT IN ('starter', 'pro', 'royal', 'enterprise') THEN
    RETURN false;
  END IF;

  SELECT tier INTO v_old_tier FROM public.business_profiles WHERE id = p_business_id;
  IF v_old_tier IS NULL THEN
    RETURN false; -- no such business
  END IF;

  UPDATE public.business_profiles SET tier = p_tier WHERE id = p_business_id;

  -- Audit trail — same table/shape App.js's SecurityService.logSecurityEvent
  -- already writes to, so this shows up wherever security_logs is reviewed.
  INSERT INTO public.security_logs (user_id, event_type, action, resource_type, reason)
  VALUES (auth.uid(), 'admin_action', 'business_tier_change', 'business_profiles',
          format('id=%s old=%s new=%s', p_business_id, v_old_tier, p_tier));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_business_tier(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_business_tier(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_set_business_tier IS
  'Admin-only tier change for a business, gated server-side on profiles.role. Client upgrade UI must call this instead of writing business_profiles.tier directly.';

-- ─────────────────────────────────────────────────────────────────────────────
-- business_tier_requests — replaces the instant self-grant with a real request.
-- Same shape as the existing business_partnerships pending-request pattern
-- (dataFlow.js DiscoveryManager.requestPartnership), so this isn't a new UX
-- idiom, just a new table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_tier_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  requested_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_tier TEXT NOT NULL CHECK (requested_tier IN ('pro', 'royal', 'enterprise')),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tier_requests_business ON public.business_tier_requests(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tier_requests_pending   ON public.business_tier_requests(status) WHERE status = 'pending';

ALTER TABLE public.business_tier_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_requests_owner_select" ON public.business_tier_requests;
CREATE POLICY "tier_requests_owner_select" ON public.business_tier_requests FOR SELECT
  USING (
    business_id IN (SELECT id FROM public.business_profiles WHERE user_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "tier_requests_owner_insert" ON public.business_tier_requests;
CREATE POLICY "tier_requests_owner_insert" ON public.business_tier_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND business_id IN (SELECT id FROM public.business_profiles WHERE user_id = auth.uid())
  );

-- No UPDATE/DELETE policy for owners at all — a request, once sent, is not
-- something the requester can edit or cancel their way around. Only the
-- admin-only RPC below can resolve one.

-- ── admin_resolve_tier_request ──────────────────────────────────────────────
-- Approve or decline a pending request. On approve, moves the tier through the
-- exact same admin_set_business_tier() path above — one enforcement point for
-- "who can change a tier", not two.
CREATE OR REPLACE FUNCTION public.admin_resolve_tier_request(
  p_request_id uuid,
  p_approve boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_req record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN RETURN false; END IF;

  SELECT * INTO v_req FROM public.business_tier_requests WHERE id = p_request_id AND status = 'pending';
  IF v_req IS NULL THEN RETURN false; END IF;

  IF p_approve THEN
    PERFORM public.admin_set_business_tier(v_req.business_id, v_req.requested_tier);
  END IF;

  UPDATE public.business_tier_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         resolved_at = now(), resolved_by = auth.uid()
   WHERE id = p_request_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_tier_request(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_tier_request(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.admin_resolve_tier_request IS
  'Admin approves/declines a pending business_tier_requests row. Approval routes through admin_set_business_tier — one enforcement point, not two.';
