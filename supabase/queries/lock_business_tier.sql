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
-- Fix: switch business_profiles from table-wide UPDATE to an explicit column
-- allowlist that excludes `tier` (see the real Postgres semantics note below —
-- a naive column-level REVOKE does NOT work here), and move tier changes to an
-- admin-only SECURITY DEFINER RPC. The client's update()/upsert() calls keep
-- running for every column an owner legitimately edits; only `tier` (and a
-- few other sensitive columns found along the way) stop moving until an admin
-- approves a paid upgrade.
--
-- ⚠️ REAL POSTGRES SEMANTICS, learned the hard way (verified live, not assumed):
-- table-level and column-level ACLs are INDEPENDENT and UNIONED, not table
-- restricted-by-column. `REVOKE UPDATE (tier) ON t FROM authenticated` when
-- `authenticated` ALREADY has table-level UPDATE (Supabase's project-default
-- grant) is a genuine NO-OP — verified with a throwaway table (attacl stayed
-- NULL, has_column_privilege stayed true). A column REVOKE can only remove a
-- privilege that was granted AT THE COLUMN LEVEL; it cannot narrow a
-- table-level grant. The only way to actually restrict one column is:
-- REVOKE the table-level privilege entirely, then GRANT UPDATE back on every
-- column that SHOULD remain writable. That's what this does.
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

-- Revoke ALL table-level UPDATE, then re-grant only the columns a business
-- owner legitimately writes (audited against every business_profiles
-- .update()/.upsert() call site in src/ on 2026-08-31: BusinessDashboardScreen's
-- setup form + BusinessStoreBuilder's storefront toggle — nothing else touches
-- this table from the client). Everything left out — tier, verified (an
-- admin-controlled trust flag with the exact same self-grant risk as tier),
-- user_id (rewriting it would let an owner hijack/orphan a business profile),
-- id, total_revenue, follower_count, created_at, logo_url, cover_url,
-- primary_color, accent_color, store_config, email, location, updated_at — is
-- simply not wired to any client write path today. Narrower now is safer than
-- guessing which of those a future feature will need; add one GRANT UPDATE(col)
-- when that day comes.
REVOKE UPDATE ON public.business_profiles FROM authenticated, anon;
GRANT UPDATE (business_name, business_type, tagline, description, website, phone, store_enabled, store_slug)
  ON public.business_profiles TO authenticated;

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
